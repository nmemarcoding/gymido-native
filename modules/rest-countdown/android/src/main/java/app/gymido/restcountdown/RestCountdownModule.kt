package app.gymido.restcountdown

import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

// O13 (RN-SPEC-time): the live rest countdown on Android — an ongoing
// notification with a count-down chronometer. It sits in the REST SLOT (tag
// 'gymido.rest', id 0), the same one expo-notifications posts O4's alert into,
// so at the end instant the alert replaces it in place (A1 rule 13). Every call
// arrives through A1's serial queue on the JS side, one at a time.
//
// Also A2's two platform helpers (exact alarms), which live here because they
// are native and small.
class RestCountdownModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw IllegalStateException("React context is not available")

  override fun definition() = ModuleDefinition {
    Name("RestCountdown")

    // O13.2: its own channel, created once at startup beside rest-timer.
    OnCreate {
      appContext.reactContext?.let { ensureChannel(it) }
    }

    // O13.4: the same permission O4 uses; never requested here.
    AsyncFunction("isEnabled") {
      NotificationManagerCompat.from(context).areNotificationsEnabled()
    }

    // O13.3: a new rest. The previous rest's countdown is removed first
    // (targeted, rule C), then this one is posted.
    AsyncFunction("start") { barStartMs: Double, endMs: Double, setId: String, token: String ->
      cancelCountdown()
      post(endMs.toLong(), setId, token)
    }

    // O13.3 ±5s: re-post in place, only if the countdown is still in the slot.
    // Swiped away, it stays gone for this rest.
    AsyncFunction("update") { barStartMs: Double, endMs: Double, token: String ->
      val current = findCountdown() ?: return@AsyncFunction
      val setId = current.notification.extras.getString(EXTRA_SET_ID) ?: ""
      post(endMs.toLong(), setId, token)
    }

    // O13.5 C: targeted. If the slot holds O4's alert instead, it is left alone.
    AsyncFunction("end") {
      cancelCountdown()
    }

    // A2 rule 1: nothing to grant below API 31.
    Function("canScheduleExactAlarms") {
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) {
        true
      } else {
        (context.getSystemService(Context.ALARM_SERVICE) as AlarmManager).canScheduleExactAlarms()
      }
    }

    // A2 rule 3: "Open settings" — Android's "Alarms & reminders" page for Gymido.
    Function("openExactAlarmSettings") {
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) {
        return@Function false
      }
      val intent = Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM)
        .setData(Uri.parse("package:${context.packageName}"))
        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      context.startActivity(intent)
      true
    }
  }

  // DEFAULT importance, silenced on the channel itself. Android hides LOW
  // ("silent") notifications from the lock screen by default, which hid the
  // countdown there; DEFAULT shows it without sound, vibration or a heads-up
  // (only HIGH peeks). A channel's importance is fixed once created, so the
  // raise needs a new id, and the LOW one is deleted so it doesn't linger in
  // the app's notification settings.
  private fun ensureChannel(context: Context) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
      return
    }
    val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    manager.deleteNotificationChannel(LEGACY_CHANNEL_ID)
    val channel = NotificationChannel(CHANNEL_ID, CHANNEL_NAME, NotificationManager.IMPORTANCE_DEFAULT).apply {
      setSound(null, null)
      enableVibration(false)
      setShowBadge(false)
      lockscreenVisibility = android.app.Notification.VISIBILITY_PUBLIC
    }
    manager.createNotificationChannel(channel)
  }

  // The countdown in the rest slot, or null (empty, or holding O4's alert).
  private fun findCountdown() =
    (context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager)
      .activeNotifications
      .firstOrNull {
        it.tag == SLOT_TAG && it.id == SLOT_ID &&
          it.notification.extras.getString(EXTRA_KIND) == KIND_COUNTDOWN
      }

  private fun cancelCountdown() {
    if (findCountdown() != null) {
      NotificationManagerCompat.from(context).cancel(SLOT_TAG, SLOT_ID)
    }
  }

  private fun post(endMs: Long, setId: String, token: String) {
    val remainingMs = endMs - System.currentTimeMillis()
    if (remainingMs <= 0 || !NotificationManagerCompat.from(context).areNotificationsEnabled()) {
      return
    }
    ensureChannel(context)
    val notification = NotificationCompat.Builder(context, CHANNEL_ID)
      .setSmallIcon(smallIcon())
      .setColor(BRAND_400)
      .setColorized(false)
      // O13.1: "Rest timer" and the chronometer only. No content text, no ticker;
      // the system header already names the app, so "Gymido" is not repeated.
      .setContentTitle(TITLE)
      .setUsesChronometer(true)
      .setChronometerCountDown(true)
      .setWhen(endMs)
      .setShowWhen(true)
      .setOngoing(true)
      .setOnlyAlertOnce(true)
      .setSilent(true)
      .setAutoCancel(false)
      .setCategory(NotificationCompat.CATEGORY_STOPWATCH)
      .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
      // The chronometer runs on into negative time; this removes it at the end
      // instant if no alert replaces it. Check 2: it never removes the alert.
      .setTimeoutAfter(remainingMs)
      .setContentIntent(launchIntent())
      .addExtras(
        android.os.Bundle().apply {
          putString(EXTRA_KIND, KIND_COUNTDOWN)
          putString(EXTRA_SET_ID, setId)
          putString(EXTRA_TOKEN, token)
        }
      )
      .build()
    NotificationManagerCompat.from(context).notify(SLOT_TAG, SLOT_ID, notification)
  }

  // The same small icon O4's notifications use: expo's configured default, or
  // the app icon (ExpoNotificationBuilder's own fallback).
  private fun smallIcon(): Int {
    return try {
      val info = context.packageManager.getApplicationInfo(context.packageName, PackageManager.GET_META_DATA)
      val configured = info.metaData?.getInt(EXPO_DEFAULT_ICON_KEY, 0) ?: 0
      if (configured != 0) configured else info.icon
    } catch (e: PackageManager.NameNotFoundException) {
      context.applicationInfo.icon
    }
  }

  private fun launchIntent(): PendingIntent? {
    val intent = context.packageManager.getLaunchIntentForPackage(context.packageName) ?: return null
    return PendingIntent.getActivity(
      context,
      0,
      intent,
      PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
    )
  }

  companion object {
    // The rest slot — exactly expo's notify(tag = identifier, id = 0).
    const val SLOT_TAG = "gymido.rest"
    const val SLOT_ID = 0
    const val CHANNEL_ID = "rest-countdown-v2"
    // The first build's LOW channel: deleted at startup (see ensureChannel).
    const val LEGACY_CHANNEL_ID = "rest-countdown"
    const val CHANNEL_NAME = "Rest countdown"
    const val TITLE = "Rest timer"
    const val EXTRA_KIND = "gymido.kind"
    const val EXTRA_SET_ID = "gymido.setId"
    const val EXTRA_TOKEN = "gymido.token"
    const val KIND_COUNTDOWN = "rest-countdown"
    const val EXPO_DEFAULT_ICON_KEY = "expo.modules.notifications.default_notification_icon"
    val BRAND_400 = Color.parseColor("#F4B400")
  }
}

package expo.modules.restcountdown

import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.media.AudioAttributes
import android.net.Uri
import android.os.Build
import android.os.VibrationAttributes
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.provider.Settings
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record

// RN-SPEC-time O13 (Android): the rest countdown as an ongoing count-down
// chronometer notification in the rest slot, plus A2's two exact-alarm calls.
private const val SLOT_TAG = "gymido.rest" // REST_NOTIFICATION_ID
private const val SLOT_ID = 0 // expo posts notify(tag = identifier, id = 0)
private const val CHANNEL_ID = "rest-countdown-v2"
private const val LEGACY_CHANNEL_ID = "rest-countdown"
private const val KIND_KEY = "gymido.kind"
private const val KIND = "rest-countdown"
private const val BRAND_400 = "#f4b400"

class CountdownOptions : Record {
  @Field val barStartMs: Double = 0.0
  @Field val endMs: Double = 0.0
  @Field val setId: String? = null
  @Field val token: String = ""
}

class RestCountdownModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  private val manager: NotificationManager
    get() = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

  override fun definition() = ModuleDefinition {
    Name("RestCountdown")

    // O13.2: create the channel at startup and delete the legacy one (a
    // no-op when it doesn't exist), on every launch.
    OnCreate {
      appContext.reactContext?.let { ensureChannels() }
    }

    // O13.4: the countdown needs notification permission. Never asks.
    AsyncFunction("isEnabled") {
      NotificationManagerCompat.from(context).areNotificationsEnabled()
    }

    AsyncFunction("start") { options: CountdownOptions ->
      if (NotificationManagerCompat.from(context).areNotificationsEnabled()) {
        post(options)
      }
    }

    // O13.3 ±5s: re-post in place, only if the countdown is still there.
    AsyncFunction("update") { options: CountdownOptions ->
      if (slotHoldsCountdown()) {
        post(options)
      }
    }

    // O13.5 rule C: targeted. Leaves O4's alert alone when it holds the slot.
    AsyncFunction("end") {
      if (slotHoldsCountdown()) {
        manager.cancel(SLOT_TAG, SLOT_ID)
      }
    }

    // A2 rule 1: nothing to grant below API 31.
    AsyncFunction("canScheduleExactAlarms") {
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) {
        true
      } else {
        (context.getSystemService(Context.ALARM_SERVICE) as AlarmManager).canScheduleExactAlarms()
      }
    }

    // A2 rule 3: "Open settings". Never throws: some OEM / Go builds have no
    // activity for the exact-alarm screen, so fall back to the app's details
    // settings, and swallow anything else (a sync Function throw would surface
    // as a JS exception inside the onPress handler).
    // RN-SPEC-time §7.2 step 2: the rest-end buzz, with ALARM usage so it isn't
    // dropped like an attribute-less (usage unknown) vibration can be.
    // Best effort; returns false when there is no vibrator to use.
    Function("vibrateRestEnd") {
      vibrateRestEnd()
    }

    Function("openExactAlarmSettings") {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        try {
          val packageUri = Uri.parse("package:${context.packageName}")
          if (!launchSettings(Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, packageUri))) {
            launchSettings(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, packageUri))
          }
        } catch (e: Exception) {
          // ReactContextLost or similar: nothing to open.
        }
      }
    }
  }

  // Prefers the current activity (no NEW_TASK needed); false when nothing
  // could handle the intent.
  private fun launchSettings(intent: Intent): Boolean {
    return try {
      val activity = appContext.currentActivity
      if (activity != null) {
        activity.startActivity(intent)
      } else {
        context.startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
      }
      true
    } catch (e: Exception) {
      false
    }
  }

  private fun ensureChannels() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
      return
    }
    // DEFAULT, silenced on the channel. Never LOW (hidden from the Lock
    // Screen) and never HIGH (a heads-up at every rest start). Any change to
    // importance, sound or vibration needs a new channel ID.
    val channel = NotificationChannel(CHANNEL_ID, "Rest countdown", NotificationManager.IMPORTANCE_DEFAULT).apply {
      setSound(null, null)
      enableVibration(false)
      setShowBadge(false)
      lockscreenVisibility = NotificationCompat.VISIBILITY_PUBLIC
    }
    manager.createNotificationChannel(channel)
    manager.deleteNotificationChannel(LEGACY_CHANNEL_ID)
  }

  private fun slotHoldsCountdown(): Boolean =
    manager.activeNotifications.any {
      it.tag == SLOT_TAG && it.id == SLOT_ID && it.notification.extras.getString(KIND_KEY) == KIND
    }

  private fun post(options: CountdownOptions) {
    val endMs = options.endMs.toLong()
    val remainingMs = endMs - System.currentTimeMillis()
    // setTimeoutAfter(0) means "never": a countdown posted after its end
    // would run on into negative time and never clear, so don't post it.
    if (remainingMs <= 0L) {
      return
    }
    ensureChannels()
    val notification = NotificationCompat.Builder(context, CHANNEL_ID)
      .setSmallIcon(smallIcon())
      .setColor(Color.parseColor(BRAND_400))
      .setColorized(false)
      .setContentTitle("Rest timer")
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
      // The chronometer runs on into negative time, so this is required.
      .setTimeoutAfter(remainingMs)
      .setContentIntent(launchIntent())
      .build()
    notification.extras.putString(KIND_KEY, KIND)
    notification.extras.putString("gymido.setId", options.setId)
    notification.extras.putString("gymido.token", options.token)
    manager.notify(SLOT_TAG, SLOT_ID, notification)
  }

  // The monochrome mark expo-notifications' plugin installs, the same icon
  // O4's notifications use.
  private fun smallIcon(): Int {
    val id = context.resources.getIdentifier("notification_icon", "drawable", context.packageName)
    return if (id != 0) id else context.applicationInfo.icon
  }

  private fun launchIntent(): PendingIntent? {
    val intent = context.packageManager.getLaunchIntentForPackage(context.packageName) ?: return null
    return PendingIntent.getActivity(context, 0, intent, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
  }

  private fun vibrateRestEnd(): Boolean {
    return try {
      val pattern = longArrayOf(0, 200, 100, 200)
      val vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        (context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager).defaultVibrator
      } else {
        @Suppress("DEPRECATION")
        context.getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
      }
      if (!vibrator.hasVibrator()) {
        return false
      }
      when {
        Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU ->
          vibrator.vibrate(
            VibrationEffect.createWaveform(pattern, -1),
            VibrationAttributes.createForUsage(VibrationAttributes.USAGE_ALARM)
          )
        Build.VERSION.SDK_INT >= Build.VERSION_CODES.O -> {
          @Suppress("DEPRECATION")
          vibrator.vibrate(
            VibrationEffect.createWaveform(pattern, -1),
            AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ALARM).build()
          )
        }
        else -> {
          @Suppress("DEPRECATION")
          vibrator.vibrate(pattern, -1)
        }
      }
      true
    } catch (e: Exception) {
      false
    }
  }
}

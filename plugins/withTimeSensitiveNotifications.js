// iOS Time Sensitive Notifications (owner request, 23 Oct 2026): the rest-end
// alert is sent with interruptionLevel 'timeSensitive' (restAlerts.js), which
// iOS only honours with this entitlement. Time Sensitive is what makes Siri's
// "Announce Notifications" read the alert out over headphones/CarPlay, and it
// also breaks through Focus. Local notifications only; no push involved.
//
// If a signing team can't carry this capability, remove this plugin from
// app.config.js: the alert still arrives, just as a normal ("active") one.
const { withEntitlementsPlist } = require('expo/config-plugins');

const TIME_SENSITIVE = 'com.apple.developer.usernotifications.time-sensitive';

module.exports = function withTimeSensitiveNotifications(config) {
  return withEntitlementsPlist(config, (mod) => {
    mod.modResults[TIME_SENSITIVE] = true;
    return mod;
  });
};

module.exports.TIME_SENSITIVE = TIME_SENSITIVE;

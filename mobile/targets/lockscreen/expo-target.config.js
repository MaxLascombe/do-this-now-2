/** @type {import('@bacons/apple-targets').Config} */
module.exports = {
  type: 'widget',
  name: 'LockScreenTimer',
  // Interactive Live Activity buttons (App Intents) need iOS 17.
  deploymentTarget: '17.0',
  entitlements: {
    'com.apple.security.application-groups': [
      'group.com.maxlascombe.dothisnow',
    ],
  },
  frameworks: ['SwiftUI', 'WidgetKit', 'ActivityKit', 'AppIntents'],
}

import ExpoModulesCore
import WidgetKit

// Hooks app launch — INCLUDING the background launch iOS performs when a
// Live Activity is started by push while the app is closed — so token
// registration never depends on the JS runtime being up.
public class LockScreenAppDelegateSubscriber: ExpoAppDelegateSubscriber {
  public func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions:
      [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    LockScreenTokenSync.shared.start()
    // Silent content-available pushes need a plain APNs token; registering
    // never prompts the user (no alert permission involved).
    application.registerForRemoteNotifications()
    return true
  }

  public func application(
    _ application: UIApplication,
    didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data
  ) {
    LockScreenTokenSync.shared.registerDeviceToken(deviceToken)
  }

  public func application(
    _ application: UIApplication,
    didReceiveRemoteNotification userInfo: [AnyHashable: Any],
    fetchCompletionHandler completionHandler:
      @escaping (UIBackgroundFetchResult) -> Void
  ) {
    // The server's wake: something changed remotely while the app was
    // backgrounded — refresh the progress ring now, not in 20 minutes.
    WidgetCenter.shared.reloadTimelines(ofKind: "LockScreenProgress")
    completionHandler(.newData)
  }
}

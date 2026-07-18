import ExpoModulesCore

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
    return true
  }
}

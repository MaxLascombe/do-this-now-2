import ActivityKit
import ExpoModulesCore

// App-side half of the Lock Screen Timer: parks the widget's credentials in
// the shared App Group and kicks the native token sync. Registration itself
// lives in LockScreenTokenSync (native, launch-driven) so it also works on
// background launches where the JS runtime never starts.
public class LockScreenBridgeModule: Module {
  public func definition() -> ModuleDefinition {
    Name("LockScreenBridge")

    Function("setConfig") { (baseUrl: String, deviceToken: String) in
      let defaults = UserDefaults(
        suiteName: "group.com.maxlascombe.dothisnow")
      defaults?.set(baseUrl, forKey: "apiBaseUrl")
      defaults?.set(deviceToken, forKey: "deviceToken")
    }

    Function("isSupported") { () -> Bool in
      guard #available(iOS 17.2, *) else { return false }
      return ActivityAuthorizationInfo().areActivitiesEnabled
    }

    // Call after setConfig: ensures observers run and re-registers the
    // current tokens (any observed before credentials existed were dropped).
    Function("startSync") {
      LockScreenTokenSync.shared.start()
      LockScreenTokenSync.shared.flush()
    }
  }
}

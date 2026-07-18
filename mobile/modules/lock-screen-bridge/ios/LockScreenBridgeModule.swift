import ActivityKit
import ExpoModulesCore

// App-side half of the Lock Screen Timer: parks the widget's credentials in
// the shared App Group and streams ActivityKit push tokens to JS, which
// registers them with the server. Everything ActivityKit-push-related is
// iOS 17.2+; on older systems `isSupported` is false and JS skips setup.
public class LockScreenBridgeModule: Module {
  private var observing = false
  private var observedActivityIds = Set<String>()

  public func definition() -> ModuleDefinition {
    Name("LockScreenBridge")

    Events("onPushToStartToken", "onActivityUpdateToken")

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

    OnStartObserving {
      self.startObserving()
    }
  }

  private func startObserving() {
    guard !observing else { return }
    observing = true
    guard #available(iOS 17.2, *) else { return }

    Task {
      for await data in Activity<LockScreenTimerAttributes>
        .pushToStartTokenUpdates
      {
        self.sendEvent("onPushToStartToken", ["token": hex(data)])
      }
    }
    // Activities live before JS attached (e.g. push-to-start while the app
    // was closed) plus every future one.
    Task {
      for activity in Activity<LockScreenTimerAttributes>.activities {
        self.observeActivity(activity)
      }
      for await activity in Activity<LockScreenTimerAttributes>
        .activityUpdates
      {
        self.observeActivity(activity)
      }
    }
  }

  @available(iOS 17.2, *)
  private func observeActivity(
    _ activity: Activity<LockScreenTimerAttributes>
  ) {
    guard !observedActivityIds.contains(activity.id) else { return }
    observedActivityIds.insert(activity.id)
    Task {
      for await data in activity.pushTokenUpdates {
        self.sendEvent(
          "onActivityUpdateToken",
          ["token": hex(data), "activityId": activity.id])
      }
    }
  }
}

private func hex(_ data: Data) -> String {
  data.map { String(format: "%02x", $0) }.joined()
}

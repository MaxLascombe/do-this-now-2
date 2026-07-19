import ActivityKit
import ExpoModulesCore
import WidgetKit

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

    // instant local clear on unfocus — don't make the lock screen wait on APNs
    AsyncFunction("endAllActivities") {
      WidgetCenter.shared.reloadTimelines(ofKind: "LockScreenProgress")
      guard #available(iOS 17.2, *) else { return }
      for activity in Activity<LockScreenTimerAttributes>.activities {
        await activity.end(nil, dismissalPolicy: .immediate)
      }
    }

    // Local-first mirror: apply the app's current state to the Live Activity
    // immediately; the server's push follows as the cross-device backup.
    AsyncFunction("syncActivity") { (stateJson: String) in
      WidgetCenter.shared.reloadTimelines(ofKind: "LockScreenProgress")
      guard #available(iOS 17.2, *) else { return }
      guard
        let data = stateJson.data(using: .utf8),
        let state = try? JSONDecoder().decode(
          LockScreenTimerAttributes.ContentState.self, from: data)
      else { return }
      await LocalActivitySync.shared.apply(state)
    }
  }
}

// Actor-serialized so two rapid cache changes can't both see "no activity"
// and double-request one.
@available(iOS 17.2, *)
actor LocalActivitySync {
  static let shared = LocalActivitySync()

  func apply(_ state: LockScreenTimerAttributes.ContentState) async {
    let activities = Activity<LockScreenTimerAttributes>.activities
    if let current = activities.first {
      for extra in activities.dropFirst() {
        await extra.end(nil, dismissalPolicy: .immediate)
      }
      await current.update(ActivityContent(state: state, staleDate: nil))
      return
    }
    guard ActivityAuthorizationInfo().areActivitiesEnabled else { return }
    // pushType .token: the token-sync observer registers the new activity's
    // update token, so server pushes keep flowing to it.
    _ = try? Activity<LockScreenTimerAttributes>.request(
      attributes: LockScreenTimerAttributes(),
      content: ActivityContent(state: state, staleDate: nil),
      pushType: .token)
  }
}

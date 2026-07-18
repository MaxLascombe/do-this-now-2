import ActivityKit
import Foundation

// Registers ActivityKit push tokens with the server from NATIVE code, so it
// works on the background launch iOS gives us when a push-to-start arrives
// with the app closed — the JS runtime isn't up then, and missing that
// registration is exactly what caused duplicate activities (an unacked
// device kept receiving push-to-starts). Started from the app-delegate
// subscriber on every launch and re-kicked from JS after sign-in writes
// the credentials.
final class LockScreenTokenSync {
  static let shared = LockScreenTokenSync()
  private var started = false
  private var observedActivityIds = Set<String>()

  func start() {
    guard !started else { return }
    guard #available(iOS 17.2, *) else { return }
    started = true

    Task {
      for await data in Activity<LockScreenTimerAttributes>
        .pushToStartTokenUpdates
      {
        self.register(kind: "start", token: hex(data))
      }
    }
    Task {
      self.endDuplicateActivities()
      for activity in Activity<LockScreenTimerAttributes>.activities {
        self.observe(activity)
      }
      for await activity in Activity<LockScreenTimerAttributes>
        .activityUpdates
      {
        self.observe(activity)
      }
    }
  }

  // Re-register the CURRENT tokens. Needed right after JS writes the
  // credentials: tokens observed before that were dropped by register()'s
  // missing-creds guard, and the long-lived observer streams won't re-emit
  // them.
  func flush() {
    guard #available(iOS 17.2, *) else { return }
    if let token = Activity<LockScreenTimerAttributes>.pushToStartToken {
      register(kind: "start", token: hex(token))
    }
    for activity in Activity<LockScreenTimerAttributes>.activities {
      if let token = activity.pushToken {
        register(kind: "update", token: hex(token))
      }
    }
  }

  // Belt-and-braces cleanup: if a duplicate ever slipped through, keep one
  // copy and end the rest at launch.
  @available(iOS 17.2, *)
  private func endDuplicateActivities() {
    let activities = Activity<LockScreenTimerAttributes>.activities
    guard activities.count > 1 else { return }
    for extra in activities.dropFirst() {
      Task { await extra.end(nil, dismissalPolicy: .immediate) }
    }
  }

  @available(iOS 17.2, *)
  private func observe(_ activity: Activity<LockScreenTimerAttributes>) {
    guard !observedActivityIds.contains(activity.id) else { return }
    observedActivityIds.insert(activity.id)
    Task {
      for await data in activity.pushTokenUpdates {
        self.register(kind: "update", token: hex(data))
      }
    }
  }

  private func register(kind: String, token: String) {
    let defaults = UserDefaults(suiteName: "group.com.maxlascombe.dothisnow")
    guard
      let base = defaults?.string(forKey: "apiBaseUrl"),
      let deviceToken = defaults?.string(forKey: "deviceToken"),
      let url = URL(string: base + "/api/lockscreen/push-token")
    else {
      // Credentials not written yet (first launch before sign-in) — the
      // JS setup calls start() again after setConfig, and ActivityKit
      // replays current tokens to new observers.
      return
    }
    var req = URLRequest(url: url)
    req.httpMethod = "POST"
    req.setValue("application/json", forHTTPHeaderField: "Content-Type")
    req.setValue("Bearer \(deviceToken)", forHTTPHeaderField: "Authorization")
    req.httpBody = try? JSONSerialization.data(withJSONObject: [
      "kind": kind,
      "token": token,
    ])
    URLSession.shared.dataTask(with: req).resume()
  }
}

private func hex(_ data: Data) -> String {
  data.map { String(format: "%02x", $0) }.joined()
}

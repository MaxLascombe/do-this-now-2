import ActivityKit
import AppIntents
import Foundation

// The lock-screen button. Runs in the widget extension process (no app
// launch): POSTs to the server with the device token the app parked in the
// shared App Group (ADR-0004), then applies the returned state to the local
// activity so the button flips instantly instead of waiting on the APNs
// round-trip. The server carries the real semantics — pausing a fixed task
// at its target completes it, in which case `state` comes back null and the
// activity ends.
struct PauseResumeIntent: AppIntent {
  static var title: LocalizedStringResource = "Pause or resume the timer"
  static var isDiscoverable: Bool = false

  @Parameter(title: "Resume")
  var resume: Bool

  init() {}

  init(resume: Bool) {
    self.resume = resume
  }

  func perform() async throws -> some IntentResult {
    let defaults = UserDefaults(suiteName: "group.com.maxlascombe.dothisnow")
    guard
      let base = defaults?.string(forKey: "apiBaseUrl"),
      let token = defaults?.string(forKey: "deviceToken"),
      let url = URL(string: base + "/api/lockscreen/timer")
    else {
      return .result()
    }

    var req = URLRequest(url: url)
    req.httpMethod = "POST"
    req.setValue("application/json", forHTTPHeaderField: "Content-Type")
    req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
    // Minutes west of UTC, matching JS getTimezoneOffset() — so a pause
    // that completes a task credits the right local day.
    let tzOffsetMin = -TimeZone.current.secondsFromGMT() / 60
    req.setValue(String(tzOffsetMin), forHTTPHeaderField: "X-Tz-Offset")
    let at = ISO8601DateFormatter().string(from: Date())
    req.httpBody = try JSONSerialization.data(withJSONObject: [
      "action": resume ? "resume" : "pause",
      "at": at,
    ])

    let (data, _) = try await URLSession.shared.data(for: req)

    struct Response: Decodable {
      let state: LockScreenTimerAttributes.ContentState?
    }
    if let response = try? JSONDecoder().decode(Response.self, from: data) {
      for activity in Activity<LockScreenTimerAttributes>.activities {
        if let state = response.state {
          await activity.update(ActivityContent(state: state, staleDate: nil))
        } else {
          await activity.end(nil, dismissalPolicy: .immediate)
        }
      }
    }
    return .result()
  }
}

import ActivityKit
import AppIntents
import Foundation
import WidgetKit

// The lock-screen button. Runs in the widget extension process (no app
// launch): POSTs to the server with the device token the app parked in the
// shared App Group (ADR-0004), then applies the returned state to the local
// activity so the button flips without waiting on the APNs round-trip. The
// server carries the real semantics — pausing a fixed task at its target
// completes it, in which case `state` comes back null and the activity ends.
//
// UX: the tap immediately applies the expected outcome (digits stop/start
// on the spot, button stays disabled via `pending`); the server response
// replaces it with the authoritative state, and a failure reverts to the
// pre-tap snapshot so the lock screen never lies about a change that
// didn't commit.
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

    // Optimistic flip from the current state; kept for the failure revert.
    let snapshot = Activity<LockScreenTimerAttributes>.activities.first?
      .content.state
    if var optimistic = snapshot {
      let now = Date().timeIntervalSince1970
      if resume {
        optimistic.running = true
        optimistic.startedAtEpoch = now
      } else {
        if let started = optimistic.startedAtEpoch {
          optimistic.accumulatedSeconds += max(0, now - started)
        }
        optimistic.running = false
        optimistic.startedAtEpoch = nil
      }
      optimistic.pending = true
      await applyToAll(optimistic)
    }

    do {
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
      guard
        let response = try? JSONDecoder().decode(Response.self, from: data)
      else {
        await revert(to: snapshot)
        return .result()
      }

      // Update one activity (server states never carry `pending`); end any
      // extras — a duplicate that slipped through gets cleaned up here.
      var kept: Activity<LockScreenTimerAttributes>?
      for activity in Activity<LockScreenTimerAttributes>.activities {
        if let state = response.state, kept == nil {
          kept = activity
          await activity.update(ActivityContent(state: state, staleDate: nil))
        } else {
          await activity.end(nil, dismissalPolicy: .immediate)
        }
      }
      // Extension-side reloads count against the WidgetKit budget — only
      // spend one when the pause actually completed the task.
      if response.state == nil {
        WidgetCenter.shared.reloadTimelines(ofKind: PROGRESS_WIDGET_KIND)
      }

      // Local array order doesn't say which activity's token the server
      // holds — re-register the survivor's so server pushes land on the
      // activity that's actually still on the lock screen.
      if let kept, let pushToken = kept.pushToken {
        let hexToken = pushToken.map { String(format: "%02x", $0) }.joined()
        var reg = URLRequest(
          url: URL(string: base + "/api/lockscreen/push-token")!)
        reg.httpMethod = "POST"
        reg.setValue("application/json", forHTTPHeaderField: "Content-Type")
        reg.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        reg.httpBody = try? JSONSerialization.data(withJSONObject: [
          "kind": "update",
          "token": hexToken,
        ])
        _ = try? await URLSession.shared.data(for: reg)
      }
    } catch {
      // Network failed — undo the optimistic flip so the user can retry.
      await revert(to: snapshot)
    }
    return .result()
  }

  private func applyToAll(
    _ state: LockScreenTimerAttributes.ContentState
  ) async {
    for activity in Activity<LockScreenTimerAttributes>.activities {
      await activity.update(ActivityContent(state: state, staleDate: nil))
    }
  }

  private func revert(
    to snapshot: LockScreenTimerAttributes.ContentState?
  ) async {
    guard var state = snapshot else { return }
    state.pending = nil
    await applyToAll(state)
  }
}

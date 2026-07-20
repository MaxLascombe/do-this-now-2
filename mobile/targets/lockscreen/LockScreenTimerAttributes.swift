import ActivityKit
import Foundation

// The Lock Screen Timer's data contract. The struct NAME is wire format:
// the server's push-to-start payload carries `attributes-type:
// "LockScreenTimerAttributes"` and ActivityKit matches it against this
// type. ContentState mirrors web/src/server/lib/lockscreen.ts
// `LockScreenState` field for field (dates as epoch seconds so no decoder
// strategy can disagree). An identical copy lives in
// modules/lock-screen-bridge/ios — the app target and this extension each
// compile their own; keep them byte-identical.
struct LockScreenTimerAttributes: ActivityAttributes {
  public struct ContentState: Codable, Hashable {
    var taskId: String
    var title: String
    var emoji: String
    var running: Bool
    var startedAtEpoch: Double?
    var accumulatedSeconds: Double
    var targetMinutes: Double
    // Local-only: set by the button intent while its server call is in
    // flight (greys/disables the button). The server never sends it, so
    // any push naturally clears it.
    var pending: Bool?
  }
}

extension LockScreenTimerAttributes.ContentState {
  // Anchor date for SwiftUI's self-ticking `Text(_, style: .timer)`:
  // "now minus everything already on the clock", so the system renders
  // banked + live time without any pushes while running.
  var timerBaseline: Date {
    if let started = startedAtEpoch {
      return Date(timeIntervalSince1970: started - accumulatedSeconds)
    }
    return Date().addingTimeInterval(-accumulatedSeconds)
  }

  // Static banked-time display for the paused state, matching the app's
  // MM:SS / H:MM:SS format.
  var pausedText: String {
    let total = Int(max(0, accumulatedSeconds))
    let h = total / 3600
    let m = (total % 3600) / 60
    let s = total % 60
    return h > 0
      ? String(format: "%d:%02d:%02d", h, m, s)
      : String(format: "%02d:%02d", m, s)
  }
}

extension LockScreenTimerAttributes.ContentState {
  // "Same state" for animation purposes — epochs within a few seconds,
  // `pending` ignored (local-only). Used to skip re-applying updates that
  // would only replay the system's update animation as a visible stutter.
  func isRoughlyEqual(to other: Self) -> Bool {
    taskId == other.taskId && title == other.title && emoji == other.emoji
      && running == other.running
      && abs((startedAtEpoch ?? -1) - (other.startedAtEpoch ?? -1)) < 3
      && abs(accumulatedSeconds - other.accumulatedSeconds) < 3
      && targetMinutes == other.targetMinutes
  }
}

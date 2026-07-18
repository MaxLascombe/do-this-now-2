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

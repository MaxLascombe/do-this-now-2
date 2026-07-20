import ActivityKit
import Foundation

// EXACT copy of mobile/targets/lockscreen/LockScreenTimerAttributes.swift —
// the app target and the widget extension each compile their own copy of
// the same type; ActivityKit correlates them by the struct name. Keep the
// two files byte-identical (see the note in the target's copy).
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

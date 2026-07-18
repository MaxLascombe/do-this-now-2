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

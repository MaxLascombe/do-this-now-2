import ActivityKit
import SwiftUI
import WidgetKit

@main
struct LockScreenTimerBundle: WidgetBundle {
  var body: some Widget {
    LockScreenTimerLiveActivity()
  }
}

// Ticks by itself while running (system-rendered), static banked time when
// paused — no pushes needed for the seconds to move.
struct TimerText: View {
  let state: LockScreenTimerAttributes.ContentState

  var body: some View {
    if state.running {
      Text(state.timerBaseline, style: .timer)
    } else {
      Text(state.pausedText)
    }
  }
}

struct PauseResumeButton: View {
  let running: Bool
  let pending: Bool

  var body: some View {
    Button(intent: PauseResumeIntent(resume: !running)) {
      if pending {
        ProgressView()
          .tint(.white)
      } else {
        Image(systemName: running ? "pause.fill" : "play.fill")
          .font(.title3)
      }
    }
    .buttonStyle(.bordered)
    .tint(running ? .white : .green)
    .disabled(pending)
    .opacity(pending ? 0.5 : 1)
  }
}

// Matches the app's dark zinc look: black card, white title, green accent
// on the live timer.
struct LockScreenView: View {
  let state: LockScreenTimerAttributes.ContentState

  var body: some View {
    HStack(spacing: 12) {
      Text(state.emoji)
        .font(.largeTitle)
      VStack(alignment: .leading, spacing: 2) {
        Text(state.title)
          .font(.headline)
          .lineLimit(1)
          .foregroundStyle(.white)
        HStack(spacing: 6) {
          if !state.running {
            Image(systemName: "pause.fill")
              .font(.caption2)
              .foregroundStyle(.secondary)
          }
          TimerText(state: state)
            .font(.system(.title3, design: .monospaced))
            .foregroundStyle(state.running ? Color.green : Color.secondary)
          if state.targetMinutes > 0 {
            Text("· \(Int(state.targetMinutes))m plan")
              .font(.caption)
              .foregroundStyle(.secondary)
          }
        }
      }
      Spacer()
      PauseResumeButton(running: state.running, pending: state.pending ?? false)
    }
    .padding(16)
  }
}

struct LockScreenTimerLiveActivity: Widget {
  var body: some WidgetConfiguration {
    ActivityConfiguration(for: LockScreenTimerAttributes.self) { context in
      LockScreenView(state: context.state)
        .activityBackgroundTint(Color.black.opacity(0.85))
        .activitySystemActionForegroundColor(.white)
    } dynamicIsland: { context in
      DynamicIsland {
        DynamicIslandExpandedRegion(.leading) {
          Text(context.state.emoji).font(.title2)
        }
        DynamicIslandExpandedRegion(.center) {
          Text(context.state.title)
            .font(.headline)
            .lineLimit(1)
        }
        DynamicIslandExpandedRegion(.trailing) {
          TimerText(state: context.state)
            .font(.headline)
            .monospacedDigit()
        }
        DynamicIslandExpandedRegion(.bottom) {
          PauseResumeButton(
            running: context.state.running,
            pending: context.state.pending ?? false)
        }
      } compactLeading: {
        Text(context.state.emoji)
      } compactTrailing: {
        TimerText(state: context.state)
          .monospacedDigit()
          .frame(maxWidth: 56)
      } minimal: {
        Text(context.state.emoji)
      }
    }
  }
}

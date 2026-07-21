import ActivityKit
import SwiftUI
import WidgetKit

@main
struct LockScreenTimerBundle: WidgetBundle {
  var body: some Widget {
    LockScreenTimerLiveActivity()
    LockScreenProgressWidget()
  }
}

// Ticks by itself while running (system-rendered), static banked time when
// paused — no pushes needed for the seconds to move.
struct TimerText: View {
  let state: LockScreenTimerAttributes.ContentState

  var body: some View {
    Group {
      if state.running {
        Text(state.timerBaseline, style: .timer)
      } else {
        Text(state.pausedText)
      }
    }
    .contentTransition(.identity)
  }
}

// No spinner and no transitions: the optimistic flip already shows the
// target state, so the icon hard-swaps and just dims while the request is
// in flight. Fixed content size — a swapped-in spinner used to resize the
// bordered button and bounce the whole activity bubble.
struct PauseResumeButton: View {
  let running: Bool
  let pending: Bool

  var body: some View {
    Button(intent: PauseResumeIntent(resume: !running)) {
      Image(systemName: running ? "pause.fill" : "play.fill")
        .font(.title3)
        .contentTransition(.identity)
        .frame(width: 22, height: 22)
    }
    .buttonStyle(.bordered)
    .tint(running ? .white : .green)
    .disabled(pending)
    .opacity(pending ? 0.6 : 1)
  }
}

// Focus Pulse's lock-screen mirror: a hairline bar that the SYSTEM animates
// to full exactly at the planned-time instant (timerBaseline + target) — no
// pushes. Full bar = the task is paid for. Hidden while paused (the interval
// would keep advancing against a frozen timer) and once already past plan.
struct PlanProgressLine: View {
  let state: LockScreenTimerAttributes.ContentState

  var body: some View {
    if state.running, state.targetMinutes > 0 {
      let planEnd = state.timerBaseline.addingTimeInterval(state.targetMinutes * 60)
      if planEnd > Date() {
        ProgressView(timerInterval: state.timerBaseline...planEnd, countsDown: false)
          .progressViewStyle(.linear)
          .labelsHidden()
          .tint(.green)
          .scaleEffect(x: 1, y: 0.5, anchor: .center)
      } else {
        Rectangle()
          .fill(Color.green)
          .frame(height: 2)
          .clipShape(Capsule())
      }
    }
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
          // Fixed frame: the running Text(style: .timer) greedily reserves
          // width, so without it the plan label shifts between states.
          HStack(spacing: 4) {
            if !state.running {
              Image(systemName: "pause.fill")
                .font(.caption2)
                .foregroundStyle(.secondary)
            }
            TimerText(state: state)
              .font(.system(.title3, design: .monospaced))
              .foregroundStyle(state.running ? Color.green : Color.secondary)
              .lineLimit(1)
              .minimumScaleFactor(0.75)
          }
          .frame(width: 84, alignment: .leading)
          if state.targetMinutes > 0 {
            Text("· \(Int(state.targetMinutes))m plan")
              .font(.caption)
              .foregroundStyle(.secondary)
          }
        }
        PlanProgressLine(state: state)
          .padding(.top, 4)
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
        .transaction { $0.animation = nil }
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

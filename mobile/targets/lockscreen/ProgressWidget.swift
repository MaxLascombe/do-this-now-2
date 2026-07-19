import SwiftUI
import WidgetKit

// Mini lock-screen progress widget: today's done-vs-planned minutes as an
// accessory gauge. Data comes from the device-token-authed progress endpoint
// (the widget extension can't refresh Clerk JWTs — same as the timer button).
// The app reloads this timeline after every task/timer action, so the ring
// tracks the day without waiting on the 20-minute refresh.

let PROGRESS_WIDGET_KIND = "LockScreenProgress"

struct ProgressEntry: TimelineEntry {
  let date: Date
  let done: Double
  let todo: Double
}

struct ProgressProvider: TimelineProvider {
  func placeholder(in _: Context) -> ProgressEntry {
    ProgressEntry(date: Date(), done: 130, todo: 300)
  }

  func getSnapshot(
    in context: Context, completion: @escaping (ProgressEntry) -> Void
  ) {
    if context.isPreview {
      completion(placeholder(in: context))
      return
    }
    Task { completion(await fetch() ?? placeholder(in: context)) }
  }

  func getTimeline(
    in _: Context, completion: @escaping (Timeline<ProgressEntry>) -> Void
  ) {
    Task {
      let entry = await fetch() ?? ProgressEntry(date: Date(), done: 0, todo: 0)
      completion(
        Timeline(
          entries: [entry],
          policy: .after(Date().addingTimeInterval(20 * 60))))
    }
  }

  private func fetch() async -> ProgressEntry? {
    let defaults = UserDefaults(suiteName: "group.com.maxlascombe.dothisnow")
    guard
      let base = defaults?.string(forKey: "apiBaseUrl"),
      let token = defaults?.string(forKey: "deviceToken"),
      let url = URL(string: base + "/api/lockscreen/progress")
    else { return nil }
    var req = URLRequest(url: url)
    req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
    let tzOffsetMin = -TimeZone.current.secondsFromGMT() / 60
    req.setValue(String(tzOffsetMin), forHTTPHeaderField: "X-Tz-Offset")
    guard let (data, _) = try? await URLSession.shared.data(for: req)
    else { return nil }
    struct Body: Decodable {
      let done: Double
      let todo: Double
    }
    guard let body = try? JSONDecoder().decode(Body.self, from: data)
    else { return nil }
    return ProgressEntry(date: Date(), done: body.done, todo: body.todo)
  }
}

// Matches the app's minutesToHours: "2h10", minutes zero-padded, no suffix
// on whole hours.
private func hoursLabel(_ minutes: Double) -> String {
  let rounded = Int(minutes.rounded())
  let h = rounded / 60
  let m = rounded % 60
  return m > 0 ? String(format: "%dh%02d", h, m) : "\(h)h"
}

struct ProgressWidgetView: View {
  let entry: ProgressEntry
  @Environment(\.widgetFamily) private var family

  private var fraction: Double {
    entry.todo > 0 ? min(entry.done / entry.todo, 1) : 1
  }

  var body: some View {
    switch family {
    case .accessoryCircular:
      Gauge(value: fraction) {
        Text("✺")
      } currentValueLabel: {
        Text("\(Int((fraction * 100).rounded()))%")
          .font(.system(.body, design: .monospaced))
      }
      .gaugeStyle(.accessoryCircularCapacity)
    default:
      VStack(alignment: .leading, spacing: 3) {
        HStack(alignment: .firstTextBaseline) {
          Text("TODAY")
            .font(.system(.caption2, design: .monospaced))
            .foregroundStyle(.secondary)
          Spacer()
          Text("\(hoursLabel(entry.done)) / \(hoursLabel(entry.todo))")
            .font(.system(.caption, design: .monospaced))
        }
        Gauge(value: fraction) {
          EmptyView()
        }
        .gaugeStyle(.accessoryLinearCapacity)
      }
    }
  }
}

struct LockScreenProgressWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(
      kind: PROGRESS_WIDGET_KIND, provider: ProgressProvider()
    ) { entry in
      ProgressWidgetView(entry: entry)
        .containerBackground(.clear, for: .widget)
    }
    .configurationDisplayName("Today's progress")
    .description("Minutes done vs planned today.")
    .supportedFamilies([.accessoryCircular, .accessoryRectangular])
  }
}

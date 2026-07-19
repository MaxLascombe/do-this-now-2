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
  var minutesToReduceTomorrowDays: Double = 0
  // False only on the failed-fetch fallback — a real zero-task day is
  // loaded data and still gets its headline.
  var loaded: Bool = true
}

struct ProgressProvider: TimelineProvider {
  func placeholder(in _: Context) -> ProgressEntry {
    ProgressEntry(date: Date(), done: 130, todo: 300)
  }

  // The ahead/behind headline is a pure function of (done, todo, clock), so
  // one fetch mints per-minute entries for the whole window until the next
  // reload — WidgetKit swaps them in on schedule at no refresh-budget cost.
  private func minuteEntries(from base: ProgressEntry) -> [ProgressEntry] {
    let start = Date(
      timeIntervalSinceReferenceDate:
        (Date().timeIntervalSinceReferenceDate / 60).rounded(.down) * 60)
    return (0..<22).map { i in
      ProgressEntry(
        date: start.addingTimeInterval(Double(i) * 60),
        done: base.done,
        todo: base.todo,
        minutesToReduceTomorrowDays: base.minutesToReduceTomorrowDays,
        loaded: base.loaded)
    }
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
      let fetched = await fetch()
      // Retry a failed fetch sooner than the regular 20-minute cadence.
      let entries =
        fetched.map(minuteEntries(from:))
        ?? [ProgressEntry(date: Date(), done: 0, todo: 0, loaded: false)]
      let minutes: TimeInterval = fetched == nil ? 5 : 20
      completion(
        Timeline(
          entries: entries,
          policy: .after(Date().addingTimeInterval(minutes * 60))))
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
      let minutesToReduceTomorrowDays: Double?
    }
    guard let body = try? JSONDecoder().decode(Body.self, from: data)
    else { return nil }
    return ProgressEntry(
      date: Date(), done: body.done, todo: body.todo,
      minutesToReduceTomorrowDays: body.minutesToReduceTomorrowDays ?? 0)
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

// Mirrors shared/src/pacing.ts computeSchedule + format.ts
// formatScheduleStatus: the day's target ramps linearly from 8:30 to
// midnight; the headline is done minus where that ramp says you should be.
private func scheduleHeadline(_ entry: ProgressEntry) -> String {
  let startOfDay = 8.0 * 60 + 30
  let minutesInDay = 24.0 * 60
  let comps = Calendar.current.dateComponents(
    [.hour, .minute], from: entry.date)
  let timeOfDay = Double((comps.hour ?? 0) * 60 + (comps.minute ?? 0))
  let maxTodo = max(entry.todo, entry.minutesToReduceTomorrowDays)
  let pct = max(0, min(1, (timeOfDay - startOfDay) / (minutesInDay - startOfDay)))
  let diff = entry.done - maxTodo * pct
  if timeOfDay < startOfDay && diff == 0 { return "Ahead" }
  if diff > 0 { return "\(hoursLabel(diff.rounded(.down))) ahead" }
  if diff < 0 { return "\(hoursLabel((-diff).rounded(.up))) behind" }
  return "On schedule"
}

struct ProgressWidgetView: View {
  let entry: ProgressEntry
  @Environment(\.widgetFamily) private var family

  private var fraction: Double {
    if entry.todo > 0 { return min(entry.done / entry.todo, 1) }
    // todo 0 with work done = day cleared; 0/0 (incl. failed fetch) = empty
    return entry.done > 0 ? 1 : 0
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
        // Suppressed only when the fetch failed — a verdict with no data
        // would be baseless, but a real zero-task day keeps its headline.
        if entry.loaded {
          Text(scheduleHeadline(entry))
            .font(.system(.headline, design: .monospaced))
        }
        Gauge(value: fraction) {
          EmptyView()
        }
        .gaugeStyle(.accessoryLinearCapacity)
        HStack(alignment: .firstTextBaseline) {
          Text("TODAY")
            .font(.system(.caption2, design: .monospaced))
            .foregroundStyle(.secondary)
          Spacer()
          Text("\(hoursLabel(entry.done)) / \(hoursLabel(entry.todo))")
            .font(.system(.caption2, design: .monospaced))
            .foregroundStyle(.secondary)
        }
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

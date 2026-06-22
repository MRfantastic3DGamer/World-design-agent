import type { NarrativeEvent } from '../types'
import { HelpTip } from './HelpTip'
import { LEVEL_META } from '../types'

interface NarrativeTimelineProps {
  events: NarrativeEvent[]
  selectedEventId: string | null
  onSelectEvent: (eventId: string | null) => void
}

export function NarrativeTimeline({
  events,
  selectedEventId,
  onSelectEvent,
}: NarrativeTimelineProps) {
  if (events.length === 0) {
    return (
      <section className="panel narrative-timeline narrative-timeline--empty">
        <h3>
          How it happened{' '}
          <HelpTip text="Chronological events from GET /api/story/{name}/versions/{version}/narrative." />
        </h3>
        <p>No simulation cycles recorded for this version yet. Run a workflow and approve post-sim to build history.</p>
      </section>
    )
  }

  return (
    <section className="panel narrative-timeline">
      <h3>
        How it happened <HelpTip text="Events from all versions up to and including the selected version." />
      </h3>
      <p className="panel__intro">
        Click a step to highlight its event node on the canvas. Solid border = simulation; red = retcon
        escalation.
      </p>
      <ol className="narrative-timeline__list">
        {events.map((event, index) => {
          const levelLabel = LEVEL_META.find((meta) => meta.level === event.level)?.label
          const isSelected = selectedEventId === event.id
          return (
            <li key={event.id}>
              <button
                type="button"
                className={`timeline-item ${isSelected ? 'timeline-item--selected' : ''} timeline-item--${event.type}`}
                onClick={() => onSelectEvent(isSelected ? null : event.id)}
              >
                <span className="timeline-item__step">{index + 1}</span>
                <div className="timeline-item__body">
                  <div className="timeline-item__meta">
                    <span>{event.version}</span>
                    <span>→ {levelLabel}</span>
                  </div>
                  <div className="timeline-item__title">
                    {event.type === 'retcon_escalation'
                      ? `Retcon escalated from L${event.source_level ?? '?'}`
                      : event.idea ?? 'Simulation cycle'}
                  </div>
                  <div className="timeline-item__summary">
                    {event.summary ?? event.reason ?? 'World state updated'}
                  </div>
                </div>
              </button>
            </li>
          )
        })}
      </ol>
    </section>
  )
}

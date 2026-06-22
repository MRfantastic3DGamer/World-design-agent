import type { StoryState } from '../types'
import { LEVEL_META } from '../types'
import { FieldLabel, HelpTip } from './HelpTip'

interface StatePanelProps {
  storyState: StoryState | null
  projectName: string
  onRefresh: () => void
  loading: boolean
}

export function StatePanel({ storyState, projectName, onRefresh, loading }: StatePanelProps) {
  if (!projectName) {
    return (
      <section className="panel panel--empty">
        <h3>
          Workflow state <HelpTip text="Live LangGraph workflow status from GET /api/story/{name}/state." />
        </h3>
        <p>Select a project to poll workflow state.</p>
      </section>
    )
  }

  if (!storyState) {
    return (
      <section className="panel">
        <h3>Workflow state</h3>
        <button type="button" onClick={onRefresh} disabled={loading}>
          Load state
        </button>
      </section>
    )
  }

  const targetLabel = LEVEL_META.find((m) => m.level === storyState.target_level)?.label

  return (
    <section className="panel state-panel">
      <div className="panel__header-row">
        <h3>Workflow state</h3>
        <button type="button" onClick={onRefresh} disabled={loading}>
          Refresh
        </button>
      </div>

      <dl className="state-grid">
        <div>
          <dt>HITL status</dt>
          <dd>
            <span className={`status-pill status-pill--${storyState.hitl_status.toLowerCase()}`}>
              {storyState.hitl_status}
            </span>
          </dd>
        </div>
        <div>
          <dt>Current version</dt>
          <dd>{storyState.current_version}</dd>
        </div>
        <div>
          <dt>Target level</dt>
          <dd>{targetLabel ?? storyState.target_level ?? '—'}</dd>
        </div>
        <div>
          <dt>Dirty nodes</dt>
          <dd>{storyState.dirty_nodes.length ? storyState.dirty_nodes.join(', ') : 'none'}</dd>
        </div>
      </dl>

      {storyState.user_injected_idea ? (
        <FieldLabel label="Injected idea" tip="Latest idea sent via POST /api/story/{name}/inject.">
          <pre className="panel__pre">{storyState.user_injected_idea}</pre>
        </FieldLabel>
      ) : null}

      {storyState.routing_rationale ? (
        <FieldLabel label="Routing rationale" tip="Router node explanation for chosen target level.">
          <pre className="panel__pre">{storyState.routing_rationale}</pre>
        </FieldLabel>
      ) : null}

      {storyState.hitl_feedback ? (
        <FieldLabel label="HITL feedback" tip="Steering prompt provided at the last HITL gate.">
          <pre className="panel__pre">{storyState.hitl_feedback}</pre>
        </FieldLabel>
      ) : null}

      {storyState.backpropagation ? (
        <details className="panel__details">
          <summary>
            Back-propagation <HelpTip text="Impact decay evaluation and retcon escalation results." />
          </summary>
          <pre className="panel__pre">{JSON.stringify(storyState.backpropagation, null, 2)}</pre>
        </details>
      ) : null}
    </section>
  )
}

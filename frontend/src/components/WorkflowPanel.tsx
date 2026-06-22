import { useState } from 'react'
import type { HitlStatus, StoryState } from '../types'

interface WorkflowPanelProps {
  storyName: string
  storyState: StoryState | null
  loading: boolean
  onInject: (idea: string) => void
  onHitl: (
    gate: 'routing' | 'presim' | 'postsim',
    status: 'approved' | 'rejected' | 'modify',
    steering?: string,
  ) => void
}

const GATE_BY_STATUS: Partial<Record<HitlStatus, 'routing' | 'presim' | 'postsim'>> = {
  AWAITING_ROUTING: 'routing',
  AWAITING_PRE_SIM: 'presim',
  AWAITING_POST_SIM: 'postsim',
}

export function WorkflowPanel({ storyName, storyState, loading, onInject, onHitl }: WorkflowPanelProps) {
  const [idea, setIdea] = useState('')
  const [steering, setSteering] = useState('')

  if (!storyName) {
    return (
      <section className="workflow-panel workflow-panel--empty">
        <h3>Workflow</h3>
        <p>Create or select a story to inject ideas and manage HITL gates.</p>
      </section>
    )
  }

  const activeGate = storyState ? GATE_BY_STATUS[storyState.hitl_status] : undefined

  return (
    <section className="workflow-panel">
      <h3>Workflow</h3>

      <label className="workflow-panel__field">
        Inject idea
        <textarea
          rows={3}
          value={idea}
          onChange={(e) => setIdea(e.target.value)}
          placeholder="A paranoid merchant hides contraband beneath the market stalls…"
        />
      </label>
      <button
        type="button"
        className="workflow-panel__primary"
        disabled={!idea.trim() || loading || Boolean(activeGate)}
        onClick={() => {
          onInject(idea.trim())
          setIdea('')
        }}
      >
        Start routing
      </button>

      {activeGate ? (
        <div className="workflow-panel__hitl">
          <div className="workflow-panel__hitl-title">
            HITL gate: <strong>{activeGate}</strong>
          </div>
          {storyState?.routing_rationale ? (
            <p className="workflow-panel__note">{storyState.routing_rationale}</p>
          ) : null}
          <label className="workflow-panel__field">
            Steering prompt
            <textarea
              rows={2}
              value={steering}
              onChange={(e) => setSteering(e.target.value)}
              placeholder="Make the merchant more paranoid…"
            />
          </label>
          <div className="workflow-panel__actions">
            <button
              type="button"
              disabled={loading}
              onClick={() => onHitl(activeGate, 'approved', steering || undefined)}
            >
              Approve
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => onHitl(activeGate, 'modify', steering || undefined)}
            >
              Modify
            </button>
            <button
              type="button"
              className="danger"
              disabled={loading}
              onClick={() => onHitl(activeGate, 'rejected', steering || undefined)}
            >
              Reject
            </button>
          </div>
        </div>
      ) : null}

      {storyState?.simulation_output ? (
        <details className="workflow-panel__details">
          <summary>Simulation output</summary>
          <pre>{JSON.stringify(storyState.simulation_output, null, 2)}</pre>
        </details>
      ) : null}

      {storyState?.synthesis_output ? (
        <details className="workflow-panel__details" open>
          <summary>Synthesis</summary>
          <pre>{JSON.stringify(storyState.synthesis_output, null, 2)}</pre>
        </details>
      ) : null}
    </section>
  )
}

import { useState } from 'react'
import type { HitlStatus, StoryState } from '../types'
import { FieldLabel, HelpTip } from './HelpTip'

interface WorkflowPanelProps {
  storyName: string
  storyState: StoryState | null
  loading: boolean
  onInject: (idea: string) => void
  onHitl: (
    gate: 'routing' | 'presim' | 'postsim',
    status: 'approved' | 'rejected' | 'modify',
    steering?: string,
    manualOverride?: Record<string, unknown>,
  ) => void
}

const GATE_BY_STATUS: Partial<Record<HitlStatus, 'routing' | 'presim' | 'postsim'>> = {
  AWAITING_ROUTING: 'routing',
  AWAITING_PRE_SIM: 'presim',
  AWAITING_POST_SIM: 'postsim',
}

const GATE_HELP: Record<string, string> = {
  routing: 'Gate 1: approve the router’s target level before orchestrator setup.',
  presim: 'Gate 2: approve Actor/Director prompts before simulation runs.',
  postsim: 'Gate 3: approve synthesized output before committing a new version.',
}

function parseOverride(text: string): Record<string, unknown> | undefined {
  const trimmed = text.trim()
  if (!trimmed) return undefined
  const parsed = JSON.parse(trimmed) as unknown
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('Manual override must be a JSON object')
  }
  return parsed as Record<string, unknown>
}

export function WorkflowPanel({ storyName, storyState, loading, onInject, onHitl }: WorkflowPanelProps) {
  const [idea, setIdea] = useState('')
  const [steering, setSteering] = useState('')
  const [manualOverrideText, setManualOverrideText] = useState('{\n  "location": "market_square"\n}')
  const [overrideError, setOverrideError] = useState<string | null>(null)

  if (!storyName) {
    return (
      <section className="panel panel--empty">
        <h3>
          Workflow <HelpTip text="Inject ideas and advance mandatory Human-in-the-Loop gates." />
        </h3>
        <p>Create or select a project to run the simulation workflow.</p>
      </section>
    )
  }

  const activeGate = storyState ? GATE_BY_STATUS[storyState.hitl_status] : undefined

  const runHitl = (status: 'approved' | 'rejected' | 'modify') => {
    if (!activeGate) return
    setOverrideError(null)
    try {
      const manualOverride = status === 'modify' ? parseOverride(manualOverrideText) : undefined
      onHitl(activeGate, status, steering || undefined, manualOverride)
    } catch (err) {
      setOverrideError(err instanceof Error ? err.message : 'Invalid manual override JSON')
    }
  }

  return (
    <section className="panel workflow-panel">
      <h3>Workflow</h3>

      <FieldLabel
        label="Inject idea"
        htmlFor="workflow-idea"
        tip="Starts the LangGraph routing node. The backend analyzes this and picks a target level (0–4)."
        helper="POST /api/story/{name}/inject"
      >
        <textarea
          id="workflow-idea"
          rows={3}
          value={idea}
          onChange={(e) => setIdea(e.target.value)}
          placeholder="A paranoid merchant hides contraband beneath the market stalls…"
          disabled={Boolean(activeGate)}
        />
      </FieldLabel>
      <button
        type="button"
        className="panel__primary"
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
            <HelpTip text={GATE_HELP[activeGate]} />
          </div>
          {storyState?.routing_rationale ? (
            <p className="workflow-panel__note">{storyState.routing_rationale}</p>
          ) : null}

          <FieldLabel
            label="Steering prompt"
            htmlFor="workflow-steering"
            tip="Creative direction applied by the orchestrator before resuming. E.g. “Make the merchant more paranoid.”"
            helper="Optional for all HITL actions (approved / modify / rejected)."
          >
            <textarea
              id="workflow-steering"
              rows={2}
              value={steering}
              onChange={(e) => setSteering(e.target.value)}
              placeholder="Make the merchant more paranoid…"
            />
          </FieldLabel>

          <FieldLabel
            label="Manual override (JSON)"
            htmlFor="workflow-override"
            tip="Direct JSON edits merged on Modify — e.g. persona location, beliefs, or target level hints."
            helper="Only sent when you click Modify. Maps to manual_override_data in HITL payload."
          >
            <textarea
              id="workflow-override"
              rows={4}
              value={manualOverrideText}
              onChange={(e) => setManualOverrideText(e.target.value)}
            />
          </FieldLabel>
          {overrideError ? <p className="form-error">{overrideError}</p> : null}

          <div className="workflow-panel__actions">
            <button type="button" disabled={loading} onClick={() => runHitl('approved')}>
              Approve
            </button>
            <button type="button" disabled={loading} onClick={() => runHitl('modify')}>
              Modify
            </button>
            <button type="button" className="danger" disabled={loading} onClick={() => runHitl('rejected')}>
              Reject
            </button>
          </div>
        </div>
      ) : null}

      {storyState?.simulation_output ? (
        <details className="panel__details">
          <summary>Simulation output</summary>
          <pre className="panel__pre">{JSON.stringify(storyState.simulation_output, null, 2)}</pre>
        </details>
      ) : null}

      {storyState?.synthesis_output ? (
        <details className="panel__details" open>
          <summary>Synthesis output</summary>
          <pre className="panel__pre">{JSON.stringify(storyState.synthesis_output, null, 2)}</pre>
        </details>
      ) : null}
    </section>
  )
}

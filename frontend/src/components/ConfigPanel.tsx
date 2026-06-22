import { useEffect, useState } from 'react'

import { api } from '../api/client'
import { HelpTip } from './HelpTip'

interface ConfigPanelProps {
  projectName: string
  loading: boolean
}

export function ConfigPanel({ projectName, loading }: ConfigPanelProps) {
  const [config, setConfig] = useState<Record<string, unknown> | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!projectName) {
      setConfig(null)
      return
    }
    setError(null)
    api
      .getStoryConfig(projectName)
      .then(setConfig)
      .catch((err: Error) => setError(err.message))
  }, [projectName])

  if (!projectName) {
    return (
      <section className="panel panel--empty">
        <h3>
          LLM config <HelpTip text="Per-project model routing from GET /api/story/{name}/config." />
        </h3>
        <p>Select a project to view its LLM configuration.</p>
      </section>
    )
  }

  return (
    <section className="panel">
      <h3>LLM config</h3>
      <p className="panel__intro">Provider and model assignments for each agent role in this project.</p>
      {loading && !config ? <p className="panel__muted">Loading…</p> : null}
      {error ? <p className="form-error">{error}</p> : null}
      {config ? <pre className="panel__pre">{JSON.stringify(config, null, 2)}</pre> : null}
    </section>
  )
}

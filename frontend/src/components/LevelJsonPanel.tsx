import { useEffect, useState } from 'react'

import { api } from '../api/client'
import { LEVEL_META } from '../types'
import { FieldLabel, HelpTip } from './HelpTip'

interface LevelJsonPanelProps {
  projectName: string
  version: string
  loading: boolean
}

export function LevelJsonPanel({ projectName, version, loading }: LevelJsonPanelProps) {
  const [level, setLevel] = useState(0)
  const [payload, setPayload] = useState<unknown>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!projectName || !version) {
      setPayload(null)
      return
    }
    setError(null)
    api
      .getLevel(projectName, version, level)
      .then(setPayload)
      .catch((err: Error) => setError(err.message))
  }, [projectName, version, level])

  if (!projectName) {
    return (
      <section className="panel panel--empty">
        <h3>
          Level JSON <HelpTip text="Fetch a single resolved level via GET /api/story/{name}/versions/{version}/{level}." />
        </h3>
        <p>Select a project to inspect raw level data.</p>
      </section>
    )
  }

  const meta = LEVEL_META.find((item) => item.level === level)

  return (
    <section className="panel">
      <h3>Level JSON</h3>
      <FieldLabel
        label="Level"
        htmlFor="level-json-select"
        tip="Choose which hierarchical level to fetch. Backend resolves _ref pointers automatically."
        helper={`GET /api/story/${projectName}/versions/${version}/${level}`}
      >
        <select
          id="level-json-select"
          value={level}
          onChange={(e) => setLevel(Number(e.target.value))}
          disabled={loading}
        >
          {LEVEL_META.map((item) => (
            <option key={item.level} value={item.level}>
              L{item.level} {item.label}
            </option>
          ))}
        </select>
      </FieldLabel>
      {meta ? <p className="panel__muted">Reading {meta.label} from {version}</p> : null}
      {error ? <p className="form-error">{error}</p> : null}
      {payload ? <pre className="panel__pre">{JSON.stringify(payload, null, 2)}</pre> : null}
    </section>
  )
}

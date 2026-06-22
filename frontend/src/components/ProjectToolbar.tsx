import { LEVEL_META } from '../types'
import { formatVersionLabel } from '../utils/version'
import { FieldLabel, HelpTip } from './HelpTip'

interface ProjectToolbarProps {
  projects: string[]
  projectName: string
  versions: string[]
  version: string
  latestVersion: string
  loading: boolean
  backendOk: boolean | null
  onProjectChange: (name: string) => void
  onVersionChange: (version: string) => void
  onRefresh: () => void
}

export function ProjectToolbar({
  projects,
  projectName,
  versions,
  version,
  latestVersion,
  loading,
  backendOk,
  onProjectChange,
  onVersionChange,
  onRefresh,
}: ProjectToolbarProps) {
  const versionOptions = [...versions].reverse()

  return (
    <header className="toolbar">
      <div className="toolbar__brand">
        <span className="toolbar__logo">◈</span>
        <div>
          <div className="toolbar__title">Story Reader</div>
          <div className="toolbar__subtitle">Full API access · graph & timeline</div>
        </div>
        <span
          className={`health-dot ${backendOk === null ? 'health-dot--unknown' : backendOk ? 'health-dot--ok' : 'health-dot--bad'}`}
          title={backendOk ? 'Backend healthy (GET /health)' : 'Backend unreachable'}
        />
        <HelpTip text="Polls GET /health on load and refresh. Green means the FastAPI backend is reachable." />
      </div>

      <div className="toolbar__controls toolbar__controls--primary">
        <FieldLabel
          label="Project"
          htmlFor="project-select"
          tip="Lists all story directories from GET /api/stories."
          helper="Each project has its own versioned JSON storage."
        >
          <select
            id="project-select"
            value={projectName}
            onChange={(e) => onProjectChange(e.target.value)}
            disabled={loading}
          >
            <option value="">Select project…</option>
            {projects.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </FieldLabel>

        <FieldLabel
          label="Version"
          htmlFor="version-select"
          tip="Snapshot of the world state. Latest is selected by default when you open a project."
          helper="GET /api/story/{name}/versions/{version}/all"
        >
          <select
            id="version-select"
            value={version}
            onChange={(e) => onVersionChange(e.target.value)}
            disabled={!projectName || loading || versions.length === 0}
          >
            {versionOptions.map((v) => (
              <option key={v} value={v}>
                {formatVersionLabel(v, latestVersion)}
              </option>
            ))}
          </select>
        </FieldLabel>

        <button type="button" onClick={onRefresh} disabled={!projectName || loading} title="Reload graph, timeline, and state">
          Refresh
        </button>
      </div>

      {projectName ? (
        <div className="toolbar__legend">
          {LEVEL_META.map((meta) => (
            <span key={meta.level} className="legend-chip" style={{ borderColor: meta.color }}>
              L{meta.level} {meta.label}
            </span>
          ))}
        </div>
      ) : null}
    </header>
  )
}

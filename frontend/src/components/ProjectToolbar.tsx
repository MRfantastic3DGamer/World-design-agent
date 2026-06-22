import { LEVEL_META } from '../types'
import { formatVersionLabel } from '../utils/version'

interface ProjectToolbarProps {
  projects: string[]
  projectName: string
  versions: string[]
  version: string
  latestVersion: string
  loading: boolean
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
          <div className="toolbar__subtitle">Project graph & narrative timeline</div>
        </div>
      </div>

      <div className="toolbar__controls toolbar__controls--primary">
        <label>
          Project
          <select
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
        </label>

        <label>
          Version
          <select
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
        </label>

        <button type="button" onClick={onRefresh} disabled={!projectName || loading}>
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

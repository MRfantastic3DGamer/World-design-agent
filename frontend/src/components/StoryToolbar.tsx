import type { StoryState } from '../types'
import { LEVEL_META } from '../types'

interface StoryToolbarProps {
  stories: string[]
  storyName: string
  versions: string[]
  version: string
  storyState: StoryState | null
  loading: boolean
  newStoryName: string
  onStoryChange: (name: string) => void
  onVersionChange: (version: string) => void
  onNewStoryNameChange: (name: string) => void
  onCreateStory: () => void
  onRefresh: () => void
}

export function StoryToolbar({
  stories,
  storyName,
  versions,
  version,
  storyState,
  loading,
  newStoryName,
  onStoryChange,
  onVersionChange,
  onNewStoryNameChange,
  onCreateStory,
  onRefresh,
}: StoryToolbarProps) {
  return (
    <header className="toolbar">
      <div className="toolbar__brand">
        <span className="toolbar__logo">◈</span>
        <div>
          <div className="toolbar__title">World Graph</div>
          <div className="toolbar__subtitle">Hierarchical story canvas</div>
        </div>
      </div>

      <div className="toolbar__controls">
        <label>
          Story
          <select value={storyName} onChange={(e) => onStoryChange(e.target.value)} disabled={loading}>
            <option value="">Select story…</option>
            {stories.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>

        <label>
          Version
          <select value={version} onChange={(e) => onVersionChange(e.target.value)} disabled={!storyName || loading}>
            {versions.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </label>

        <button type="button" onClick={onRefresh} disabled={!storyName || loading}>
          Refresh
        </button>
      </div>

      <div className="toolbar__create">
        <input
          type="text"
          placeholder="new_story_name"
          value={newStoryName}
          onChange={(e) => onNewStoryNameChange(e.target.value)}
        />
        <button type="button" onClick={onCreateStory} disabled={!newStoryName.trim() || loading}>
          Create
        </button>
      </div>

      {storyState ? (
        <div className="toolbar__status">
          <span className={`status-pill status-pill--${storyState.hitl_status.toLowerCase()}`}>
            {storyState.hitl_status.replace(/_/g, ' ')}
          </span>
          {storyState.target_level != null ? (
            <span className="toolbar__target">
              → {LEVEL_META.find((m) => m.level === storyState.target_level)?.label ?? 'Level'}
            </span>
          ) : null}
        </div>
      ) : null}
    </header>
  )
}

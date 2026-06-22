import { useCallback, useEffect, useState } from 'react'
import type { Node } from '@xyflow/react'

import { api, type InitStoryBody } from './api/client'
import { ConfigPanel } from './components/ConfigPanel'
import { InitProjectPanel } from './components/InitProjectPanel'
import { LevelJsonPanel } from './components/LevelJsonPanel'
import { NarrativeTimeline } from './components/NarrativeTimeline'
import { NodeDetailPanel } from './components/NodeDetailPanel'
import { ProjectToolbar } from './components/ProjectToolbar'
import { StatePanel } from './components/StatePanel'
import { StoryCanvas } from './components/StoryCanvas'
import { WorkflowPanel } from './components/WorkflowPanel'
import type { GraphNodeData, LevelData, NarrativeEvent, NarrativeTimeline as NarrativeData, StoryState } from './types'
import { latestVersion } from './utils/version'

type SidebarTab = 'create' | 'workflow' | 'timeline' | 'state' | 'config' | 'level'

const SIDEBAR_TABS: Array<{ id: SidebarTab; label: string; tip: string }> = [
  { id: 'create', label: 'Create', tip: 'POST /api/story/init — scaffold a new project' },
  { id: 'workflow', label: 'Workflow', tip: 'Inject ideas and HITL gates' },
  { id: 'timeline', label: 'Timeline', tip: 'Narrative history up to selected version' },
  { id: 'state', label: 'State', tip: 'GET /api/story/{name}/state' },
  { id: 'config', label: 'Config', tip: 'GET /api/story/{name}/config' },
  { id: 'level', label: 'Level JSON', tip: 'GET single level JSON with ref resolution' },
]

export default function App() {
  const [projects, setProjects] = useState<string[]>([])
  const [projectName, setProjectName] = useState('')
  const [versions, setVersions] = useState<string[]>([])
  const [version, setVersion] = useState('')
  const [latest, setLatest] = useState('v1')
  const [levelData, setLevelData] = useState<LevelData>({})
  const [narrative, setNarrative] = useState<NarrativeData | null>(null)
  const [storyState, setStoryState] = useState<StoryState | null>(null)
  const [selectedNode, setSelectedNode] = useState<Node<GraphNodeData> | null>(null)
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [backendOk, setBackendOk] = useState<boolean | null>(null)
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('create')

  const checkHealth = useCallback(async () => {
    try {
      const result = await api.health()
      setBackendOk(result.status === 'ok')
    } catch {
      setBackendOk(false)
    }
  }, [])

  const loadProjects = useCallback(async () => {
    const names = await api.listProjects()
    setProjects(names)
    return names
  }, [])

  const loadProjectBundle = useCallback(async (name: string, preferredVersion?: string) => {
    const vers = await api.listVersions(name)
    const newest = latestVersion(vers)
    const activeVersion = preferredVersion && vers.includes(preferredVersion) ? preferredVersion : newest

    const [levels, timeline, state] = await Promise.all([
      api.getAllLevels(name, activeVersion),
      api.getNarrative(name, activeVersion),
      api.getStoryState(name).catch(() => null),
    ])

    setVersions(vers)
    setLatest(newest)
    setVersion(activeVersion)
    setLevelData(levels)
    setNarrative(timeline)
    setStoryState(state)
    setSelectedEventId(null)
    setSelectedNode(null)
  }, [])

  useEffect(() => {
    checkHealth()
    loadProjects().catch((err: Error) => setError(err.message))
  }, [checkHealth, loadProjects])

  useEffect(() => {
    if (!projectName) return
    setLoading(true)
    setError(null)
    loadProjectBundle(projectName)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false))
  }, [projectName, loadProjectBundle])

  const handleCreateProject = async (payload: InitStoryBody) => {
    setLoading(true)
    setError(null)
    try {
      await api.initStory(payload)
      await loadProjects()
      setProjectName(payload.story_name)
      setSidebarTab('workflow')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create project')
      throw err
    } finally {
      setLoading(false)
    }
  }

  const handleVersionChange = async (nextVersion: string) => {
    if (!projectName) return
    setVersion(nextVersion)
    setLoading(true)
    setError(null)
    try {
      const [levels, timeline] = await Promise.all([
        api.getAllLevels(projectName, nextVersion),
        api.getNarrative(projectName, nextVersion),
      ])
      setLevelData(levels)
      setNarrative(timeline)
      setSelectedEventId(null)
      setSelectedNode(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load version')
    } finally {
      setLoading(false)
    }
  }

  const handleRefresh = async () => {
    if (!projectName) return
    setLoading(true)
    setError(null)
    try {
      await checkHealth()
      await loadProjects()
      await loadProjectBundle(projectName, version)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh')
    } finally {
      setLoading(false)
    }
  }

  const handleRefreshState = async () => {
    if (!projectName) return
    setLoading(true)
    try {
      const state = await api.getStoryState(projectName)
      setStoryState(state)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load state')
    } finally {
      setLoading(false)
    }
  }

  const handleInject = async (idea: string) => {
    if (!projectName) return
    setLoading(true)
    setError(null)
    try {
      const state = await api.injectIdea(projectName, idea)
      setStoryState(state)
      setSidebarTab('state')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to inject idea')
    } finally {
      setLoading(false)
    }
  }

  const handleHitl = async (
    gate: 'routing' | 'presim' | 'postsim',
    status: 'approved' | 'rejected' | 'modify',
    steering?: string,
    manualOverride?: Record<string, unknown>,
  ) => {
    if (!projectName) return
    setLoading(true)
    setError(null)
    try {
      const state = await api.hitl(projectName, gate, {
        status,
        steering_prompt: steering,
        manual_override_data: manualOverride,
      })
      setStoryState(state)
      await loadProjectBundle(projectName, state.current_version)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'HITL action failed')
    } finally {
      setLoading(false)
    }
  }

  const handleSelectEvent = (eventId: string | null) => {
    setSelectedEventId(eventId)
    if (!eventId || !narrative) {
      setSelectedNode(null)
      return
    }
    const event = narrative.events.find((item: NarrativeEvent) => item.id === eventId)
    if (event) {
      setSelectedNode({
        id: event.id,
        type: 'eventNode',
        position: { x: 0, y: 0 },
        data: {
          kind: 'event',
          level: event.level,
          label: event.idea ?? 'Event',
          payload: event,
          summary: event.summary ?? undefined,
          eventType: event.type,
          version: event.version,
          idea: event.idea,
        },
      })
    }
  }

  const events: NarrativeEvent[] = narrative?.events ?? []

  return (
    <div className="app-shell">
      <ProjectToolbar
        projects={projects}
        projectName={projectName}
        versions={versions}
        version={version}
        latestVersion={latest}
        loading={loading}
        backendOk={backendOk}
        onProjectChange={setProjectName}
        onVersionChange={handleVersionChange}
        onRefresh={handleRefresh}
      />

      {error ? <div className="banner banner--error">{error}</div> : null}

      <main className="app-main app-main--reader">
        <aside className="reader-sidebar">
          <nav className="sidebar-tabs" aria-label="API panels">
            {SIDEBAR_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={`sidebar-tabs__btn ${sidebarTab === tab.id ? 'sidebar-tabs__btn--active' : ''}`}
                onClick={() => setSidebarTab(tab.id)}
                title={tab.tip}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          <div className="sidebar-panel">
            {sidebarTab === 'create' ? (
              <InitProjectPanel loading={loading} onCreate={handleCreateProject} />
            ) : null}
            {sidebarTab === 'workflow' ? (
              <WorkflowPanel
                storyName={projectName}
                storyState={storyState}
                loading={loading}
                onInject={handleInject}
                onHitl={handleHitl}
              />
            ) : null}
            {sidebarTab === 'timeline' ? (
              <NarrativeTimeline
                events={events}
                selectedEventId={selectedEventId}
                onSelectEvent={handleSelectEvent}
              />
            ) : null}
            {sidebarTab === 'state' ? (
              <StatePanel
                storyState={storyState}
                projectName={projectName}
                onRefresh={handleRefreshState}
                loading={loading}
              />
            ) : null}
            {sidebarTab === 'config' ? <ConfigPanel projectName={projectName} loading={loading} /> : null}
            {sidebarTab === 'level' ? (
              <LevelJsonPanel projectName={projectName} version={version} loading={loading} />
            ) : null}
          </div>
        </aside>

        <section className="canvas-column">
          {projectName && Object.keys(levelData).length > 0 ? (
            <StoryCanvas
              levelData={levelData}
              dirtyNodes={storyState?.dirty_nodes ?? []}
              events={events}
              highlightedEventId={selectedEventId}
              onSelectNode={setSelectedNode}
            />
          ) : (
            <div className="canvas-placeholder">
              <h2>Read your world as a graph</h2>
              <p>
                Use the <strong>Create</strong> tab to scaffold a project, or select an existing one.
                The graph shows all five levels with a causal timeline of how each simulation shaped
                the story.
              </p>
            </div>
          )}
        </section>

        <aside className="inspector-sidebar">
          <NodeDetailPanel node={selectedNode} />
        </aside>
      </main>
    </div>
  )
}

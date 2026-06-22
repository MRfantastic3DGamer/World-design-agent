import { useCallback, useEffect, useState } from 'react'
import type { Node } from '@xyflow/react'

import { api } from './api/client'
import { NarrativeTimeline } from './components/NarrativeTimeline'
import { NodeDetailPanel } from './components/NodeDetailPanel'
import { ProjectToolbar } from './components/ProjectToolbar'
import { StoryCanvas } from './components/StoryCanvas'
import { WorkflowPanel } from './components/WorkflowPanel'
import type { GraphNodeData, LevelData, NarrativeEvent, NarrativeTimeline as NarrativeData, StoryState } from './types'
import { latestVersion } from './utils/version'

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
    loadProjects().catch((err: Error) => setError(err.message))
  }, [loadProjects])

  useEffect(() => {
    if (!projectName) return
    setLoading(true)
    setError(null)
    loadProjectBundle(projectName)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false))
  }, [projectName, loadProjectBundle])

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
      await loadProjectBundle(projectName, version)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh')
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
  ) => {
    if (!projectName) return
    setLoading(true)
    setError(null)
    try {
      const state = await api.hitl(projectName, gate, {
        status,
        steering_prompt: steering,
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
        onProjectChange={setProjectName}
        onVersionChange={handleVersionChange}
        onRefresh={handleRefresh}
      />

      {error ? <div className="banner banner--error">{error}</div> : null}

      <main className="app-main app-main--reader">
        <aside className="reader-sidebar">
          <NarrativeTimeline
            events={events}
            selectedEventId={selectedEventId}
            onSelectEvent={handleSelectEvent}
          />
          <details className="workflow-drawer">
            <summary>Workflow controls</summary>
            <WorkflowPanel
              storyName={projectName}
              storyState={storyState}
              loading={loading}
              onInject={handleInject}
              onHitl={handleHitl}
            />
          </details>
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
                Select a project to explore all five levels — from axioms to nano detail — with a
                causal timeline showing how each simulation shaped the story.
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

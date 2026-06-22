import { useCallback, useEffect, useState } from 'react'
import type { Node } from '@xyflow/react'

import { api } from './api/client'
import { NodeDetailPanel } from './components/NodeDetailPanel'
import { StoryCanvas } from './components/StoryCanvas'
import { StoryToolbar } from './components/StoryToolbar'
import { WorkflowPanel } from './components/WorkflowPanel'
import type { GraphNodeData, LevelData, StoryState } from './types'

export default function App() {
  const [stories, setStories] = useState<string[]>([])
  const [storyName, setStoryName] = useState('')
  const [versions, setVersions] = useState<string[]>([])
  const [version, setVersion] = useState('')
  const [levelData, setLevelData] = useState<LevelData>({})
  const [storyState, setStoryState] = useState<StoryState | null>(null)
  const [selectedNode, setSelectedNode] = useState<Node<GraphNodeData> | null>(null)
  const [newStoryName, setNewStoryName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadStories = useCallback(async () => {
    const names = await api.listStories()
    setStories(names)
    return names
  }, [])

  const loadStoryBundle = useCallback(async (name: string, preferredVersion?: string) => {
    const [vers, state] = await Promise.all([
      api.listVersions(name),
      api.getStoryState(name),
    ])
    const activeVersion = preferredVersion ?? state.current_version ?? vers.at(-1) ?? 'v1'
    const levels = await api.getAllLevels(name, activeVersion)

    setVersions(vers)
    setVersion(activeVersion)
    setLevelData(levels)
    setStoryState(state)
  }, [])

  useEffect(() => {
    loadStories().catch((err: Error) => setError(err.message))
  }, [loadStories])

  useEffect(() => {
    if (!storyName) return
    setLoading(true)
    setError(null)
    loadStoryBundle(storyName)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false))
  }, [storyName, loadStoryBundle])

  const handleCreateStory = async () => {
    const name = newStoryName.trim()
    if (!name) return
    setLoading(true)
    setError(null)
    try {
      await api.initStory(name)
      await loadStories()
      setStoryName(name)
      setNewStoryName('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create story')
    } finally {
      setLoading(false)
    }
  }

  const handleRefresh = async () => {
    if (!storyName) return
    setLoading(true)
    setError(null)
    try {
      await loadStoryBundle(storyName, version)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh')
    } finally {
      setLoading(false)
    }
  }

  const handleVersionChange = async (nextVersion: string) => {
    if (!storyName) return
    setVersion(nextVersion)
    setLoading(true)
    setError(null)
    try {
      const levels = await api.getAllLevels(storyName, nextVersion)
      setLevelData(levels)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load version')
    } finally {
      setLoading(false)
    }
  }

  const handleInject = async (idea: string) => {
    if (!storyName) return
    setLoading(true)
    setError(null)
    try {
      const state = await api.injectIdea(storyName, idea)
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
    if (!storyName) return
    setLoading(true)
    setError(null)
    try {
      const state = await api.hitl(storyName, gate, {
        status,
        steering_prompt: steering,
      })
      setStoryState(state)
      await loadStoryBundle(storyName, state.current_version)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'HITL action failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="app-shell">
      <StoryToolbar
        stories={stories}
        storyName={storyName}
        versions={versions}
        version={version}
        storyState={storyState}
        loading={loading}
        newStoryName={newStoryName}
        onStoryChange={setStoryName}
        onVersionChange={handleVersionChange}
        onNewStoryNameChange={setNewStoryName}
        onCreateStory={handleCreateStory}
        onRefresh={handleRefresh}
      />

      {error ? <div className="banner banner--error">{error}</div> : null}

      <main className="app-main">
        <section className="canvas-column">
          {storyName && Object.keys(levelData).length > 0 ? (
            <StoryCanvas
              levelData={levelData}
              dirtyNodes={storyState?.dirty_nodes ?? []}
              onSelectNode={setSelectedNode}
            />
          ) : (
            <div className="canvas-placeholder">
              <h2>Story node graph</h2>
              <p>
                Pick a story to visualize all five worldbuilding levels — from axioms down to
                nano-scale environmental detail — as an interactive hierarchy.
              </p>
            </div>
          )}
        </section>

        <aside className="sidebar">
          <WorkflowPanel
            storyName={storyName}
            storyState={storyState}
            loading={loading}
            onInject={handleInject}
            onHitl={handleHitl}
          />
          <NodeDetailPanel node={selectedNode} />
        </aside>
      </main>
    </div>
  )
}

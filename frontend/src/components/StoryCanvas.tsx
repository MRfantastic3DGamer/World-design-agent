import { useCallback, useEffect, useMemo } from 'react'
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  useEdgesState,
  useNodesState,
  type Node,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import type { GraphNodeData, LevelData } from '../types'
import { buildStoryGraph } from '../utils/graphBuilder'
import { EntityNode } from './EntityNode'
import { LevelNode } from './LevelNode'

const nodeTypes = {
  levelNode: LevelNode,
  entityNode: EntityNode,
}

interface StoryCanvasProps {
  levelData: LevelData
  dirtyNodes?: string[]
  onSelectNode: (node: Node<GraphNodeData> | null) => void
}

export function StoryCanvas({ levelData, dirtyNodes = [], onSelectNode }: StoryCanvasProps) {
  const graph = useMemo(
    () => buildStoryGraph(levelData, dirtyNodes),
    [levelData, dirtyNodes],
  )

  const [nodes, setNodes, onNodesChange] = useNodesState(graph.nodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(graph.edges)

  useEffect(() => {
    setNodes(graph.nodes)
    setEdges(graph.edges)
  }, [graph, setNodes, setEdges])

  const onSelectionChange = useCallback(
    ({ nodes: selected }: { nodes: Node[] }) => {
      onSelectNode((selected[0] as Node<GraphNodeData> | undefined) ?? null)
    },
    [onSelectNode],
  )

  return (
    <div className="story-canvas">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onSelectionChange={onSelectionChange}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.2}
        maxZoom={1.8}
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={20} size={1} color="#1e293b" />
        <Controls showInteractive={false} />
        <MiniMap
          nodeColor={(node) => {
            const data = node.data as GraphNodeData
            if (data.kind === 'level') {
              return (data.color as string) ?? '#475569'
            }
            return '#334155'
          }}
          maskColor="rgba(2, 6, 23, 0.75)"
        />
      </ReactFlow>
    </div>
  )
}

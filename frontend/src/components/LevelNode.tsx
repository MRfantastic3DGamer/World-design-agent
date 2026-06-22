import { memo } from 'react'
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react'
import type { GraphNodeData } from '../types'

function LevelNodeComponent({ data }: NodeProps<Node<GraphNodeData>>) {
  return (
    <div
      className={`level-node ${data.isDirty ? 'level-node--dirty' : ''}`}
      style={{ borderColor: data.color ?? '#64748b' }}
    >
      <Handle type="target" position={Position.Top} className="handle" />
      <div className="level-node__badge" style={{ background: data.color ?? '#64748b' }}>
        L{data.level}
      </div>
      <div className="level-node__title">{data.label}</div>
      <div className="level-node__meta">{data.entityCount} entities</div>
      {data.isDirty ? <div className="level-node__flag">needs retcon</div> : null}
      <Handle type="source" position={Position.Bottom} className="handle" />
    </div>
  )
}

export const LevelNode = memo(LevelNodeComponent)

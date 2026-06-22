import { memo } from 'react'
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react'
import type { GraphNodeData } from '../types'
import { LEVEL_META } from '../types'

function EntityNodeComponent({ data, selected }: NodeProps<Node<GraphNodeData>>) {
  const color = LEVEL_META.find((meta) => meta.level === data.level)?.color ?? '#94a3b8'

  return (
    <div
      className={`entity-node ${selected ? 'entity-node--selected' : ''}`}
      style={{ borderTopColor: color }}
    >
      <Handle type="target" position={Position.Top} className="handle" />
      <div className="entity-node__field">{data.field}</div>
      <div className="entity-node__label">{data.label}</div>
    </div>
  )
}

export const EntityNode = memo(EntityNodeComponent)

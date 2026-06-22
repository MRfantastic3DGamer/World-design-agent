import { memo } from 'react'
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react'
import type { GraphNodeData } from '../types'
import { LEVEL_META } from '../types'

function EventNodeComponent({ data, selected }: NodeProps<Node<GraphNodeData>>) {
  const isRetcon = data.eventType === 'retcon_escalation'
  const levelLabel = LEVEL_META.find((meta) => meta.level === data.level)?.label ?? `L${data.level}`

  return (
    <div
      className={`event-node ${selected ? 'event-node--selected' : ''} ${isRetcon ? 'event-node--retcon' : ''}`}
      style={{ borderColor: (data.color as string) ?? '#a78bfa' }}
    >
      <Handle type="source" position={Position.Right} className="handle" />
      <Handle type="target" position={Position.Top} className="handle" />
      <div className="event-node__meta">
        <span>{data.version}</span>
        <span>→ {levelLabel}</span>
      </div>
      <div className="event-node__title">{data.label}</div>
      <div className="event-node__summary">{data.summary}</div>
    </div>
  )
}

export const EventNode = memo(EventNodeComponent)

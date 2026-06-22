import type { Node } from '@xyflow/react'
import type { GraphNodeData } from '../types'
import { LEVEL_META } from '../types'

interface NodeDetailPanelProps {
  node: Node<GraphNodeData> | null
}

export function NodeDetailPanel({ node }: NodeDetailPanelProps) {
  if (!node) {
    return (
      <aside className="detail-panel detail-panel--empty">
        <h2>Inspector</h2>
        <p>Select a timeline event, level, or entity on the canvas to read its details.</p>
      </aside>
    )
  }

  const meta = LEVEL_META.find((item) => item.level === node.data.level)
  const isEvent = node.data.kind === 'event'

  return (
    <aside className="detail-panel">
      <div className="detail-panel__header">
        <span
          className="detail-panel__badge"
          style={{ background: isEvent ? '#a78bfa' : meta?.color }}
        >
          {isEvent ? 'Event' : `L${node.data.level}`}
        </span>
        <h2>{node.data.label}</h2>
      </div>
      {isEvent && node.data.version ? (
        <div className="detail-panel__field">
          Version: <code>{node.data.version}</code>
        </div>
      ) : null}
      {node.data.field ? (
        <div className="detail-panel__field">
          Field: <code>{node.data.field}</code>
        </div>
      ) : null}
      {node.data.summary ? <p className="detail-panel__summary">{node.data.summary}</p> : null}
      <pre className="detail-panel__json">
        {JSON.stringify(node.data.payload ?? node.data, null, 2)}
      </pre>
    </aside>
  )
}

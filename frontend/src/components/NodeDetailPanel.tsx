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
        <p>Select a level or entity node on the canvas to inspect its lore payload.</p>
      </aside>
    )
  }

  const meta = LEVEL_META.find((item) => item.level === node.data.level)

  return (
    <aside className="detail-panel">
      <div className="detail-panel__header">
        <span className="detail-panel__badge" style={{ background: meta?.color }}>
          L{node.data.level}
        </span>
        <h2>{node.data.label}</h2>
      </div>
      {node.data.field ? (
        <div className="detail-panel__field">
          Field: <code>{node.data.field}</code>
        </div>
      ) : null}
      <pre className="detail-panel__json">
        {JSON.stringify(node.data.payload ?? node.data, null, 2)}
      </pre>
    </aside>
  )
}

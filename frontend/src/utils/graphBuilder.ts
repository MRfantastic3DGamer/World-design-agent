import type { Edge, Node } from '@xyflow/react'
import type { GraphNodeData, LevelData } from '../types'
import { LEVEL_META } from '../types'

const LEVEL_HEIGHT = 220
const ENTITY_WIDTH = 190
const ENTITY_GAP = 24
const CANVAS_CENTER_X = 520

function entityLabel(field: string, value: unknown, index: number): string {
  if (typeof value === 'string') {
    return value.length > 48 ? `${value.slice(0, 45)}…` : value
  }
  if (typeof value === 'object' && value !== null) {
    const record = value as Record<string, unknown>
    const name =
      record.name ?? record.title ?? record.id ?? record.location ?? record.faction
    if (typeof name === 'string') return name
    return `${field} #${index + 1}`
  }
  return `${field} #${index + 1}`
}

function summarize(value: unknown): string {
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

export function buildStoryGraph(
  levelData: LevelData,
  dirtyNodes: string[] = [],
): { nodes: Node<GraphNodeData>[]; edges: Edge[] } {
  const nodes: Node<GraphNodeData>[] = []
  const edges: Edge[] = []
  const dirtyLevels = new Set(
    dirtyNodes
      .filter((node) => node.startsWith('level_'))
      .map((node) => Number(node.split('_')[1])),
  )

  LEVEL_META.forEach((meta, levelIndex) => {
    const payload = levelData[meta.level] ?? {}
    const levelId = `level-${meta.level}`
    const entities = collectEntities(payload)

    nodes.push({
      id: levelId,
      type: 'levelNode',
      position: { x: CANVAS_CENTER_X - 120, y: levelIndex * LEVEL_HEIGHT },
      data: {
        kind: 'level',
        level: meta.level,
        label: meta.label,
        color: meta.color,
        isDirty: dirtyLevels.has(meta.level),
        payload,
        entityCount: entities.length,
      },
    })

    if (levelIndex > 0) {
      edges.push({
        id: `hierarchy-${levelIndex - 1}-${meta.level}`,
        source: `level-${levelIndex - 1}`,
        target: levelId,
        type: 'smoothstep',
        animated: dirtyLevels.has(levelIndex - 1) || dirtyLevels.has(meta.level),
        style: { stroke: '#64748b', strokeWidth: 2 },
        label: 'scopes',
      })
    }

    const rowWidth = entities.length * (ENTITY_WIDTH + ENTITY_GAP) - ENTITY_GAP
    const startX = CANVAS_CENTER_X - rowWidth / 2

    entities.forEach((entity, index) => {
      const entityId = `entity-${meta.level}-${entity.field}-${index}`
      nodes.push({
        id: entityId,
        type: 'entityNode',
        position: {
          x: startX + index * (ENTITY_WIDTH + ENTITY_GAP),
          y: levelIndex * LEVEL_HEIGHT + 88,
        },
        data: {
          kind: 'entity',
          level: meta.level,
          label: entity.label,
          field: entity.field,
          payload: entity.value,
          summary: summarize(entity.value),
        },
      })

      edges.push({
        id: `contains-${entityId}`,
        source: levelId,
        target: entityId,
        type: 'smoothstep',
        style: { stroke: meta.color, strokeWidth: 1.5, opacity: 0.7 },
      })
    })
  })

  return { nodes, edges }
}

function collectEntities(
  payload: Record<string, unknown>,
): Array<{ field: string; label: string; value: unknown }> {
  const entities: Array<{ field: string; label: string; value: unknown }> = []

  for (const [field, value] of Object.entries(payload)) {
    if (field === 'restricted_tags' || field === 'dirty_flags') continue

    if (Array.isArray(value)) {
      value.forEach((item, index) => {
        entities.push({
          field,
          label: entityLabel(field, item, index),
          value: item,
        })
      })
      continue
    }

    if (typeof value === 'object' && value !== null) {
      entities.push({
        field,
        label: field.replace(/_/g, ' '),
        value,
      })
    } else if (value !== undefined && value !== null && value !== '') {
      entities.push({
        field,
        label: String(value),
        value,
      })
    }
  }

  return entities
}

import type { Edge, Node } from '@xyflow/react'
import type { GraphNodeData, LevelData, NarrativeEvent } from '../types'
import { LEVEL_META } from '../types'

const LEVEL_HEIGHT = 220
const ENTITY_WIDTH = 190
const ENTITY_GAP = 24
const CANVAS_CENTER_X = 680
const TIMELINE_X = 40
const EVENT_GAP_Y = 130

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

function eventLabel(event: NarrativeEvent): string {
  if (event.type === 'retcon_escalation') {
    return `Retcon ↑ L${event.source_level ?? '?'}`
  }
  const idea = event.idea ?? 'Simulation cycle'
  return idea.length > 52 ? `${idea.slice(0, 49)}…` : idea
}

function eventSummary(event: NarrativeEvent): string {
  if (event.type === 'retcon_escalation') {
    return event.reason ?? 'Escalated for parent-level retcon'
  }
  return event.summary ?? 'Scene simulated and synthesized'
}

export function buildStoryGraph(
  levelData: LevelData,
  dirtyNodes: string[] = [],
  events: NarrativeEvent[] = [],
): { nodes: Node<GraphNodeData>[]; edges: Edge[] } {
  const nodes: Node<GraphNodeData>[] = []
  const edges: Edge[] = []
  const dirtyLevels = new Set(
    dirtyNodes
      .filter((node) => node.startsWith('level_'))
      .map((node) => Number(node.split('_')[1])),
  )

  const levelYOffset = events.length > 0 ? 20 : 0

  events.forEach((event, index) => {
    const eventId = event.id || `event-${index}`
    const targetMeta = LEVEL_META.find((meta) => meta.level === event.level)

    nodes.push({
      id: eventId,
      type: 'eventNode',
      position: { x: TIMELINE_X, y: index * EVENT_GAP_Y + 20 },
      data: {
        kind: 'event',
        level: event.level,
        label: eventLabel(event),
        summary: eventSummary(event),
        eventType: event.type,
        version: event.version,
        idea: event.idea,
        payload: event,
        color: event.type === 'retcon_escalation' ? '#f87171' : '#a78bfa',
      },
    })

    if (index > 0) {
      const prevId = events[index - 1].id || `event-${index - 1}`
      edges.push({
        id: `then-${prevId}-${eventId}`,
        source: prevId,
        target: eventId,
        type: 'smoothstep',
        label: 'then',
        style: { stroke: '#94a3b8', strokeWidth: 1.5 },
      })
    }

    edges.push({
      id: `caused-${eventId}-level-${event.level}`,
      source: eventId,
      target: `level-${event.level}`,
      type: 'smoothstep',
      animated: true,
      label: event.type === 'retcon_escalation' ? 'retcon' : 'shaped',
      style: {
        stroke: targetMeta?.color ?? '#a78bfa',
        strokeWidth: 2,
        strokeDasharray: event.type === 'retcon_escalation' ? '6 4' : undefined,
      },
    })
  })

  LEVEL_META.forEach((meta, levelIndex) => {
    const payload = levelData[meta.level] ?? {}
    const levelId = `level-${meta.level}`
    const entities = collectEntities(payload)

    nodes.push({
      id: levelId,
      type: 'levelNode',
      position: { x: CANVAS_CENTER_X - 120, y: levelIndex * LEVEL_HEIGHT + levelYOffset },
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
          y: levelIndex * LEVEL_HEIGHT + 88 + levelYOffset,
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
    if (
      field === 'restricted_tags' ||
      field === 'dirty_flags' ||
      field === 'simulation_history'
    ) {
      continue
    }

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

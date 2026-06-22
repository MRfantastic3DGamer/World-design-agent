import { useEffect, useState } from 'react'

import { api } from '../api/client'
import {
  DEFAULT_LEVEL_PAYLOADS,
  DEFAULT_STORY_CONFIG,
  LEVEL_HELP,
} from '../constants/defaults'
import { LEVEL_META } from '../types'
import { FieldLabel } from './HelpTip'

export interface InitProjectPayload {
  story_name: string
  config?: Record<string, unknown>
  initial_levels?: Record<number, Record<string, unknown>>
}

interface InitProjectPanelProps {
  loading: boolean
  onCreate: (payload: InitProjectPayload) => Promise<void>
}

function stringify(value: unknown): string {
  return JSON.stringify(value, null, 2)
}

function parseJson(text: string, label: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(text) as unknown
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      throw new Error(`${label} must be a JSON object`)
    }
    return parsed as Record<string, unknown>
  } catch (err) {
    if (err instanceof SyntaxError) {
      throw new Error(`${label} contains invalid JSON`)
    }
    throw err
  }
}

export function InitProjectPanel({ loading, onCreate }: InitProjectPanelProps) {
  const [storyName, setStoryName] = useState('')
  const [configText, setConfigText] = useState(stringify(DEFAULT_STORY_CONFIG))
  const [useCustomConfig, setUseCustomConfig] = useState(false)
  const [useCustomLevels, setUseCustomLevels] = useState(false)
  const [levelTexts, setLevelTexts] = useState<Record<number, string>>(() =>
    Object.fromEntries(
      LEVEL_META.map((meta) => [meta.level, stringify(DEFAULT_LEVEL_PAYLOADS[meta.level])]),
    ),
  )
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    api
      .getDefaults()
      .then((defaults) => {
        setConfigText(stringify(defaults.config))
        setLevelTexts(
          Object.fromEntries(
            LEVEL_META.map((meta) => [meta.level, stringify(defaults.levels[meta.level] ?? {})]),
          ),
        )
      })
      .catch(() => {
        /* keep bundled defaults */
      })
  }, [])

  const handleSubmit = async () => {
    setFormError(null)
    const trimmed = storyName.trim()
    if (!trimmed) {
      setFormError('Project name is required.')
      return
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(trimmed)) {
      setFormError('Project name may only contain letters, numbers, underscores, and hyphens.')
      return
    }

    try {
      const payload: InitProjectPayload = { story_name: trimmed }
      if (useCustomConfig) {
        payload.config = parseJson(configText, 'LLM config')
      }
      if (useCustomLevels) {
        const initial_levels: Record<number, Record<string, unknown>> = {}
        for (const meta of LEVEL_META) {
          initial_levels[meta.level] = parseJson(
            levelTexts[meta.level],
            `Level ${meta.level} data`,
          ) as Record<string, unknown>
        }
        payload.initial_levels = initial_levels
      }
      await onCreate(payload)
      setStoryName('')
      setFormError(null)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to create project')
    }
  }

  return (
    <section className="panel init-panel">
      <h3>Create project</h3>
      <p className="panel__intro">
        Scaffolds storage, LLM routing config, and optional seed data for all five levels.
      </p>

      <FieldLabel
        label="Project name"
        htmlFor="init-story-name"
        tip="Unique identifier used in API paths. Letters, numbers, underscores, and hyphens only."
        helper="Maps to POST /api/story/init → story_name"
      >
        <input
          id="init-story-name"
          type="text"
          value={storyName}
          onChange={(e) => setStoryName(e.target.value)}
          placeholder="my_world"
        />
      </FieldLabel>

      <label className="checkbox-row">
        <input
          type="checkbox"
          checked={useCustomConfig}
          onChange={(e) => setUseCustomConfig(e.target.checked)}
        />
        <span>Custom LLM config</span>
        <span className="checkbox-row__tip">
          Override provider/model mapping for router, orchestrators, actors, and evaluator.
        </span>
      </label>

      {useCustomConfig ? (
        <FieldLabel
          label="LLM config (JSON)"
          htmlFor="init-config"
          tip="Defines which models power routing, orchestration, simulation, and evaluation."
          helper="Leave unchecked to use server defaults."
        >
          <textarea
            id="init-config"
            rows={8}
            value={configText}
            onChange={(e) => setConfigText(e.target.value)}
          />
          <button
            type="button"
            className="link-btn"
            onClick={() => setConfigText(stringify(DEFAULT_STORY_CONFIG))}
          >
            Reset config to defaults
          </button>
        </FieldLabel>
      ) : null}

      <label className="checkbox-row">
        <input
          type="checkbox"
          checked={useCustomLevels}
          onChange={(e) => setUseCustomLevels(e.target.checked)}
        />
        <span>Seed initial level JSON</span>
        <span className="checkbox-row__tip">
          Pre-populate axioms through nano data before the first simulation cycle.
        </span>
      </label>

      {useCustomLevels ? (
        <div className="init-panel__levels">
          {LEVEL_META.map((meta) => (
            <details key={meta.level} className="level-editor" open={meta.level === 0}>
              <summary>
                L{meta.level} {meta.label}
              </summary>
              <FieldLabel
                label={`Level ${meta.level} JSON`}
                htmlFor={`init-level-${meta.level}`}
                tip={LEVEL_HELP[meta.level]}
                helper={`Maps to initial_levels[${meta.level}] in POST /api/story/init`}
              >
                <textarea
                  id={`init-level-${meta.level}`}
                  rows={6}
                  value={levelTexts[meta.level]}
                  onChange={(e) =>
                    setLevelTexts((current) => ({ ...current, [meta.level]: e.target.value }))
                  }
                />
              </FieldLabel>
            </details>
          ))}
        </div>
      ) : null}

      {formError ? <p className="form-error">{formError}</p> : null}

      <button
        type="button"
        className="panel__primary"
        disabled={loading || !storyName.trim()}
        onClick={handleSubmit}
      >
        Create project
      </button>
    </section>
  )
}

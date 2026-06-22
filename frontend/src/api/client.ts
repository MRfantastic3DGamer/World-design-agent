import type { LevelData, NarrativeTimeline, StoryConfig, StoryState } from '../types'

const jsonHeaders = { 'Content-Type': 'application/json' }

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, init)
  if (!response.ok) {
    const detail = await response.text()
    throw new Error(detail || `Request failed: ${response.status}`)
  }
  return response.json() as Promise<T>
}

export interface InitStoryBody {
  story_name: string
  config?: Record<string, unknown>
  initial_levels?: Record<number, Record<string, unknown>>
}

export const api = {
  health: () => request<{ status: string }>('/health'),

  getDefaults: () =>
    request<{ config: StoryConfig; levels: LevelData; level_names: Record<number, string> }>(
      '/api/defaults',
    ),

  listProjects: () => request<string[]>('/api/stories'),

  listStories: () => request<string[]>('/api/stories'),

  listVersions: (storyName: string) =>
    request<string[]>(`/api/story/${encodeURIComponent(storyName)}/versions`),

  initStory: (body: InitStoryBody) =>
    request<StoryState>('/api/story/init', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify(body),
    }),

  getStoryConfig: (storyName: string) =>
    request<StoryConfig>(`/api/story/${encodeURIComponent(storyName)}/config`),

  getStoryState: (storyName: string) =>
    request<StoryState>(`/api/story/${encodeURIComponent(storyName)}/state`),

  getAllLevels: (storyName: string, version: string) =>
    request<LevelData>(
      `/api/story/${encodeURIComponent(storyName)}/versions/${encodeURIComponent(version)}/all`,
    ),

  getLevel: (storyName: string, version: string, level: number) =>
    request<Record<string, unknown>>(
      `/api/story/${encodeURIComponent(storyName)}/versions/${encodeURIComponent(version)}/${level}`,
    ),

  getNarrative: (storyName: string, version: string) =>
    request<NarrativeTimeline>(
      `/api/story/${encodeURIComponent(storyName)}/versions/${encodeURIComponent(version)}/narrative`,
    ),

  injectIdea: (storyName: string, idea: string) =>
    request<StoryState>(`/api/story/${encodeURIComponent(storyName)}/inject`, {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ idea }),
    }),

  hitl: (
    storyName: string,
    gate: 'routing' | 'presim' | 'postsim',
    body: {
      status: 'approved' | 'rejected' | 'modify'
      steering_prompt?: string
      manual_override_data?: Record<string, unknown>
    },
  ) =>
    request<StoryState>(`/api/story/${encodeURIComponent(storyName)}/hitl/${gate}`, {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify(body),
    }),
}

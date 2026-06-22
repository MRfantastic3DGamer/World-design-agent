export const DEFAULT_STORY_CONFIG = {
  router: { provider: 'openai', model: 'gpt-4o' },
  orchestrators: {
    level_0_to_2: { provider: 'anthropic', model: 'claude-3-5-sonnet-20240620' },
    level_3_to_4: { provider: 'ollama', model: 'llama3:8b' },
  },
  simulation_actors: { provider: 'ollama', model: 'gemma2:27b' },
  simulation_directors: { provider: 'ollama', model: 'mistral:instruct' },
  evaluator: { provider: 'openai', model: 'gpt-4o-mini' },
}

export const DEFAULT_LEVEL_PAYLOADS: Record<number, Record<string, unknown>> = {
  0: {
    physical_laws: [],
    magic_rules: [],
    ecosystem_limits: [],
    restricted_tags: ['RESTRICTED_TECH', 'MAGIC_DEAD_ZONE'],
  },
  1: {
    global_history: [],
    geopolitics: [],
    geography: [],
    cataclysms: [],
  },
  2: {
    factions: [],
    cultures: [],
    resources: [],
    ideologies: [],
    restricted_tags: ['RESTRICTED_TECH', 'MAGIC_DEAD_ZONE'],
  },
  3: {
    locations: [],
    daily_life: [],
    trade: [],
    technology: [],
    personas: [],
  },
  4: {
    environmental_details: [],
    wear_and_tear: [],
    physical_decay: [],
  },
}

export const LEVEL_HELP: Record<number, string> = {
  0: 'Hard physical laws, magic rules, ecosystem limits, and restricted tags.',
  1: 'Global history, cataclysms, geopolitics, and geography.',
  2: 'Factions, cultures, resources, ideologies, and restricted tags.',
  3: 'Lived experience: locations, daily life, trade, tech, and personas.',
  4: 'Environmental storytelling: wear-and-tear and physical decay.',
}

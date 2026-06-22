from pathlib import Path

STORAGE_ROOT = Path(__file__).resolve().parent.parent.parent / "storage"
BAKE_INTERVAL = 10
LEVEL_NAMES = {
    0: "level_0_axioms",
    1: "level_1_macro",
    2: "level_2_meso",
    3: "level_3_micro",
    4: "level_4_nano",
}
DEFAULT_STORY_CONFIG = {
    "router": {"provider": "openai", "model": "gpt-4o"},
    "orchestrators": {
        "level_0_to_2": {
            "provider": "anthropic",
            "model": "claude-3-5-sonnet-20240620",
        },
        "level_3_to_4": {"provider": "ollama", "model": "llama3:8b"},
    },
    "simulation_actors": {"provider": "ollama", "model": "gemma2:27b"},
    "simulation_directors": {"provider": "ollama", "model": "mistral:instruct"},
    "evaluator": {"provider": "openai", "model": "gpt-4o-mini"},
}

DEFAULT_LEVEL_PAYLOADS: dict[int, dict] = {
    0: {
        "physical_laws": [],
        "magic_rules": [],
        "ecosystem_limits": [],
        "restricted_tags": ["RESTRICTED_TECH", "MAGIC_DEAD_ZONE"],
    },
    1: {
        "global_history": [],
        "geopolitics": [],
        "geography": [],
        "cataclysms": [],
    },
    2: {
        "factions": [],
        "cultures": [],
        "resources": [],
        "ideologies": [],
        "restricted_tags": ["RESTRICTED_TECH", "MAGIC_DEAD_ZONE"],
    },
    3: {
        "locations": [],
        "daily_life": [],
        "trade": [],
        "technology": [],
        "personas": [],
    },
    4: {
        "environmental_details": [],
        "wear_and_tear": [],
        "physical_decay": [],
    },
}

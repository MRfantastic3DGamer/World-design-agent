import os
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

os.environ["WORLD_ENGINE_MOCK_LLM"] = "1"

from app.main import app
from app.persistence import StorageManager


@pytest.fixture()
def client(tmp_path: Path):
  os.environ["WORLD_ENGINE_MOCK_LLM"] = "1"
  import app.config as config
  import app.main as main
  import app.services.session as session

  config.STORAGE_ROOT = tmp_path / "storage"
  main.storage = StorageManager(config.STORAGE_ROOT)
  session.registry.set_storage(main.storage)
  session.registry._workflows.clear()
  session.registry._idle_states.clear()
  return TestClient(app)


def test_narrative_timeline_endpoint(client: TestClient):
  client.post("/api/story/init", json={"story_name": "timeline_story"})
  response = client.get("/api/story/timeline_story/versions/v1/narrative")
  assert response.status_code == 200
  body = response.json()
  assert body["selected_version"] == "v1"
  assert body["latest_version"] == "v1"
  assert body["events"] == []


def test_init_story(client: TestClient):
  response = client.post("/api/story/init", json={"story_name": "test_world"})
  assert response.status_code == 200
  body = response.json()
  assert body["story_name"] == "test_world"
  assert body["current_version"] == "v1"
  assert body["hitl_status"] == "IDLE"


def test_full_hitl_flow(client: TestClient):
  client.post("/api/story/init", json={"story_name": "saga"})

  injected = client.post("/api/story/saga/inject", json={"idea": "A paranoid merchant in the market square."})
  assert injected.status_code == 200
  assert injected.json()["hitl_status"] == "AWAITING_ROUTING"

  routing = client.post(
    "/api/story/saga/hitl/routing",
    json={"status": "approved"},
  )
  assert routing.status_code == 200
  assert routing.json()["hitl_status"] == "AWAITING_PRE_SIM"

  presim = client.post(
    "/api/story/saga/hitl/presim",
    json={"status": "approved", "steering_prompt": "Make the merchant more paranoid."},
  )
  assert presim.status_code == 200
  assert presim.json()["hitl_status"] == "AWAITING_POST_SIM"
  assert presim.json()["simulation_output"] is not None

  postsim = client.post(
    "/api/story/saga/hitl/postsim",
    json={"status": "approved"},
  )
  assert postsim.status_code == 200
  assert postsim.json()["hitl_status"] == "APPROVED"
  assert postsim.json()["current_version"] == "v2"


def test_storage_refs_and_baking(tmp_path: Path):
  storage = StorageManager(tmp_path)
  version = storage.init_story("refs_story")
  level0 = storage.read_level("refs_story", version, 0)

  v2 = storage.create_next_version("refs_story", version)
  storage.write_level_with_refs("refs_story", v2, 0, level0, previous_version=version)

  raw = storage._read_json_locked(storage._version_dir("refs_story", v2) / "level_0_axioms.json")
  assert "_ref" in raw
  resolved = storage.read_level("refs_story", v2, 0)
  assert resolved == level0

  changed = storage.read_level("refs_story", version, 0)
  changed["physical_laws"].append("Gravity is constant")
  current = version
  for num in range(2, 11):
    nxt = f"v{num}"
    storage.create_next_version("refs_story", current)
    storage.write_level_with_refs("refs_story", nxt, 0, changed, previous_version=current)
    current = nxt
  storage.bake_if_needed("refs_story", current)
  baked_raw = storage._read_json_locked(storage._version_dir("refs_story", "v10") / "level_0_axioms.json")
  assert "_ref" not in baked_raw
  assert "Gravity is constant" in baked_raw["physical_laws"]


def test_backprop_restricted_tag_violation():
  from app.backprop.engine import BackPropagationEngine

  engine = BackPropagationEngine()
  level_data = {
    0: {"restricted_tags": ["RESTRICTED_TECH"]},
    2: {"restricted_tags": ["MAGIC_DEAD_ZONE"]},
  }
  simulation_output = {"narrative_log": ["The hero deployed [RESTRICTED_TECH] in the square."]}
  result = engine.evaluate(simulation_output, level_data, target_level=3)
  assert result["systemic_violation"] is True
  assert result["dirty_nodes"]


def test_actor_duplicate_intention_forces_change():
  from app.agents.llm import LLMGateway
  from app.agents.simulation import ActorDirectorEngine, BDIProfile

  class FixedFailLLM(LLMGateway):
    def __init__(self):
      super().__init__({"provider": "mock", "model": "mock"})

    def complete_json(self, system_prompt: str, user_prompt: str):
      if "different intention" in user_prompt.lower():
        return {"intention": "Try another route", "action": "circle around", "consequential": True}
      return {"intention": "Pick the lock", "action": "pick the lock", "consequential": True}

  class DirectorLLM(LLMGateway):
    def __init__(self):
      super().__init__({"provider": "mock", "model": "mock"})

    def complete_json(self, system_prompt: str, user_prompt: str):
      return {"resolution": "Failure", "environment_changes": [], "narrative": "It fails."}

  engine = ActorDirectorEngine(FixedFailLLM(), DirectorLLM(), time_units=4, rng=__import__("random").Random(0))
  persona = BDIProfile(
    beliefs=["Locked doors block me"],
    desires=["Get inside"],
    intentions=["Pick the lock"],
    stats={"agility": 0.1, "charisma": 0.1, "strength": 0.1},
  )
  result = engine.run_simulation(persona, ["A rainy market square"])
  intentions = [turn["intention"] for turn in result["turns"]]
  assert "Try another route" in intentions

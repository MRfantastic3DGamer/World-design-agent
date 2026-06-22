"""LangGraph node implementations for the worldbuilding workflow."""

from __future__ import annotations

from typing import Any, Dict

from app.agents.llm import LLMGateway
from app.agents.simulation import ActorDirectorEngine, BDIProfile
from app.backprop.engine import BackPropagationEngine
from app.models.state import WorldState
from app.rag.vector_store import LoreVectorStore
from app.persistence import StorageManager


class GraphRuntime:
  """Shared services injected into LangGraph nodes."""

  def __init__(self, storage: StorageManager | None = None) -> None:
    self.storage = storage or StorageManager()
    self.vector_store = LoreVectorStore(self.storage.root)
    self.backprop = BackPropagationEngine()


def router_node(state: WorldState, runtime: GraphRuntime) -> Dict[str, Any]:
  story_name = state["story_name"]
  config = runtime.storage.read_config(story_name)
  llm = LLMGateway(config["router"])

  idea = state.get("user_injected_idea") or ""
  system_prompt = (
    "You are the Router node for a hierarchical worldbuilding engine. "
    "Analyze the user idea and choose target_level 0-4. "
    "Return JSON: target_level (int), rationale (str)."
  )
  user_prompt = f"User idea:\n{idea}"
  result = llm.complete_json(system_prompt, user_prompt)

  target_level = int(result.get("target_level", 3))
  target_level = max(0, min(4, target_level))

  return {
    "target_level": target_level,
    "routing_rationale": result.get("rationale", ""),
    "hitl_status": "AWAITING_ROUTING",
  }


def orchestrator_setup_node(state: WorldState, runtime: GraphRuntime) -> Dict[str, Any]:
  story_name = state["story_name"]
  version = state["current_version"]
  config = runtime.storage.read_config(story_name)
  target_level = state.get("target_level") or 3

  level_data = runtime.storage.read_all_levels(story_name, version)
  runtime.vector_store.index_story_levels(story_name, version, level_data)

  orchestrator_key = "level_3_to_4" if target_level >= 3 else "level_0_to_2"
  llm = LLMGateway(config["orchestrators"][orchestrator_key])

  steering = state.get("hitl_feedback")
  manual_override = state.get("manual_override_data") or {}

  actor_prompt = (
    "Actor system prompt for persona simulation. "
    "Emphasize grounded actions and BDI-consistent behavior."
  )
  director_prompt = (
    "Director system prompt for environment/NPC resolution. "
    "Enforce world rules and consequences."
  )

  if steering and state.get("hitl_status") == "AWAITING_PRE_SIM":
    rewrite = llm.complete_json(
      "Rewrite Actor/Director setup prompts based on user steering.",
      f"Steering prompt: {steering}\n"
      f"Current actor prompt: {actor_prompt}\n"
      f"Current director prompt: {director_prompt}\n"
      "Return JSON: actor_prompt, director_prompt.",
    )
    actor_prompt = rewrite.get("actor_prompt", actor_prompt)
    director_prompt = rewrite.get("director_prompt", director_prompt)

  persona = _default_persona(level_data, manual_override)
  lore_context: list[str] = []
  if target_level >= 3:
    lore_context = runtime.vector_store.query_relevant_lore(
      story_name,
      location=persona.location,
      faction=persona.faction,
    )

  simulation_configs = state.get("simulation_configs") or {}
  simulation_configs[target_level] = {
    "actor_prompt": actor_prompt,
    "director_prompt": director_prompt,
    "persona": persona.__dict__,
    "lore_context": lore_context,
    "pov_count": _pov_count_for_level(target_level),
  }

  return {
    "level_data": level_data,
    "simulation_configs": simulation_configs,
    "orchestrator_context": simulation_configs[target_level],
    "hitl_status": "AWAITING_PRE_SIM",
  }


def simulation_node(state: WorldState, runtime: GraphRuntime) -> Dict[str, Any]:
  story_name = state["story_name"]
  config = runtime.storage.read_config(story_name)
  target_level = state.get("target_level") or 3
  sim_config = (state.get("simulation_configs") or {}).get(target_level, {})

  if target_level < 3:
    llm = LLMGateway(config["orchestrators"]["level_0_to_2"])
    idea = state.get("user_injected_idea") or ""
    result = llm.complete_json(
      "Simulate world changes for levels 0-2. Return JSON with summary and proposed_changes.",
      f"Target level: {target_level}\nIdea: {idea}",
    )
    return {"simulation_output": result, "hitl_status": "AWAITING_POST_SIM"}

  actor_llm = LLMGateway(config["simulation_actors"])
  director_llm = LLMGateway(config["simulation_directors"])
  engine = ActorDirectorEngine(actor_llm, director_llm)

  persona_data = sim_config.get("persona", {})
  persona = BDIProfile(
    beliefs=persona_data.get("beliefs", ["The world is dangerous"]),
    desires=persona_data.get("desires", ["Survive and prosper"]),
    intentions=persona_data.get("intentions", ["Observe surroundings"]),
    stats=persona_data.get("stats", {"agility": 0.5, "charisma": 0.5, "strength": 0.5}),
    location=persona_data.get("location", "market_square"),
    faction=persona_data.get("faction", "independent"),
  )

  output = engine.run_simulation(
    persona,
    sim_config.get("lore_context", []),
    steering_prompt=state.get("hitl_feedback"),
    scene_prompt=state.get("user_injected_idea"),
  )
  return {"simulation_output": output, "hitl_status": "AWAITING_POST_SIM"}


def impact_decay_node(state: WorldState, runtime: GraphRuntime) -> Dict[str, Any]:
  target_level = state.get("target_level") or 3
  level_data = state.get("level_data") or runtime.storage.read_all_levels(
    state["story_name"], state["current_version"]
  )
  simulation_output = state.get("simulation_output") or {}
  evaluation = runtime.backprop.evaluate(simulation_output, level_data, target_level)

  dirty_nodes = list(state.get("dirty_nodes") or [])
  for node in evaluation.get("dirty_nodes", []):
    if node not in dirty_nodes:
      dirty_nodes.append(node)

  return {"backpropagation": evaluation, "dirty_nodes": dirty_nodes}


def synthesis_node(state: WorldState, runtime: GraphRuntime) -> Dict[str, Any]:
  story_name = state["story_name"]
  config = runtime.storage.read_config(story_name)
  llm = LLMGateway(config["evaluator"])

  steering = state.get("hitl_feedback")
  simulation_output = state.get("simulation_output") or {}
  backprop = state.get("backpropagation") or {}

  if steering and state.get("hitl_status") == "AWAITING_POST_SIM":
    rewritten = llm.complete_json(
      "Rewrite synthesized output to match user steering while preserving facts.",
      f"Steering: {steering}\nSimulation: {simulation_output}",
    )
    synthesis = rewritten
  else:
    synthesis = llm.complete_json(
      "Compile final synthesis for the worldbuilding cycle. Return JSON: summary, facts (list), tone.",
      f"Simulation output: {simulation_output}\nBack-propagation: {backprop}",
    )

  return {"synthesis_output": synthesis, "hitl_status": "AWAITING_POST_SIM"}


def _default_persona(level_data: Dict[int, Any], manual_override: Dict[str, Any]) -> BDIProfile:
  personas = []
  level3 = level_data.get(3) or {}
  if isinstance(level3, dict):
    personas = level3.get("personas") or []

  base = personas[0] if personas and isinstance(personas[0], dict) else {}
  return BDIProfile(
    beliefs=manual_override.get("beliefs") or base.get("beliefs", ["Merchants are cautious"]),
    desires=manual_override.get("desires") or base.get("desires", ["Make a profitable trade"]),
    intentions=manual_override.get("intentions") or base.get("intentions", ["Survey the market"]),
    stats=manual_override.get("stats") or base.get("stats", {"agility": 0.5, "charisma": 0.6, "strength": 0.4}),
    location=manual_override.get("location") or base.get("location", "market_square"),
    faction=manual_override.get("faction") or base.get("faction", "independent"),
  )


def _pov_count_for_level(level: int) -> int:
  return {0: 0, 1: 2, 2: 4, 3: 10, 4: 25}.get(level, 1)

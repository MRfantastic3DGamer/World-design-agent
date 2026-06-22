"""Actor-Director simulation engine for Level 3/4 character scenes."""

from __future__ import annotations

import random
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from app.agents.llm import LLMGateway


@dataclass
class BDIProfile:
  beliefs: List[str]
  desires: List[str]
  intentions: List[str]
  stats: Dict[str, float] = field(default_factory=lambda: {"agility": 0.5, "charisma": 0.5, "strength": 0.5})
  location: str = "unknown"
  faction: str = "unknown"


@dataclass
class SimulationTurn:
  turn: int
  intention: str
  action: str
  roll: Optional[float]
  success: Optional[bool]
  director_resolution: str
  time_units_remaining: int


class ActorDirectorEngine:
  """Runs adversarial Actor/Director cycles with clock and retry deadlock prevention."""

  def __init__(
    self,
    actor_llm: LLMGateway,
    director_llm: LLMGateway,
    *,
    time_units: int = 5,
    max_duplicate_retries: int = 2,
    rng: Optional[random.Random] = None,
  ) -> None:
    self.actor_llm = actor_llm
    self.director_llm = director_llm
    self.initial_time_units = time_units
    self.max_duplicate_retries = max_duplicate_retries
    self.rng = rng or random.Random()

  def run_simulation(
    self,
    persona: BDIProfile,
    lore_context: List[str],
    steering_prompt: Optional[str] = None,
    scene_prompt: Optional[str] = None,
  ) -> Dict[str, Any]:
    time_remaining = self.initial_time_units
    turns: List[SimulationTurn] = []
    intention_failures: Dict[str, int] = {}
    forced_new_intention = False
    narrative_log: List[str] = []

    actor_system = self._build_actor_system(persona, steering_prompt)
    director_system = self._build_director_system(lore_context, steering_prompt)

    while time_remaining > 0:
      intention_payload = self._actor_intention(
        actor_system,
        persona,
        time_remaining,
        turns,
        forced_new_intention=forced_new_intention,
        scene_prompt=scene_prompt,
      )
      forced_new_intention = False

      intention = intention_payload.get("intention", "wait and observe")
      action = intention_payload.get("action", intention)
      consequential = bool(intention_payload.get("consequential", False))

      roll: Optional[float] = None
      success: Optional[bool] = None
      outcome_constraint = ""
      if consequential:
        roll, success = self._roll_outcome(persona.stats, action)
        outcome_constraint = (
          f"PROGRAMMATIC OUTCOME (immutable): roll={roll:.3f}, success={success}. "
          "You must respect this outcome in your resolution."
        )

      director_payload = self._director_resolve(
        director_system,
        persona,
        action,
        intention,
        outcome_constraint,
        time_remaining,
      )
      resolution = director_payload.get("resolution", "The scene continues.")
      narrative = director_payload.get("narrative", resolution)
      narrative_log.append(narrative)

      turns.append(
        SimulationTurn(
          turn=len(turns) + 1,
          intention=intention,
          action=action,
          roll=roll,
          success=success,
          director_resolution=resolution,
          time_units_remaining=time_remaining - 1,
        )
      )

      if consequential and success is False:
        intention_failures[intention] = intention_failures.get(intention, 0) + 1
        if intention_failures[intention] >= self.max_duplicate_retries:
          forced_new_intention = True
          intention_failures[intention] = 0

      time_remaining -= 1

    if time_remaining <= 0 and turns:
      conclusion = self._force_conclusion(director_system, persona, turns)
      narrative_log.append(conclusion.get("narrative", "Time expired; scene concludes."))

    return {
      "persona": {
        "location": persona.location,
        "faction": persona.faction,
        "beliefs": persona.beliefs,
        "desires": persona.desires,
      },
      "turns": [turn.__dict__ for turn in turns],
      "narrative_log": narrative_log,
      "time_units_exhausted": True,
    }

  def _build_actor_system(self, persona: BDIProfile, steering_prompt: Optional[str]) -> str:
    base = (
      "You are the Actor (Persona Agent). Governed by BDI: Beliefs, Desires, Intentions. "
      "You may only attempt actions, never resolve outcomes. "
      f"Location: {persona.location}. Faction: {persona.faction}. "
      f"Beliefs: {persona.beliefs}. Desires: {persona.desires}."
    )
    if steering_prompt:
      base += f"\nUser steering: {steering_prompt}"
    return base

  def _build_director_system(self, lore_context: List[str], steering_prompt: Optional[str]) -> str:
    base = (
      "You are the Director. Control environment and NPC reactions. "
      "Resolve Actor attempts without granting the Actor narrative authority. "
      f"Relevant lore:\n- " + "\n- ".join(lore_context[:10])
    )
    if steering_prompt:
      base += f"\nUser steering: {steering_prompt}"
    return base

  def _actor_intention(
    self,
    system_prompt: str,
    persona: BDIProfile,
    time_remaining: int,
    turns: List[SimulationTurn],
    *,
    forced_new_intention: bool,
    scene_prompt: Optional[str],
  ) -> Dict[str, Any]:
    history = "\n".join(f"- {t.intention} -> {t.director_resolution}" for t in turns[-3:])
    constraint = ""
    if forced_new_intention:
      constraint = (
        "You failed the same intention twice. You MUST generate a different intention."
      )
    user_prompt = (
      f"Time units remaining: {time_remaining}. Scene: {scene_prompt or 'ongoing simulation'}.\n"
      f"Recent history:\n{history or 'None'}\n{constraint}\n"
      "Return JSON: intention, action, consequential (bool)."
    )
    return self.actor_llm.complete_json(system_prompt, user_prompt)

  def _director_resolve(
    self,
    system_prompt: str,
    persona: BDIProfile,
    action: str,
    intention: str,
    outcome_constraint: str,
    time_remaining: int,
  ) -> Dict[str, Any]:
    user_prompt = (
      f"Persona at {persona.location} attempts: {action}\n"
      f"Intention: {intention}\nTime remaining: {time_remaining}\n"
      f"{outcome_constraint}\n"
      "Return JSON: resolution, environment_changes (list), narrative."
    )
    return self.director_llm.complete_json(system_prompt, user_prompt)

  def _roll_outcome(self, stats: Dict[str, float], action: str) -> tuple[float, bool]:
    action_lower = action.lower()
    if any(word in action_lower for word in ("talk", "persuade", "negotiate", "charm")):
      stat = stats.get("charisma", 0.5)
    elif any(word in action_lower for word in ("run", "jump", "dodge", "sneak")):
      stat = stats.get("agility", 0.5)
    else:
      stat = stats.get("strength", 0.5)

    probability = min(0.95, max(0.05, 0.35 + stat * 0.5))
    roll = self.rng.random()
    return roll, roll <= probability

  def _force_conclusion(
    self,
    system_prompt: str,
    persona: BDIProfile,
    turns: List[SimulationTurn],
  ) -> Dict[str, Any]:
    user_prompt = (
      f"Time units have reached 0 for persona at {persona.location}. "
      "Force a narrative conclusion to the scene. Return JSON with narrative and resolution."
    )
    return self.director_llm.complete_json(system_prompt, user_prompt)

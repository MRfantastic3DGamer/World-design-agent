"""Story session registry and workflow state tracking."""

from __future__ import annotations

from threading import Lock
from typing import Dict, Optional

from app.graph.nodes import GraphRuntime
from app.graph.workflow import WorldbuildingWorkflow
from app.models.state import WorldState
from app.persistence import StorageManager


class StorySessionRegistry:
  def __init__(self) -> None:
    self._workflows: Dict[str, WorldbuildingWorkflow] = {}
    self._idle_states: Dict[str, WorldState] = {}
    self._storage: StorageManager | None = None
    self._lock = Lock()

  def set_storage(self, storage: StorageManager) -> None:
    self._storage = storage

  def get_or_create(self, story_name: str) -> WorldbuildingWorkflow:
    with self._lock:
      if story_name not in self._workflows:
        runtime = GraphRuntime(self._storage)
        self._workflows[story_name] = WorldbuildingWorkflow(runtime)
      return self._workflows[story_name]

  def get_state(self, story_name: str) -> Optional[WorldState]:
    workflow = self.get_or_create(story_name)
    state = workflow.get_state(story_name)
    if state is not None:
      return state
    return self._idle_states.get(story_name)

  def set_idle_state(self, story_name: str, state: WorldState) -> WorldState:
    with self._lock:
      self._idle_states[story_name] = state
    return state

  def set_initial_state(self, story_name: str, version: str) -> WorldState:
    state: WorldState = {
      "story_name": story_name,
      "current_version": version,
      "target_level": None,
      "user_injected_idea": None,
      "hitl_status": "IDLE",
      "hitl_feedback": None,
      "level_data": {},
      "simulation_configs": {},
      "dirty_nodes": [],
    }
    return self.set_idle_state(story_name, state)


registry = StorySessionRegistry()

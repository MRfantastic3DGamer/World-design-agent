"""LangGraph workflow assembly with mandatory HITL interrupt gates."""

from __future__ import annotations

from typing import Any, Callable, Dict, Optional

from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import END, StateGraph

from app.graph.nodes import (
  GraphRuntime,
  impact_decay_node,
  orchestrator_setup_node,
  router_node,
  simulation_node,
  synthesis_node,
)
from app.models.state import WorldState


class WorldbuildingWorkflow:
  """Compiles and runs the cyclic worldbuilding state machine."""

  def __init__(self, runtime: GraphRuntime | None = None) -> None:
    self.runtime = runtime or GraphRuntime()
    self._checkpointer = MemorySaver()
    self._graph = self._compile_graph()

  def _wrap(self, fn: Callable[[WorldState], Dict[str, Any]]) -> Callable[[WorldState], Dict[str, Any]]:
    runtime = self.runtime

    def inner(state: WorldState) -> Dict[str, Any]:
      return fn(state, runtime)

    return inner

  def _compile_graph(self):
    graph = StateGraph(WorldState)

    graph.add_node("router", self._wrap(router_node))
    graph.add_node("orchestrator_setup", self._wrap(orchestrator_setup_node))
    graph.add_node("simulation", self._wrap(simulation_node))
    graph.add_node("impact_decay", self._wrap(impact_decay_node))
    graph.add_node("synthesis", self._wrap(synthesis_node))

    graph.set_entry_point("router")
    graph.add_edge("router", "orchestrator_setup")
    graph.add_edge("orchestrator_setup", "simulation")
    graph.add_edge("simulation", "impact_decay")
    graph.add_edge("impact_decay", "synthesis")
    graph.add_edge("synthesis", END)

    return graph.compile(
      checkpointer=self._checkpointer,
      interrupt_before=["orchestrator_setup", "simulation"],
      interrupt_after=["synthesis"],
    )

  def _thread_config(self, story_name: str) -> Dict[str, Any]:
    return {"configurable": {"thread_id": story_name}}

  def start_cycle(self, initial_state: WorldState) -> WorldState:
    result = self._graph.invoke(initial_state, self._thread_config(initial_state["story_name"]))
    return result

  def resume(self, story_name: str, update: Optional[Dict[str, Any]] = None) -> WorldState:
    config = self._thread_config(story_name)
    if update:
      self._graph.update_state(config, update)
    result = self._graph.invoke(None, config)
    return result

  def get_state(self, story_name: str) -> Optional[WorldState]:
    snapshot = self._graph.get_state(self._thread_config(story_name))
    if snapshot is None or snapshot.values is None:
      return None
    return snapshot.values

  def is_interrupted(self, story_name: str) -> bool:
    snapshot = self._graph.get_state(self._thread_config(story_name))
    if snapshot is None:
      return False
    return bool(snapshot.next)

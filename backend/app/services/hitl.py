"""HITL gate processing helpers."""

from __future__ import annotations

from typing import Any, Dict

from app.graph.nodes import orchestrator_setup_node, router_node, synthesis_node
from app.graph.workflow import WorldbuildingWorkflow
from app.models.api import HITLRequest, HITLStatus
from app.models.state import WorldState


def apply_hitl_gate(
  workflow: WorldbuildingWorkflow,
  story_name: str,
  state: WorldState,
  request: HITLRequest,
  *,
  expected_status: str,
  finalize: bool = False,
) -> WorldState:
  if request.status == HITLStatus.REJECTED:
    update = {
      "hitl_status": "REJECTED",
      "hitl_feedback": request.steering_prompt,
    }
    workflow.resume(story_name, update)
    return workflow.get_state(story_name) or {**state, **update}

  update: Dict[str, Any] = {
    "hitl_feedback": request.steering_prompt,
    "manual_override_data": request.manual_override_data,
  }

  runtime = workflow.runtime

  if expected_status == "AWAITING_ROUTING":
    if request.status == HITLStatus.MODIFY:
      merged = {**state, **update}
      if request.manual_override_data:
        merged.update(request.manual_override_data)
      routed = router_node(merged, runtime)
      merged.update(routed)
      workflow.resume(story_name, merged)
      return workflow.get_state(story_name) or merged

    resumed = workflow.resume(story_name, update)
    return resumed

  if expected_status == "AWAITING_PRE_SIM":
    if request.status == HITLStatus.MODIFY:
      merged = {**state, **update, "hitl_status": "AWAITING_PRE_SIM"}
      orchestrated = orchestrator_setup_node(merged, runtime)
      merged.update(orchestrated)
      workflow.resume(story_name, merged)
      return workflow.get_state(story_name) or merged

    resumed = workflow.resume(story_name, update)
    return resumed

  # Post-simulation gate
  merged = {**state, **update, "hitl_status": "AWAITING_POST_SIM"}
  if request.status == HITLStatus.MODIFY and request.steering_prompt:
    synthesized = synthesis_node(merged, runtime)
    merged.update(synthesized)
    workflow.resume(story_name, merged)
    return workflow.get_state(story_name) or merged

  if request.status == HITLStatus.APPROVED and finalize:
    merged["hitl_status"] = "APPROVED"
    workflow.resume(story_name, merged)
    return workflow.get_state(story_name) or merged

  workflow.resume(story_name, merged)
  return workflow.get_state(story_name) or merged

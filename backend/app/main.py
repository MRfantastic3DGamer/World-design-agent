"""FastAPI application and route handlers."""

from __future__ import annotations

from typing import Any, Dict

from fastapi import FastAPI, HTTPException

from app.config import DEFAULT_STORY_CONFIG, LEVEL_NAMES
from app.models.api import HITLRequest, HITLStatus, InjectIdeaRequest, InitStoryRequest, StoryStateResponse
from app.models.state import WorldState
from app.services.hitl import apply_hitl_gate
from app.services.session import registry
from app.persistence import StorageManager

app = FastAPI(title="Worldbuilding Engine", version="0.1.0")
storage = StorageManager()
registry.set_storage(storage)


def _state_to_response(state: WorldState) -> StoryStateResponse:
  return StoryStateResponse(
    story_name=state["story_name"],
    current_version=state["current_version"],
    hitl_status=state.get("hitl_status", "AWAITING_ROUTING"),
    target_level=state.get("target_level"),
    user_injected_idea=state.get("user_injected_idea"),
    hitl_feedback=state.get("hitl_feedback"),
    dirty_nodes=state.get("dirty_nodes") or [],
    routing_rationale=state.get("routing_rationale"),
    simulation_output=state.get("simulation_output"),
    synthesis_output=state.get("synthesis_output"),
    backpropagation=state.get("backpropagation"),
  )


def _require_story(story_name: str) -> None:
  if not storage.story_exists(story_name):
    raise HTTPException(status_code=404, detail=f"Story '{story_name}' not found")


def _require_state(story_name: str) -> WorldState:
  _require_story(story_name)
  state = registry.get_state(story_name)
  if state is None:
    raise HTTPException(status_code=404, detail=f"No active workflow state for '{story_name}'")
  return state


@app.get("/health")
def health() -> Dict[str, str]:
  return {"status": "ok"}


@app.post("/api/story/init", response_model=StoryStateResponse)
def init_story(request: InitStoryRequest) -> StoryStateResponse:
  if storage.story_exists(request.story_name):
    raise HTTPException(status_code=409, detail=f"Story '{request.story_name}' already exists")

  version = storage.init_story(
    request.story_name,
    config=request.config or DEFAULT_STORY_CONFIG.copy(),
    initial_levels=request.initial_levels,
  )
  state = registry.set_initial_state(request.story_name, version)
  return _state_to_response(state)


@app.post("/api/story/{story_name}/inject", response_model=StoryStateResponse)
def inject_idea(story_name: str, request: InjectIdeaRequest) -> StoryStateResponse:
  _require_story(story_name)
  versions = storage.list_versions(story_name)
  current_version = versions[-1] if versions else "v1"

  workflow = registry.get_or_create(story_name)
  initial_state: WorldState = {
    "story_name": story_name,
    "current_version": current_version,
    "target_level": None,
    "user_injected_idea": request.idea,
    "hitl_status": "AWAITING_ROUTING",
    "hitl_feedback": None,
    "level_data": storage.read_all_levels(story_name, current_version),
    "simulation_configs": {},
    "dirty_nodes": [],
  }
  state = workflow.start_cycle(initial_state)
  registry.set_idle_state(story_name, state)
  return _state_to_response(state)


@app.get("/api/story/{story_name}/state", response_model=StoryStateResponse)
def get_story_state(story_name: str) -> StoryStateResponse:
  state = _require_state(story_name)
  return _state_to_response(state)


@app.get("/api/story/{story_name}/versions/{version_id}/{level}")
def get_level_json(story_name: str, version_id: str, level: int) -> Any:
  _require_story(story_name)
  if level not in LEVEL_NAMES:
    raise HTTPException(status_code=400, detail=f"Invalid level '{level}'. Must be 0-4.")
  try:
    return storage.read_level(story_name, version_id, level, resolve_refs=True)
  except FileNotFoundError as exc:
    raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.post("/api/story/{story_name}/hitl/routing", response_model=StoryStateResponse)
def hitl_routing(story_name: str, request: HITLRequest) -> StoryStateResponse:
  return _process_hitl(story_name, expected_status="AWAITING_ROUTING", request=request)


@app.post("/api/story/{story_name}/hitl/presim", response_model=StoryStateResponse)
def hitl_presim(story_name: str, request: HITLRequest) -> StoryStateResponse:
  return _process_hitl(story_name, expected_status="AWAITING_PRE_SIM", request=request)


@app.post("/api/story/{story_name}/hitl/postsim", response_model=StoryStateResponse)
def hitl_postsim(story_name: str, request: HITLRequest) -> StoryStateResponse:
  state = _process_hitl(
    story_name,
    expected_status="AWAITING_POST_SIM",
    request=request,
    finalize=True,
  )
  return state


def _process_hitl(
  story_name: str,
  *,
  expected_status: str,
  request: HITLRequest,
  finalize: bool = False,
) -> StoryStateResponse:
  state = _require_state(story_name)
  if state.get("hitl_status") != expected_status:
    raise HTTPException(
      status_code=409,
      detail=f"Story is at HITL status '{state.get('hitl_status')}', expected '{expected_status}'",
    )

  if request.status == HITLStatus.REJECTED:
    update: Dict[str, Any] = {
      "hitl_status": "REJECTED",
      "hitl_feedback": request.steering_prompt,
    }
    workflow = registry.get_or_create(story_name)
    workflow.resume(story_name, update)
    refreshed = workflow.get_state(story_name) or {**state, **update}
    registry.set_idle_state(story_name, refreshed)
    return _state_to_response(refreshed)

  workflow = registry.get_or_create(story_name)
  resumed = apply_hitl_gate(
    workflow,
    story_name,
    state,
    request,
    expected_status=expected_status,
    finalize=finalize,
  )

  if finalize and request.status == HITLStatus.APPROVED:
    committed = _commit_version(story_name, resumed)
    committed["hitl_status"] = "APPROVED"
    workflow.resume(story_name, committed)
    final_state = workflow.get_state(story_name) or committed
    registry.set_idle_state(story_name, final_state)
    return _state_to_response(final_state)

  registry.set_idle_state(story_name, resumed)
  return _state_to_response(resumed)


def _commit_version(story_name: str, state: WorldState) -> Dict[str, Any]:
  current_version = state["current_version"]
  next_version = storage.create_next_version(story_name, current_version)
  target_level = state.get("target_level") or 3

  synthesis = state.get("synthesis_output") or {}
  level_data = state.get("level_data") or storage.read_all_levels(story_name, current_version)

  if target_level in level_data and isinstance(level_data[target_level], dict):
    patch = level_data[target_level]
    patch.setdefault("simulation_history", [])
    patch["simulation_history"].append(
      {
        "idea": state.get("user_injected_idea"),
        "simulation": state.get("simulation_output"),
        "synthesis": synthesis,
      }
    )
    storage.write_level_with_refs(
      story_name,
      next_version,
      target_level,
      patch,
      previous_version=current_version,
    )

  for dirty in state.get("dirty_nodes") or []:
    if dirty.startswith("level_"):
      parent_level = int(dirty.split("_")[1])
      parent_data = level_data.get(parent_level)
      if isinstance(parent_data, dict):
        parent_data.setdefault("dirty_flags", [])
        parent_data["dirty_flags"].append(
          {
            "source_level": target_level,
            "reason": (state.get("backpropagation") or {}).get("rationale"),
          }
        )
        storage.write_level_with_refs(
          story_name,
          next_version,
          parent_level,
          parent_data,
          previous_version=current_version,
        )

  return {"current_version": next_version, "level_data": storage.read_all_levels(story_name, next_version)}

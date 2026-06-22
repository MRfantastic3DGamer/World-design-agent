from enum import Enum
from typing import Any, Dict, Optional

from pydantic import BaseModel, Field


class HITLStatus(str, Enum):
    APPROVED = "approved"
    REJECTED = "rejected"
    MODIFY = "modify"


class InitStoryRequest(BaseModel):
    story_name: str = Field(..., min_length=1, pattern=r"^[a-zA-Z0-9_-]+$")
    config: Optional[Dict[str, Any]] = None
    initial_levels: Optional[Dict[int, Dict[str, Any]]] = None


class InjectIdeaRequest(BaseModel):
    idea: str = Field(..., min_length=1)


class HITLRequest(BaseModel):
    status: HITLStatus
    steering_prompt: Optional[str] = None
    manual_override_data: Optional[Dict[str, Any]] = None


class StoryStateResponse(BaseModel):
    story_name: str
    current_version: str
    hitl_status: str
    target_level: Optional[int] = None
    user_injected_idea: Optional[str] = None
    hitl_feedback: Optional[str] = None
    dirty_nodes: list[str] = Field(default_factory=list)
    routing_rationale: Optional[str] = None
    simulation_output: Optional[Dict[str, Any]] = None
    synthesis_output: Optional[Dict[str, Any]] = None
    backpropagation: Optional[Dict[str, Any]] = None

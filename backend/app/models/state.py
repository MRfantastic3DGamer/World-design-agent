from typing import Any, Dict, List, Optional, TypedDict


class WorldState(TypedDict, total=False):
    story_name: str
    current_version: str
    target_level: Optional[int]
    user_injected_idea: Optional[str]
    hitl_status: str
    hitl_feedback: Optional[str]
    level_data: Dict[int, Any]
    simulation_configs: Dict[int, Any]
    dirty_nodes: List[str]
    routing_rationale: Optional[str]
    orchestrator_context: Optional[Dict[str, Any]]
    simulation_output: Optional[Dict[str, Any]]
    synthesis_output: Optional[Dict[str, Any]]
    backpropagation: Optional[Dict[str, Any]]
    manual_override_data: Optional[Dict[str, Any]]

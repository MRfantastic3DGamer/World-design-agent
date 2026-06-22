"""Impact decay evaluation and restricted-tag contradiction handling."""

from __future__ import annotations

import re
from typing import Any, Dict, List, Set, Tuple


class BackPropagationEngine:
  """Evaluates anomalies for local resolution or upward escalation."""

  def __init__(self) -> None:
    self._tag_pattern = re.compile(r"\[([A-Z0-9_]+)\]")

  def extract_restricted_tags(self, level_data: Dict[int, Any]) -> Set[str]:
    tags: Set[str] = set()
    for level in (0, 2):
      payload = level_data.get(level) or {}
      for tag in payload.get("restricted_tags", []):
        tags.add(str(tag))
    return tags

  def scan_violations(self, text: str, restricted_tags: Set[str]) -> List[str]:
    found = {f"[{match}]" for match in self._tag_pattern.findall(text)}
    normalized = {tag.strip("[]") for tag in found}
    violations = [f"[{tag}]" for tag in normalized if tag in restricted_tags or f"[{tag}]" in restricted_tags]
    return violations

  def evaluate(
    self,
    simulation_output: Dict[str, Any],
    level_data: Dict[int, Any],
    target_level: int,
  ) -> Dict[str, Any]:
    restricted = self.extract_restricted_tags(level_data)
    serialized = str(simulation_output)
    violations = self.scan_violations(serialized, restricted)

    if violations:
      dirty_nodes = self._escalation_path(target_level)
      return {
        "resolved_locally": False,
        "systemic_violation": True,
        "violations": violations,
        "dirty_nodes": dirty_nodes,
        "impact_decayed": False,
        "rationale": "Restricted tag violation detected; bypassing LLM evaluator.",
      }

    local_resolution = self._attempt_local_resolution(simulation_output, level_data, target_level)
    if local_resolution["resolved"]:
      return {
        "resolved_locally": True,
        "systemic_violation": False,
        "violations": [],
        "dirty_nodes": [],
        "impact_decayed": True,
        "rationale": local_resolution["rationale"],
      }

    dirty_nodes = self._escalation_path(target_level)
    return {
      "resolved_locally": False,
      "systemic_violation": False,
      "violations": [],
      "dirty_nodes": dirty_nodes,
      "impact_decayed": False,
      "rationale": "Anomaly could not be explained by adjacent facts; escalating upward.",
    }

  def _attempt_local_resolution(
    self,
    simulation_output: Dict[str, Any],
    level_data: Dict[int, Any],
    target_level: int,
  ) -> Dict[str, Any]:
    narrative = " ".join(simulation_output.get("narrative_log", []))
    adjacent_keywords = self._adjacent_keywords(level_data, target_level)

    explanations = {
      "mud": "rain",
      "muddy": "rain",
      "wet floor": "rain",
      "broken window": "storm",
      "cold": "winter",
    }

    lowered = narrative.lower()
    for anomaly, explanation in explanations.items():
      if anomaly in lowered and explanation in adjacent_keywords:
        return {
          "resolved": True,
          "rationale": f"Local resolution: '{anomaly}' explained by existing '{explanation}' context.",
        }

    return {"resolved": False, "rationale": ""}

  def _adjacent_keywords(self, level_data: Dict[int, Any], target_level: int) -> str:
    chunks: List[str] = []
    for level in range(0, min(target_level, 3)):
      chunks.append(str(level_data.get(level, {})))
    return " ".join(chunks).lower()

  def _escalation_path(self, target_level: int) -> List[str]:
    nodes: List[str] = []
    for level in range(target_level - 1, -1, -1):
      nodes.append(f"level_{level}")
    return nodes

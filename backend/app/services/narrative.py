"""Extract narrative timeline events from versioned story storage."""

from __future__ import annotations

from typing import Any, Dict, List

from app.persistence import StorageManager


def build_narrative_timeline(
  storage: StorageManager,
  story_name: str,
  version_id: str,
) -> Dict[str, Any]:
  versions = storage.list_versions(story_name)
  if version_id not in versions:
    raise ValueError(f"Version '{version_id}' not found")

  cutoff = versions.index(version_id) + 1
  included_versions = versions[:cutoff]
  events: List[Dict[str, Any]] = []
  event_index = 0

  for version in included_versions:
    levels = storage.read_all_levels(story_name, version, resolve_refs=True)
    for level_num, payload in sorted(levels.items()):
      if not isinstance(payload, dict):
        continue

      for cycle_index, cycle in enumerate(payload.get("simulation_history", [])):
        if not isinstance(cycle, dict):
          continue
        synthesis = cycle.get("synthesis") or {}
        summary = ""
        if isinstance(synthesis, dict):
          summary = str(synthesis.get("summary") or synthesis.get("message") or "")
        events.append(
          {
            "id": f"evt-{event_index}",
            "type": "simulation_cycle",
            "version": version,
            "level": level_num,
            "order": event_index,
            "idea": cycle.get("idea"),
            "summary": summary,
            "synthesis": synthesis,
            "simulation": cycle.get("simulation"),
          }
        )
        event_index += 1

      for flag_index, flag in enumerate(payload.get("dirty_flags", [])):
        if not isinstance(flag, dict):
          continue
        events.append(
          {
            "id": f"evt-{event_index}",
            "type": "retcon_escalation",
            "version": version,
            "level": level_num,
            "order": event_index,
            "source_level": flag.get("source_level"),
            "reason": flag.get("reason"),
            "summary": flag.get("reason") or "Escalated upward for retcon",
          }
        )
        event_index += 1

  return {
    "story_name": story_name,
    "selected_version": version_id,
    "included_versions": included_versions,
    "latest_version": versions[-1] if versions else version_id,
    "events": events,
  }

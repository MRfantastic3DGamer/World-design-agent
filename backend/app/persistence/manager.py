"""Flat-file JSON persistence with reference resolution, baking, and file locks."""

from __future__ import annotations

import json
import re
import shutil
from pathlib import Path
from typing import Any, Dict, Optional

from filelock import FileLock

from app.config import BAKE_INTERVAL, DEFAULT_STORY_CONFIG, LEVEL_NAMES, STORAGE_ROOT

REF_KEY = "_ref"


class StorageManager:
  """Manages versioned story storage with _ref pointers and periodic baking."""

  def __init__(self, root: Path | None = None) -> None:
    self.root = root or STORAGE_ROOT
    self.root.mkdir(parents=True, exist_ok=True)

  def _story_dir(self, story_name: str) -> Path:
    return self.root / story_name

  def _version_dir(self, story_name: str, version: str) -> Path:
    return self._story_dir(story_name) / "versions" / version

  def _lock_path(self, path: Path) -> Path:
    return path.with_suffix(path.suffix + ".lock")

  def _read_json_locked(self, path: Path) -> Any:
    path.parent.mkdir(parents=True, exist_ok=True)
    lock = FileLock(self._lock_path(path))
    with lock:
      if not path.exists():
        raise FileNotFoundError(str(path))
      return json.loads(path.read_text(encoding="utf-8"))

  def _write_json_locked(self, path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    lock = FileLock(self._lock_path(path))
    with lock:
      path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

  def _resolve_ref(self, story_name: str, ref: str, seen: Optional[set[str]] = None) -> Any:
    seen = seen or set()
    if ref in seen:
      raise ValueError(f"Circular reference detected: {ref}")
    seen.add(ref)

    ref_path = self._story_dir(story_name) / ref
    payload = self._read_json_locked(ref_path)
    if isinstance(payload, dict) and REF_KEY in payload and len(payload) == 1:
      return self._resolve_ref(story_name, payload[REF_KEY], seen)
    return payload

  def resolve_payload(self, story_name: str, payload: Any) -> Any:
    if isinstance(payload, dict) and REF_KEY in payload and len(payload) == 1:
      return self._resolve_ref(story_name, payload[REF_KEY])
    if isinstance(payload, dict):
      return {k: self.resolve_payload(story_name, v) for k, v in payload.items()}
    if isinstance(payload, list):
      return [self.resolve_payload(story_name, item) for item in payload]
    return payload

  def init_story(
    self,
    story_name: str,
    config: Optional[Dict[str, Any]] = None,
    initial_levels: Optional[Dict[int, Dict[str, Any]]] = None,
  ) -> str:
    story_dir = self._story_dir(story_name)
    if story_dir.exists():
      raise ValueError(f"Story '{story_name}' already exists")

    version = "v1"
    story_dir.mkdir(parents=True)
    self._write_json_locked(story_dir / "config.json", config or DEFAULT_STORY_CONFIG.copy())

    version_dir = self._version_dir(story_name, version)
    version_dir.mkdir(parents=True)

    defaults = self._default_level_payloads()
    levels = initial_levels or {}
    for level, filename in LEVEL_NAMES.items():
      data = levels.get(level, defaults[level])
      self._write_json_locked(version_dir / f"{filename}.json", data)

    return version

  def _default_level_payloads(self) -> Dict[int, Dict[str, Any]]:
    return {
      0: {
        "physical_laws": [],
        "magic_rules": [],
        "ecosystem_limits": [],
        "restricted_tags": ["RESTRICTED_TECH", "MAGIC_DEAD_ZONE"],
      },
      1: {
        "global_history": [],
        "geopolitics": [],
        "geography": [],
        "cataclysms": [],
      },
      2: {
        "factions": [],
        "cultures": [],
        "resources": [],
        "ideologies": [],
        "restricted_tags": ["RESTRICTED_TECH", "MAGIC_DEAD_ZONE"],
      },
      3: {
        "locations": [],
        "daily_life": [],
        "trade": [],
        "technology": [],
        "personas": [],
      },
      4: {
        "environmental_details": [],
        "wear_and_tear": [],
        "physical_decay": [],
      },
    }

  def read_config(self, story_name: str) -> Dict[str, Any]:
    return self._read_json_locked(self._story_dir(story_name) / "config.json")

  def read_level(self, story_name: str, version: str, level: int, resolve_refs: bool = True) -> Any:
    filename = LEVEL_NAMES[level]
    path = self._version_dir(story_name, version) / f"{filename}.json"
    payload = self._read_json_locked(path)
    if resolve_refs:
      return self.resolve_payload(story_name, payload)
    return payload

  def read_all_levels(self, story_name: str, version: str, resolve_refs: bool = True) -> Dict[int, Any]:
    return {level: self.read_level(story_name, version, level, resolve_refs=resolve_refs) for level in LEVEL_NAMES}

  def _version_number(self, version: str) -> int:
    match = re.fullmatch(r"v(\d+)", version)
    if not match:
      raise ValueError(f"Invalid version id: {version}")
    return int(match.group(1))

  def create_next_version(self, story_name: str, current_version: str) -> str:
    current_num = self._version_number(current_version)
    next_version = f"v{current_num + 1}"
    src = self._version_dir(story_name, current_version)
    dst = self._version_dir(story_name, next_version)
    if dst.exists():
      return next_version
    shutil.copytree(src, dst)
    return next_version

  def write_level_with_refs(
    self,
    story_name: str,
    version: str,
    level: int,
    new_data: Dict[str, Any],
    previous_version: Optional[str] = None,
  ) -> None:
    filename = LEVEL_NAMES[level]
    path = self._version_dir(story_name, version) / f"{filename}.json"

    if previous_version:
      try:
        prev_raw = self._read_json_locked(
          self._version_dir(story_name, previous_version) / f"{filename}.json"
        )
        prev_resolved = self.resolve_payload(story_name, prev_raw)
        if prev_resolved == new_data:
          rel_ref = f"versions/{previous_version}/{filename}.json"
          self._write_json_locked(path, {REF_KEY: rel_ref})
          return
      except FileNotFoundError:
        pass

    self._write_json_locked(path, new_data)
    self.bake_if_needed(story_name, version)

  def bake_if_needed(self, story_name: str, version: str) -> bool:
    version_num = self._version_number(version)
    if version_num == 0 or version_num % BAKE_INTERVAL != 0:
      return False

    version_dir = self._version_dir(story_name, version)
    for level, filename in LEVEL_NAMES.items():
      path = version_dir / f"{filename}.json"
      if not path.exists():
        continue
      raw = self._read_json_locked(path)
      baked = self.resolve_payload(story_name, raw)
      self._write_json_locked(path, baked)
    return True

  def story_exists(self, story_name: str) -> bool:
    return self._story_dir(story_name).exists()

  def list_versions(self, story_name: str) -> list[str]:
    versions_dir = self._story_dir(story_name) / "versions"
    if not versions_dir.exists():
      return []
    return sorted(
      [p.name for p in versions_dir.iterdir() if p.is_dir()],
      key=self._version_number,
    )

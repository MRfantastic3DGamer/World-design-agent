"""ChromaDB-backed lore retrieval for simulation context injection."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any, Dict, List

import chromadb
from chromadb.config import Settings

from app.config import LEVEL_NAMES, STORAGE_ROOT


class LoreVectorStore:
  """Maintains per-story vector indexes and serves top-K lore snippets."""

  def __init__(self, root: Path | None = None) -> None:
    self.root = root or STORAGE_ROOT
    self._client = chromadb.PersistentClient(
      path=str(self.root / ".chromadb"),
      settings=Settings(anonymized_telemetry=False),
    )

  def _collection_name(self, story_name: str) -> str:
    digest = hashlib.sha1(story_name.encode("utf-8")).hexdigest()[:16]
    return f"story_{digest}"

  def _flatten_level(self, level: int, data: Dict[str, Any], version: str) -> List[Dict[str, str]]:
    documents: List[Dict[str, str]] = []

    def walk(prefix: str, value: Any) -> None:
      if isinstance(value, dict):
        for key, nested in value.items():
          if key == "restricted_tags":
            continue
          walk(f"{prefix}.{key}" if prefix else key, nested)
      elif isinstance(value, list):
        for item in value:
          if isinstance(item, (dict, list)):
            walk(prefix, item)
          elif item:
            documents.append(
              {
                "id": hashlib.sha1(f"{version}:{level}:{prefix}:{item}".encode()).hexdigest(),
                "text": f"[L{level}] {prefix}: {item}",
                "metadata": json.dumps({"level": level, "field": prefix, "version": version}),
              }
            )
      elif value:
        documents.append(
          {
            "id": hashlib.sha1(f"{version}:{level}:{prefix}:{value}".encode()).hexdigest(),
            "text": f"[L{level}] {prefix}: {value}",
            "metadata": json.dumps({"level": level, "field": prefix, "version": version}),
          }
        )

    walk(LEVEL_NAMES[level].replace(f"level_{level}_", ""), data)
    return documents

  def index_story_levels(self, story_name: str, version: str, levels: Dict[int, Any]) -> int:
    collection = self._client.get_or_create_collection(self._collection_name(story_name))
    docs: List[Dict[str, str]] = []
    for level, data in levels.items():
      if level <= 2 and isinstance(data, dict):
        docs.extend(self._flatten_level(level, data, version))

    if not docs:
      return 0

    # Chroma upsert in batches
    batch_size = 100
    for i in range(0, len(docs), batch_size):
      batch = docs[i : i + batch_size]
      collection.upsert(
        ids=[d["id"] for d in batch],
        documents=[d["text"] for d in batch],
        metadatas=[json.loads(d["metadata"]) for d in batch],
      )
    return len(docs)

  def query_relevant_lore(
    self,
    story_name: str,
    *,
    location: str,
    faction: str,
    top_k: int = 8,
  ) -> List[str]:
    collection = self._client.get_or_create_collection(self._collection_name(story_name))
    if collection.count() == 0:
      return []

    query = f"location: {location}; faction: {faction}; local culture, factions, resources, history"
    result = collection.query(query_texts=[query], n_results=min(top_k, max(collection.count(), 1)))
    documents = result.get("documents") or [[]]
    return [doc for doc in documents[0] if doc]

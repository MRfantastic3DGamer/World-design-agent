"""Flat-file JSON persistence with reference resolution, baking, and file locks."""

from app.persistence.manager import REF_KEY, StorageManager

__all__ = ["REF_KEY", "StorageManager"]

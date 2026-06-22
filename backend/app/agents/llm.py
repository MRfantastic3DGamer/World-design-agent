"""LiteLLM gateway for multi-provider model routing."""

from __future__ import annotations

import json
import os
from typing import Any, Dict, List, Optional

import litellm

litellm.suppress_debug_info = True


class LLMGateway:
  """Routes completion requests through litellm to configured providers."""

  def __init__(self, model_config: Dict[str, Any]) -> None:
    self.provider = model_config.get("provider", "openai")
    self.model = model_config.get("model", "gpt-4o-mini")
    self.temperature = model_config.get("temperature", 0.7)
    self.max_tokens = model_config.get("max_tokens", 2048)

  def _model_id(self) -> str:
    if "/" in self.model or self.provider == "ollama":
      if self.model.startswith(f"{self.provider}/"):
        return self.model
      return f"{self.provider}/{self.model}"
    return self.model

  def complete(
    self,
    system_prompt: str,
    user_prompt: str,
    *,
    response_format: Optional[Dict[str, Any]] = None,
  ) -> str:
    if os.getenv("WORLD_ENGINE_MOCK_LLM", "").lower() in {"1", "true", "yes"}:
      return self._mock_response(system_prompt, user_prompt)

    messages: List[Dict[str, str]] = [
      {"role": "system", "content": system_prompt},
      {"role": "user", "content": user_prompt},
    ]
    kwargs: Dict[str, Any] = {
      "model": self._model_id(),
      "messages": messages,
      "temperature": self.temperature,
      "max_tokens": self.max_tokens,
    }
    if response_format:
      kwargs["response_format"] = response_format

    try:
      response = litellm.completion(**kwargs)
      return response.choices[0].message.content or ""
    except Exception as exc:
      return self._fallback_response(system_prompt, user_prompt, str(exc))

  def complete_json(self, system_prompt: str, user_prompt: str) -> Dict[str, Any]:
    raw = self.complete(
      system_prompt,
      user_prompt,
      response_format={"type": "json_object"},
    )
    try:
      return json.loads(raw)
    except json.JSONDecodeError:
      start = raw.find("{")
      end = raw.rfind("}")
      if start >= 0 and end > start:
        return json.loads(raw[start : end + 1])
      return {"raw": raw}

  def _mock_response(self, system_prompt: str, user_prompt: str) -> str:
    lowered = (system_prompt + user_prompt).lower()
    if "router" in lowered or "target level" in lowered:
      return json.dumps(
        {
          "target_level": 3,
          "rationale": "Mock routing selected Level 3 (Micro) for character-scale simulation.",
        }
      )
    if "actor" in lowered and "intention" in lowered:
      return json.dumps(
        {
          "intention": "Approach the merchant stall and inspect the wares.",
          "action": "walk toward the stall",
          "consequential": False,
        }
      )
    if "director" in lowered:
      return json.dumps(
        {
          "resolution": "The merchant notices the approach and greets the traveler.",
          "environment_changes": ["merchant_attentive"],
          "narrative": "Dust swirls as the merchant looks up from counting coins.",
        }
      )
    if "synthesis" in lowered or "compile" in lowered:
      return json.dumps(
        {
          "summary": "A micro-level scene was simulated at the market.",
          "facts": ["Traveler approached merchant stall"],
          "tone": "grounded",
        }
      )
    return json.dumps({"message": "mock completion", "prompt_excerpt": user_prompt[:120]})

  def _fallback_response(self, system_prompt: str, user_prompt: str, error: str) -> str:
    if "json" in system_prompt.lower() or "json" in user_prompt.lower():
      return json.dumps(
        {
          "error": error,
          "fallback": True,
          "summary": "Heuristic fallback due to LLM unavailability.",
        }
      )
    return f"[LLM fallback: {error}]"

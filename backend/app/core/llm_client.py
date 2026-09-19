"""
Thin wrapper around the LLM API used for every synthesis stage.

Uses Google's Gemini API (genuinely free tier, no billing required for
low-volume use) via the google-genai SDK.

Design note: we NEVER trust raw LLM text. Every call asks for JSON that
conforms to a Pydantic model's schema (Gemini's native structured-output
support), and the response is re-validated with that model before it goes
anywhere else in the system. If parsing/validation fails, we retry once
with the error fed back to the model so it can self-correct.
"""
from __future__ import annotations

import json
import os
import time
from typing import Type, TypeVar

from google import genai
from google.genai import errors as genai_errors
from google.genai import types
from pydantic import BaseModel, ValidationError

T = TypeVar("T", bound=BaseModel)

_client: genai.Client | None = None

# Gemini's own capacity errors (503 UNAVAILABLE, 429 rate limit) are transient
# and unrelated to anything wrong in our request -- worth a couple of quick
# retries with backoff before giving up, distinct from the "model returned
# invalid JSON" retry loop below.
_TRANSIENT_STATUS_CODES = {429, 503}


class LLMUnavailableError(RuntimeError):
    """Raised when the LLM provider itself is down/overloaded (not our bug).
    Callers (the API layer) catch this specifically to return a 503 with a
    clear, actionable message instead of a bare 500."""


def get_client() -> genai.Client:
    global _client
    if _client is None:
        api_key = os.environ.get("GEMINI_API_KEY")
        if not api_key:
            raise RuntimeError(
                "GEMINI_API_KEY is not set. Export it before starting the backend, "
                "e.g. `export GEMINI_API_KEY=...`. Get a free key at "
                "https://aistudio.google.com/apikey"
            )
        _client = genai.Client(api_key=api_key)
    return _client


MODEL = os.environ.get("CHAINREACT_MODEL", "gemini-3.6-flash-lite")


def _generate_with_capacity_retry(*, model: str, contents, config, max_attempts: int = 3):
    """Wraps client.models.generate_content with backoff specifically for
    Gemini-side capacity errors (503/429). Anything else (bad request, auth)
    is raised immediately -- retrying those would just waste time."""
    client = get_client()
    last_error: Exception | None = None
    for attempt in range(max_attempts):
        try:
            return client.models.generate_content(model=model, contents=contents, config=config)
        except genai_errors.APIError as e:
            status = getattr(e, "code", None) or getattr(e, "status_code", None)
            last_error = e
            if status in _TRANSIENT_STATUS_CODES and attempt < max_attempts - 1:
                time.sleep(1.5 * (attempt + 1))  # 1.5s, 3s
                continue
            if status in _TRANSIENT_STATUS_CODES:
                raise LLMUnavailableError(
                    "The AI model is temporarily overloaded (Gemini returned "
                    f"{status}). This is on Google's side, not a bug -- please try again "
                    "in a minute."
                ) from e
            raise
    raise LLMUnavailableError(f"AI model unavailable after {max_attempts} attempts: {last_error}")


def structured_completion(
    *,
    system_prompt: str,
    user_prompt: str,
    response_model: Type[T],
    max_retries: int = 1,
) -> T:
    """Call the LLM and force output that validates against response_model.

    Uses Gemini's native response_schema (built from the Pydantic model) as
    the first line of defense, then re-validates with Pydantic (belt and
    braces -- the two schema systems don't guarantee 100% identical
    enforcement, and Pydantic gives us the exact typed object plus our own
    custom validators, e.g. the permissions-overlap check).
    """
    client = get_client()
    contents = user_prompt

    last_error: Exception | None = None
    for attempt in range(max_retries + 1):
        response = _generate_with_capacity_retry(
            model=MODEL,
            contents=contents,
            config=types.GenerateContentConfig(
                system_instruction=system_prompt,
                response_mime_type="application/json",
                response_schema=response_model,
                temperature=0.2,
            ),
        )
        try:
            raw_text = response.text
            if not raw_text:
                raise ValueError("Empty response from model")
            data = json.loads(raw_text)
            return response_model.model_validate(data)
        except (ValidationError, ValueError, json.JSONDecodeError) as e:
            last_error = e
            # Feed the error back so the model can self-correct on retry.
            contents = (
                f"{user_prompt}\n\n"
                f"Your previous response was invalid: {e}. "
                f"Return corrected JSON that strictly matches the schema. "
                f"Return ONLY the JSON object, no prose."
            )
            continue

    raise RuntimeError(f"LLM failed to produce valid {response_model.__name__} after retries: {last_error}")


def chat_completion(*, system_prompt: str, history: list[dict[str, str]]) -> str:
    """Plain-text (non-structured) completion for the chat assistant.

    `history` is a list of {"role": "user"|"model", "text": "..."} turns,
    oldest first. Unlike structured_completion, there's no schema to
    validate against here -- this is conversational help text, not data
    that feeds back into the synthesis pipeline, so plain text is fine.
    """
    client = get_client()
    contents = [
        types.Content(role=turn["role"], parts=[types.Part(text=turn["text"])])
        for turn in history
    ]
    response = _generate_with_capacity_retry(
        model=MODEL,
        contents=contents,
        config=types.GenerateContentConfig(
            system_instruction=system_prompt,
            temperature=0.4,
        ),
    )
    return response.text or "Sorry, I didn't get a response -- try asking again."

# Worldbuilding Engine — Python Backend

FastAPI + LangGraph backend for the multi-agent worldbuilding system described in the repository `README.md`.

## Requirements

- Python 3.11+

## Setup

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
```

## Run API Server

```bash
cd backend
export WORLD_ENGINE_MOCK_LLM=1   # optional: deterministic mock LLM responses
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## Run Tests

```bash
cd backend
export WORLD_ENGINE_MOCK_LLM=1
pytest
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/story/init` | Scaffold story storage and config |
| `POST` | `/api/story/{name}/inject` | Inject an idea and start routing |
| `GET` | `/api/story/{name}/state` | Poll workflow/HITL state |
| `GET` | `/api/story/{name}/versions/{version_id}/{level}` | Fetch level JSON (refs resolved) |
| `POST` | `/api/story/{name}/hitl/routing` | HITL gate 1 |
| `POST` | `/api/story/{name}/hitl/presim` | HITL gate 2 |
| `POST` | `/api/story/{name}/hitl/postsim` | HITL gate 3 |

## Architecture

- `app/persistence/` — versioned JSON storage with `_ref` pointers, baking, and `filelock`
- `app/graph/` — LangGraph workflow and node implementations
- `app/agents/` — LiteLLM gateway and Actor-Director simulation engine
- `app/rag/` — ChromaDB lore retrieval for Level 3/4 context injection
- `app/backprop/` — impact decay and restricted-tag contradiction handling
- `app/main.py` — FastAPI routes

Set provider API keys in your environment when not using `WORLD_ENGINE_MOCK_LLM`.

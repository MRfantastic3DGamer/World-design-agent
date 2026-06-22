# Story Reader UI

Vite + React UI with **full API coverage** for the worldbuilding engine.

## API panels (sidebar tabs)

| Tab | Endpoint(s) | Purpose |
|-----|-------------|---------|
| **Create** | `POST /api/story/init`, `GET /api/defaults` | Project name, optional LLM config JSON, optional per-level seed JSON |
| **Workflow** | `POST /inject`, `POST /hitl/*` | Inject ideas, steering prompts, manual override JSON |
| **Timeline** | `GET /versions/{v}/narrative` | How simulations shaped the story |
| **State** | `GET /state` | Live workflow / HITL status |
| **Config** | `GET /config` | Per-project LLM routing |
| **Level JSON** | `GET /versions/{v}/{level}` | Single resolved level file |

Toolbar also uses `GET /api/stories`, `GET /versions`, `GET /versions/{v}/all`, and `GET /health`.

## Tooltips

Hover the **?** icon next to labels for field-level help. Tab buttons include endpoint hints in their `title` attribute.

## Setup

```bash
# Backend
cd backend && pip install -e . && WORLD_ENGINE_MOCK_LLM=1 uvicorn app.main:app --reload

# Frontend
cd frontend && npm install && npm run dev
```

Open http://localhost:5173

## Create a project

1. Open the **Create** tab
2. Enter a project name (`a-z`, `0-9`, `_`, `-`)
3. Optionally enable **Custom LLM config** or **Seed initial level JSON**
4. Click **Create project**

Latest version is selected automatically when you open a project.

# World Graph UI

Vite + React frontend for visualizing the worldbuilding engine story hierarchy on an interactive node-graph canvas.

## Features

- **5-level story canvas** — Axioms → Macro → Meso → Micro → Nano as a vertical node graph
- **Entity nodes** — Array fields (factions, locations, laws, etc.) rendered as child nodes
- **Inspector panel** — Click any node to view full JSON payload
- **Version switching** — Browse any committed story version
- **Workflow controls** — Inject ideas and approve/modify/reject HITL gates

## Setup

```bash
# Terminal 1 — backend
cd backend
pip install -e .
export WORLD_ENGINE_MOCK_LLM=1
uvicorn app.main:app --reload --port 8000

# Terminal 2 — frontend
cd frontend
npm install
npm run dev
```

Open http://localhost:5173

The Vite dev server proxies `/api` and `/health` to the backend on port 8000.

## Stack

- Vite + React + TypeScript
- [@xyflow/react](https://reactflow.dev/) for the node graph canvas

# Story Reader UI

Vite + React UI for reading worldbuilding projects as an interactive graph with a causal timeline.

## Features

- **Project picker** — select any story project from storage
- **Version picker** — latest version selected by default; older versions available for historical reading
- **World graph** — five hierarchical levels (Axioms → Nano) with entity child nodes
- **How it happened** — left sidebar timeline of simulation cycles and retcon escalations
- **Causal edges** — dashed/animated links from timeline events to the levels they shaped
- **Inspector** — click any node or timeline step to read full JSON details

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

## Stack

- Vite + React + TypeScript
- [@xyflow/react](https://reactflow.dev/) for the node graph canvas

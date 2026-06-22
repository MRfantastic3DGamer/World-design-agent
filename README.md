# Master System Blueprint: Multi-Agent Worldbuilding Engine
## 1. System Overview
This document serves as the comprehensive specification for a backend multi-agent system designed for hierarchical worldbuilding and character simulation.
The system leverages **LangGraph** for cyclic state-machine orchestration and Human-in-the-Loop (HITL) checkpoints. It simulates worlds across five distinct layers, managing top-down generation and smart bottom-up back-propagation (retcons). The architecture mandates mandatory user oversight at key lifecycle gates to ensure creative "taste" and narrative alignment.
### 1.1 Technical Stack
 * **Framework:** Python 3.11+
 * **Orchestration:** langgraph & langchain-core
 * **LLM Gateway:** litellm (routing to OpenAI, Anthropic, Ollama, etc.)
 * **Local Inference:** Ollama for high-volume POV simulations.
 * **API Layer:** FastAPI
 * **Data Modeling:** Pydantic v2
 * **Retrieval/Context:** ChromaDB or FAISS (Lightweight local vector store).
## 2. Storage, Versioning & Data Integrity
The system uses a flat-file JSON structure within versioned directory trees.
### 2.1 Directory Schema
```text
storage/
└── <story_name>/
    ├── config.json                     # Global configurations (LLM mapping)
    └── versions/
        ├── v1/
        │   ├── level_0_axioms.json
        │   ├── level_1_macro.json
        │   └── ...
        └── v2/
            ├── level_0_axioms.json     # Unchanged -> {"_ref": "versions/v1/level_0_axioms.json"}
            └── level_1_macro.json      # Modified data
```
### 2.2 Integrity Requirements
 * **Reference Traversal:** Unchanged files use a _ref pointer. The backend must resolve these recursively on read.
 * **State Baking:** To prevent reference chain degradation (I/O bottlenecks), the system must "bake" the state every 10 versions. At v10, v20, etc., all _ref pointers are resolved and written as full JSON files.
 * **Concurrency (Mutex Locks):** To prevent race conditions during multi-agent parallel writes, the coding agent must implement filelock around all storage I/O functions.
## 3. The 5 Hierarchical Levels

| Level | Name | Scope & Simulation Domain | POV Scaling |
| :--- | :--- | :--- | :--- |
| **0** | **Axioms** | Hard physical laws, magic/anomaly rules, ecosystem limits. | None (Rules Engine) |
| **1** | **Macro** | Global history, cataclysms, geopolitics, geography. | Low (1-2 POVs) |
| **2** | **Meso** | Factions, localized cultures, resources, ideologies. | Medium (3-5 POVs) |
| **3** | **Micro** | Lived experience: tech, clothing, daily routines, trade. | High (10-50+ POVs) |
| **4** | **Nano** | Environmental storytelling: wear-and-tear, physical decay. | Micro-focused |

## 4. Execution Workflow & LangGraph State Machine
### 4.1 Global State (LangGraph TypedDict)
```python
from typing import TypedDict, Dict, Any, List, Optional
class WorldState(TypedDict):
    story_name: str
    current_version: str
    target_level: Optional[int]
    user_injected_idea: Optional[str]
    hitl_status: str  # "AWAITING_ROUTING", "AWAITING_PRE_SIM", "AWAITING_POST_SIM", "APPROVED"
    hitl_feedback: Optional[str] # User steering prompts
    level_data: Dict[int, Any]
    simulation_configs: Dict[int, Any]
    dirty_nodes: List[str] # Sub-factions/areas requiring updates
```
### 4.2 Node Execution Graph
 1. **Router Node:** Analyzes user_injected_idea, outputs target level. -> **[HITL GATE 1]**
 2. **Orchestrator Setup Node:** Formats context, configures Director/Actor prompts. -> **[HITL GATE 2]**
 3. **Simulation Node:** Spawns Actor/Director agents. Runs cyclic simulation.
 4. **Impact Decay Evaluation Node:** Evaluates conflicts for back-propagation.
 5. **Synthesis Node:** Compiles final output. -> **[HITL GATE 3]**
## 5. Human-in-the-Loop (HITL) & Steering Mechanics
HITL is **mandatory** for every major transition. There are no auto-approvals.
Crucially, when the system pauses at a HITL gate, the user can provide a **Steering Prompt** (e.g., *"Make the merchant more paranoid,"* or *"The guard should be corrupt"*).
 * **Steering Processing:** If hitl_feedback is provided, the Orchestrator node must process it before resuming.
   * If at Pre-Sim: The Orchestrator dynamically updates the Actor/Director's system prompts to reflect the user's creative direction.
   * If at Post-Sim: The Orchestrator rewrites the synthesized output to match the user's requested tone/facts before committing.
## 6. Level 3/4 Character Simulation Engine (Actor-Director Model)
Simulations must not be generated via a single prompt (to prevent trope bias and forced resolutions).
### 6.1 The Adversarial Split
 * **The Actor (Persona Agent):** Governed by a BDI profile (Beliefs, Desires, Intentions). Can only attempt actions.
 * **The Director (Orchestrator Agent):** Controls the environment and non-player reactions. Resolves Actor attempts.
### 6.2 Deadlock Prevention (The Clock & Max Retries)
 * **Time Units:** The Persona is given a time_units_remaining integer. Every attempted action costs a unit. When 0 is reached, the Director forces a narrative conclusion.
 * **Max Retries:** If an Actor fails the exact same intention twice, the Python backend must programmatically force the Actor to generate a new intention to prevent infinite loops.
### 6.3 Programmatic RNG
When an Actor attempts a consequential action, the Python backend calculates success probability based on stats and rolls a random number. Success/Failure is passed to the Director as an immutable prompt constraint.
## 7. Context Management (Dynamic RAG)
To prevent "Lore Creep" (context window overflow) as the world expands:
 * The backend must maintain a local Vector Store (ChromaDB/FAISS).
 * When the Orchestrator initializes a Level 3 simulation, it must query the Vector Store using the Persona's location/faction.
 * **Rule:** Inject *only* the top-K relevant lore facts into the Director/Actor context window, rather than passing the entire Level 1 and Level 2 JSON files.
## 8. Smart Back-Propagation & Contradiction Handling
### 8.1 Impact Decay Logic
 * **Local Resolution:** If an anomaly can be explained by existing adjacent facts (e.g., muddy floor -> it rained), the back-propagation decays and stops.
 * **Escalation:** If a fact cannot be resolved locally, it flags the parent node as "Dirty" and propagates upward.
### 8.2 Strict Contradiction Matrices (Hallucination Prevention)
Do not rely entirely on LLM reasoning for back-propagation.
 * Level 0 and Level 2 JSONs must define restricted_tags (e.g., [RESTRICTED_TECH], [MAGIC_DEAD_ZONE]).
 * If an Actor/Director output contains an item or event mapping to a restricted tag, the backend bypasses the LLM evaluator and **automatically triggers a systemic violation**, escalating the retcon process to the higher level.
## 9. API Specifications (FastAPI)
### 9.1 Core Flow
 * POST /api/story/init - Scaffolds directory and config.
 * POST /api/story/{name}/inject - Payload: {"idea": "..."}. Initiates routing.
 * GET /api/story/{name}/state - Poll current graph state.
 * GET /api/story/{name}/versions/{version_id}/{level} - Fetch complete JSON (backend handles reference resolution).
### 9.2 HITL Gateways (with Steering)
 * POST /api/story/{name}/hitl/routing
 * POST /api/story/{name}/hitl/presim
 * POST /api/story/{name}/hitl/postsim
 * **Unified Payload Structure:**
```json
{
  "status": "approved" | "rejected" | "modify",
  "steering_prompt": "Optional instructions for the orchestrator to adjust the setup/output",
  "manual_override_data": { "optional": "direct JSON/text edits by user" }
}
```
## 10. Agent Model Configuration
Dynamic allocation managed in <story_name>/config.json.
```json
{
  "router": { "provider": "openai", "model": "gpt-4o" },
  "orchestrators": {
    "level_0_to_2": { "provider": "anthropic", "model": "claude-3-5-sonnet-20240620" },
    "level_3_to_4": { "provider": "ollama", "model": "llama3:8b" }
  },
  "simulation_actors": { "provider": "ollama", "model": "gemma2:27b" },
  "simulation_directors": { "provider": "ollama", "model": "mistral:instruct" },
  "evaluator": { "provider": "openai", "model": "gpt-4o-mini" }
}
```
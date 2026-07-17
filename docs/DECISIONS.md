# Architecture Decisions (DECISIONS.md)

This document tracks the rationale behind the key technical trade-offs made during the development of StadiumPulse AI.

---

## 1. Monorepo Scaffolding via npm Workspaces

- **Decision:** Use `npm` workspaces to manage root packages, shared types, two frontend applications, and two backend services.
- **Alternative:** Separate repositories or `pnpm` / `yarn` workspaces.
- **Rationale:** `npm` workspaces are built directly into standard Node.js/npm environments and work seamlessly on Windows without requiring developers to install separate package managers (like `pnpm`). It simplifies script orchestration using standard `concurrently`.

---

## 2. Express Backend over FastAPI

- **Decision:** Build backend services (`services/agent-core` and `services/simulation-engine`) using Node/Express with TypeScript.
- **Alternative:** FastAPI (Python).
- **Rationale:** Writing the entire stack in TypeScript (Next.js frontends and Node backend services) allows us to share types directly via the `@stadiumpulse/shared-types` workspace package. It prevents duplicating types in Python/Pydantic, simplifies build pipelines, and is easier to orchestrate locally.

---

## 3. Interactive SVG Stadium Map with Graph Routing

- **Decision:** Build a custom, styled SVG venue map (for MetLife Stadium) with a pathfinding graph overlay.
- **Alternative:** Real Google Maps JS SDK with custom overlay layers.
- **Rationale:** Standard Google Maps does not support indoor pathfinding or high-fidelity venue navigation layout configurations out of the box without complex and paid indoor mapping accounts. A custom interactive SVG map is visual, fast, lightweight, and allows us to demonstrate exact zone rerouting (accessible wheelchair route vs fastest crowd-avoiding route) offline or with basic mock coordinates.

---

## 4. In-Memory Vector Store for RAG Grounding

- **Decision:** Implement a clean, memory-based cosine-similarity TF-IDF / mini-embedding vector database.
- **Alternative:** External vector stores (Pinecone, Chroma, pgvector).
- **Rationale:** Setting up external databases adds local dependencies (Docker, environment secrets, networking). An in-memory vector store seeded from local JSON policy files requires zero configuration, starts instantly, runs perfectly in memory during the 4-minute demo, and is robust enough to prove RAG grounding to the judges.

---

## 5. Next.js App Router for Frontends

- **Decision:** Use Next.js (App Router) with Tailwind CSS and Tailwind styling.
- **Rationale:** App Router is the modern industry standard for React apps, providing out-of-the-box routing, server/client component division, and fast builds. Combined with Tailwind, it allows crafting extremely premium UI dashboards and chat assistants with smooth micro-animations.

# StadiumPulse AI 🏟️

### FIFA World Cup 2026 — Real-time Crowd Intelligence & Fan Concierge Platform

StadiumPulse AI is a unified GenAI-enabled platform designed to optimize stadium operations and elevate fan experience during the FIFA World Cup 2026. The system consists of two responsive interfaces sharing a common AI agent core and a real-time simulation engine:

1. **Fan Companion** (Mobile-first web app for navigation, rules concierge, and accessibility routing)
2. **Ops Command Center** (Staff dashboard displaying crowd heatmaps, incidents, live agent tool traces, and automated shift briefings)

---

## 🚀 Problem Statement Mapping (Pillars Covered)

| Pillar                            | How StadiumPulse AI Addresses It                                                                                  | Status               |
| :-------------------------------- | :---------------------------------------------------------------------------------------------------------------- | :------------------- |
| **1. Wayfinding & Navigation**    | Turn-by-turn directional wayfinding rendered directly on an interactive SVG Stadium Map (MetLife Stadium layout). | **Implemented (P0)** |
| **2. Crowd Management**           | Live crowd density telemetry simulation + automatic AI detection of queue backups with rerouting.                 | **Implemented (P0)** |
| **3. Operational Intelligence**   | AI-generated operations briefings summarizing telemetry, risks, and next steps for venue staff.                   | **Implemented (P0)** |
| **4. Multilingual Support**       | Gemini processes user queries in any language (e.g. Spanish, French) and translates guidance.                     | **Implemented (P0)** |
| **5. Accessibility Support**      | One-click ADA Mode prioritizing wheelchair-accessible gates (Gate D), ramps, and elevator paths.                  | **Implemented (P1)** |
| **6. Sustainability Nudges**      | Suggests public transit routes and highlights water refill points next to routing steps.                          | **Implemented (P1)** |
| **7. Real-Time Decision Support** | Low-latency WebSockets broadcast telemetry updates instantly to all connected consoles without polling.           | **Implemented (P0)** |

---

## 🛠️ Tech Stack

- **AI Foundation:** Google Gemini (via `@google/generative-ai` SDK) utilizing Function Calling & RAG.
- **RAG Grounding:** Lightweight TF-IDF local vector store seeded with MetLife Stadium match-day policies.
- **Frontends:** Next.js (App Router) + TypeScript + Tailwind CSS (Mobile-first responsive layout).
- **Backend Services:** Node/Express + WebSockets for real-time dashboard updates.
- **Package Management:** npm workspaces monorepo.
- **Accessibility:** Speech-to-Text (STT) and Text-to-Speech (TTS) utilizing browser Web Speech APIs.

---

## 📁 Architecture Overview

```
├── apps/
│   ├── fan-companion/      # Mobile-first Next.js fan chat and routing map (Port 3000)
│   └── ops-console/        # Live operations monitoring dashboard & AI briefing (Port 3003)
├── services/
│   ├── agent-core/         # Gemini agent orchestrator, RAG, and tools API (Port 3001)
│   └── simulation-engine/  # Telemetry simulation and WebSockets broadcaster (Port 3002)
├── packages/
│   └── shared-types/       # Common TypeScript types shared across the monorepo
├── docs/
│   ├── architecture.md     # Detailed sequence diagrams
│   └── DECISIONS.md        # Technical architecture decisions log
```

---

## 🏁 Quick Start & Local Execution

### Prerequisites

- Node.js (v18 or higher recommended, tested on v25)
- npm (v10 or higher)

### 1. Configure Credentials

Create a `.env` file at the root of the workspace (or copy `.env.example`):

```bash
cp .env.example .env
```

Open `.env` and add your Gemini API key:

```env
GEMINI_API_KEY=your_actual_gemini_api_key_here
```

_(Note: If no API key is provided, the backend automatically falls back to a **local rule-based agent emulator**, allowing the entire application to be demoed fully offline or without quota issues!)_

### 2. Install Dependencies

Run from the root of the repository to install and link workspace dependencies:

```bash
npm install
```

### 3. Run the Services

Start all frontends and services concurrently using:

```bash
npm run dev
```

This runs the services on the following ports:

- **Fan Companion:** [http://localhost:3000](http://localhost:3000)
- **Ops Command Center:** [http://localhost:3003](http://localhost:3003)
- **Agent Core API:** [http://localhost:3001](http://localhost:3001)
- **Simulation Telemetry:** [http://localhost:3002](http://localhost:3002)

### 4. Running Tests

Execute the agent core pathfinder unit tests using:

```bash
npm run test --workspace=services/agent-core
```

---

## 🎬 4-Minute Live Demo Script

Follow these steps to present StadiumPulse AI to judges in under 4 minutes:

### Minute 1: The Fan Experience & RAG Grounding

1. Open the **Fan Companion** ([http://localhost:3000](http://localhost:3000)).
2. Ask the assistant: `"What is the bag policy?"` or `"Can I bring my kid's stroller to the seats?"`
3. Point out how the Gemini Agent queries the local policy vector base (RAG) to fetch grounded information, explaining that strollers must be checked in at Gate A or D.
4. Turn on the **TTS (Voice Audio)** toggle and click the **Mic (STT)** icon. Speak a question (e.g. in Spanish: `"¿Dónde está la entrada handicap?"`) to demonstrate the voice-accessible, multilingual capabilities of the concierge.

### Minute 2: Operations Command Center & AI Briefings

1. Open the **Ops Command Center** ([http://localhost:3003](http://localhost:3003)) side-by-side.
2. Highlight the **Crowd Zone Density** progress bars and the color-coded indicators ticking dynamically.
3. Show the **Gemini Ops Situational Briefing** panel. Point out how the AI reads the telemetry raw logs to generate a natural-language brief of current risks and action plans for volunteers, eliminating manual radio updates.

### Minute 3: Real-Time Congestion Spike & AI Rerouting

1. In the **Ops Console**, click the **🚨 Trigger Gate C Congestion Spike** simulation button.
2. Watch the **Incident Feed** instantly display the active scanning bottleneck, while the Gate C density indicator turns red (Critical).
3. Click **Refresh** on the AI Briefing. Observe how the briefing automatically updates, highlighting Gate C congestion as a high risk and recommending redeploying staff.
4. Look at the bottom **Gemini Agent Trace Log** which details raw execution traces and parameters.

### Minute 4: Smart Fan Redirection

1. Go back to the **Fan Companion**. Ask for directions: `"Give me a route from Gate C to Section 112"`.
2. Observe the warning: `"⚠️ Gate C is currently experiencing heavy congestion. Rerouted to Gate D (ADA Accessible/Low Congestion)"`.
3. Show the interactive **SVG Stadium Map** displaying the pathing line dynamically routing the fan away from Gate C and through Gate D instead.
4. Toggle the **ADA Accessible Path** and watch the route adjust to include elevators and wheelchair ramps on Concourse Level 2.
5. In the **Ops Console**, click **Resolve** or **Reset All Telemetry** to return the stadium status to standby.

---

## 🌐 CI/CD & Cloud Deployment

StadiumPulse AI is equipped with full automated pipelines via **GitHub Actions** for continuous integration and continuous delivery (CI/CD) to **Google Cloud Run**:

### 🛠️ Continuous Integration (CI)
On every push or pull request to the `main` branch, the pipeline executes:
- **Format Verification:** Prettier code-style compliance.
- **Linting:** ESLint syntax and code quality checks.
- **Type Checking:** Monorepo-wide TypeScript compiling safety checks.
- **Unit & Integration Tests:** Runs pathfinder and routing logic tests.
- **Build Verification:** Production Next.js and server compilation.

### 🚀 Continuous Delivery (CD)
Upon merge to `main`, the deployment pipeline:
1. Authenticates securely to Google Cloud.
2. Compiles container images for **Agent Core**, **Fan Companion**, and **Ops Console**.
3. Pushes images to Google Artifact Registry.
4. Deploys services to Google Cloud Run, utilizing Google Secret Manager to safely inject the `GEMINI_API_KEY` at runtime.

#### Deployed Services (Live Links):
- 📱 **Fan Companion:** [Pending Deploy]
- 📊 **Ops Command Center:** [Pending Deploy]
- 🧠 **Agent Core API:** [Pending Deploy]

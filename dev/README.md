# Aether: Multi-Agent Orchestrator

Aether is a powerful orchestration platform designed to manage an "army" of specialized AI agents. It uses OpenAI's GPT-4o model to decompose complex goals into actionable tasks and delegates them to specialized agents (Coder, Stylist, Researcher, Builder).

## 🚀 Quick Start

### 1. Prerequisites
- Node.js 18+
- An OpenAI API Key

### 2. Installation
```bash
# Install dependencies
npm install
```

### 3. Configuration
Create a `.env` file in the root directory:
```env
OPENAI_API_KEY=your_api_key_here
NODE_ENV=production
```

### 4. Build & Run
```bash
# Build the frontend
npm run build

# Start the server
npm start
```

The application will be available at `http://localhost:3000`.

## 🧠 How it Works

1. **Orchestration**: Enter a high-level goal (e.g., "Build a landing page for a coffee shop").
2. **Planning**: The Master Orchestrator (GPT-4o) analyzes the goal and creates a set of specialized agents.
3. **Task Delegation**: Tasks are generated and assigned to the relevant agents.
4. **Autonomous Execution**: The frontend Task Engine monitors the queue and triggers agent execution via OpenAI.
5. **Real-time Feedback**: All agent activity and system telemetry are streamed via WebSockets to the dashboard.

## 🛠 Features

- **Agent Army**: View and manage your deployed agents in the "Army" tab.
- **Task Pipeline**: Monitor the status of every operation in real-time.
- **System Logs**: Deep-dive into agent reasoning and execution logs.
- **Workflow Editor**: A visual interface for managing agent workflows and n8n integrations.

## 🏗 Tech Stack

- **Frontend**: React 19, Tailwind CSS 4, Motion, Lucide Icons.
- **Backend**: Express.js, WebSockets (ws).
- **Database**: SQLite (via better-sqlite3) for persistent agent and task state.
- **AI**: OpenAI API.

---

*Built with Aether - The future of emergent agentic workflows.*

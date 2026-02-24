import express from "express";
import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("orchestrator.db");
const apiKey = process.env.OPENAI_API_KEY;

if (!apiKey) {
  throw new Error("OPENAI_API_KEY is required for AI orchestration.");
}

const aiClient = new OpenAI({ apiKey });

// Initialize DB
db.exec(`
  CREATE TABLE IF NOT EXISTS agents (
    id TEXT PRIMARY KEY,
    name TEXT,
    role TEXT,
    status TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    agent_id TEXT,
    description TEXT,
    status TEXT,
    result TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_id TEXT,
    message TEXT,
    level TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

interface PlanResponse {
  agents: Array<{ name: string; role: string }>;
  tasks: Array<{ agent_name: string; description: string }>;
}

const planSchema = {
  name: "PlanResponse",
  type: "object",
  properties: {
    agents: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          role: { type: "string" },
        },
        required: ["name", "role"],
      },
    },
    tasks: {
      type: "array",
      items: {
        type: "object",
        properties: {
          agent_name: { type: "string" },
          description: { type: "string" },
        },
        required: ["agent_name", "description"],
      },
    },
  },
  required: ["agents", "tasks"],
};

const flattenAIResponse = (response: any) => {
  if (!response?.output) return "";
  return response.output
    .map((block: any) =>
      (block?.content ?? [])
        .map((content: any) => content?.text ?? "")
        .join("")
    )
    .join("\n")
    .trim();
};

async function planArmy(goal: string): Promise<PlanResponse> {
  const response = await aiClient.responses.create({
    model: "gpt-4o-mini",
    input: [
      {
        role: "system",
        content:
          "You are the Master Orchestrator. Decompose user goals into a small team of specialized agents (3-5 max) and their first tasks.",
      },
      {
        role: "user",
        content: `User Request: "${goal}"

Return a JSON object with { agents: [{ name, role }], tasks: [{ agent_name, description }] }. Roles may include Coder, Stylist, Researcher, Builder.`,
      },
    ],
    text: {
      format: {
        name: "plan_schema",
        type: "json_schema",
        schema: planSchema,
      },
    },
  });

  let parsed = response.output_parsed as PlanResponse | PlanResponse[] | null | undefined;
  if (Array.isArray(parsed)) {
    parsed = parsed[0];
  }

  if (!parsed || typeof parsed !== "object") {
    const fallback = flattenAIResponse(response);
    if (!fallback) {
      return { agents: [], tasks: [] };
    }
    return JSON.parse(fallback);
  }

  return parsed as PlanResponse;
}

async function runAgentTask(agent: any, task: any, context: string): Promise<string> {
  const response = await aiClient.responses.create({
    model: "gpt-4o-mini",
    input: [
      {
        role: "system",
        content: `You are ${agent.role} agent named ${agent.name}. Be concise, focus on the task, and include a short summary plus suggested next steps`,
      },
      {
        role: "user",
        content: `Task: ${task.description}\n\nContext:\n${context}`,
      },
    ],
    max_output_tokens: 600,
  });

  return flattenAIResponse(response) || "Task completed with no output.";
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  const wss = new WebSocketServer({ server });
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.get("/api/agents", (req, res) => {
    const agents = db.prepare("SELECT * FROM agents ORDER BY created_at DESC").all();
    res.json(agents);
  });

  app.post("/api/ai/plan", async (req, res) => {
    const { goal } = req.body;
    if (!goal || typeof goal !== "string") {
      return res.status(400).json({ error: "goal is required" });
    }
    try {
      const plan = await planArmy(goal);
      res.json(plan);
    } catch (error) {
      console.error("AI plan failed", error);
      res.status(500).json({ error: "failed to build plan" });
    }
  });

  app.post("/api/ai/run", async (req, res) => {
    const { agent, task, context } = req.body;
    if (!agent || !task) {
      return res.status(400).json({ error: "agent and task are required" });
    }
    try {
      const runResult = await runAgentTask(agent, task, context || "");
      res.json({ result: runResult });
    } catch (error) {
      console.error("AI task failed", error);
      res.status(500).json({ error: "failed to execute task" });
    }
  });

  app.post("/api/agents", (req, res) => {
    const { id, name, role, status } = req.body;
    db.prepare("INSERT INTO agents (id, name, role, status) VALUES (?, ?, ?, ?)").run(id, name, role, status);
    broadcast({ type: "agent_created", agent: { id, name, role, status } });
    res.json({ success: true });
  });

  app.get("/api/tasks", (req, res) => {
    const tasks = db.prepare("SELECT * FROM tasks ORDER BY created_at DESC").all();
    res.json(tasks);
  });

  app.post("/api/tasks", (req, res) => {
    const { id, agent_id, description, status } = req.body;
    db.prepare("INSERT INTO tasks (id, agent_id, description, status) VALUES (?, ?, ?, ?)").run(id, agent_id, description, status);
    broadcast({ type: "task_created", task: { id, agent_id, description, status } });
    res.json({ success: true });
  });

  app.post("/api/logs", (req, res) => {
    const { agent_id, message, level } = req.body;
    db.prepare("INSERT INTO logs (agent_id, message, level) VALUES (?, ?, ?)").run(agent_id, message, level);
    broadcast({ type: "log_entry", log: { agent_id, message, level, created_at: new Date().toISOString() } });
    res.json({ success: true });
  });

  app.get("/api/logs/:agentId", (req, res) => {
    const logs = db.prepare("SELECT * FROM logs WHERE agent_id = ? ORDER BY created_at ASC").all(req.params.agentId);
    res.json(logs);
  });

  // WebSocket handling
  const clients = new Set<WebSocket>();
  wss.on("connection", (ws) => {
    clients.add(ws);
    ws.on("close", () => clients.delete(ws));
  });

  function broadcast(data: any) {
    const message = JSON.stringify(data);
    clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "public_html")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "public_html", "index.html"));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

import express from "express";
import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("orchestrator.db");

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
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

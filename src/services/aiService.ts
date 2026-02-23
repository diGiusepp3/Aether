export enum AgentRole {
  ORCHESTRATOR = "Orchestrator",
  CODER = "Coder",
  STYLIST = "Stylist",
  RESEARCHER = "Researcher",
  BUILDER = "Builder",
}

export interface Agent {
  id: string;
  name: string;
  role: AgentRole;
  status: "idle" | "working" | "error";
}

export interface Task {
  id: string;
  agent_id: string;
  description: string;
  status: "pending" | "completed" | "failed";
  result?: string;
}

const jsonHeaders = { "Content-Type": "application/json" };

export const aiService = {
  async planArmy(goal: string) {
    const response = await fetch("/api/ai/plan", {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({ goal }),
    });
    if (!response.ok) {
      throw new Error("Failed to plan agents");
    }
    return response.json();
  },

  async runAgentTask(agent: Agent, task: Task, context: string) {
    const response = await fetch("/api/ai/run", {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({ agent, task, context }),
    });
    if (!response.ok) {
      throw new Error("Failed to run agent task");
    }
    const data = await response.json();
    return data.result;
  },
};

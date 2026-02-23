import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

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

export const geminiService = {
  async planArmy(goal: string): Promise<{ agents: Partial<Agent>[], tasks: Partial<Task>[] }> {
    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: `You are the Master Orchestrator. Your goal is to decompose the following user request into a set of specialized agents and their initial tasks.
      
      User Request: "${goal}"
      
      Return a JSON object with:
      1. agents: an array of { name, role }
      2. tasks: an array of { agent_name, description }
      
      Available Roles: Coder, Stylist, Researcher, Builder.
      Limit to 3-5 agents initially.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            agents: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  role: { type: Type.STRING },
                },
                required: ["name", "role"],
              },
            },
            tasks: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  agent_name: { type: Type.STRING },
                  description: { type: Type.STRING },
                },
                required: ["agent_name", "description"],
              },
            },
          },
          required: ["agents", "tasks"],
        },
      },
    });

    return JSON.parse(response.text);
  },

  async runAgentTask(agent: Agent, task: Task, context: string): Promise<string> {
    const config: any = {
      systemInstruction: `You are a specialized AI agent. Be precise, professional, and focus only on your assigned role.`,
    };

    if (agent.role === AgentRole.RESEARCHER) {
      config.tools = [{ googleSearch: {} }];
    }

    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: `You are the ${agent.role} agent named ${agent.name}.
      Your current task: ${task.description}
      
      Context from previous steps:
      ${context}
      
      Perform the task and provide a detailed report or the resulting code/content.`,
      config
    });

    return response.text || "Task completed with no output.";
  }
};

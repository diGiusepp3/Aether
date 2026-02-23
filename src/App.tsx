import React, { useState, useEffect, useRef } from 'react';
import { 
  Bot, 
  Cpu, 
  Terminal, 
  Search, 
  Code, 
  Palette, 
  Hammer, 
  Play, 
  Plus, 
  Activity,
  ChevronRight,
  Layers,
  Zap,
  CheckCircle2,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { aiService, Agent, Task, AgentRole } from './services/aiService';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function App() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [goal, setGoal] = useState('');
  const [isPlanning, setIsPlanning] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchData();
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}`);

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'agent_created') {
        setAgents(prev => [data.agent, ...prev]);
      } else if (data.type === 'task_created') {
        setTasks(prev => [data.task, ...prev]);
      } else if (data.type === 'log_entry') {
        setLogs(prev => [...prev, data.log]);
      }
    };

    return () => ws.close();
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  const fetchData = async () => {
    const [agentsRes, tasksRes] = await Promise.all([
      fetch('/api/agents').then(res => res.json()),
      fetch('/api/tasks').then(res => res.json())
    ]);
    setAgents(agentsRes);
    setTasks(tasksRes);
  };

  const handleOrchestrate = async () => {
    if (!goal.trim()) return;
    setIsPlanning(true);
    try {
      const plan = await aiService.planArmy(goal);
      
      // Create Agents
      const createdAgents: Agent[] = [];
      for (const a of plan.agents) {
        const id = Math.random().toString(36).substr(2, 9);
        const newAgent: Agent = { id, name: a.name!, role: a.role as AgentRole, status: 'idle' };
        await fetch('/api/agents', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newAgent)
        });
        createdAgents.push(newAgent);
        
        await fetch('/api/logs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ agent_id: id, message: `Agent ${a.name} initialized as ${a.role}`, level: 'info' })
        });
      }

      // Create Tasks
      for (const t of plan.tasks) {
        const taskData = t as { agent_name: string, description: string };
        const agent = createdAgents.find(a => a.name === taskData.agent_name);
        if (agent) {
          const taskId = Math.random().toString(36).substr(2, 9);
          await fetch('/api/tasks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: taskId, agent_id: agent.id, description: taskData.description, status: 'pending' })
          });
        }
      }
      
      setGoal('');
    } catch (error) {
      console.error(error);
    } finally {
      setIsPlanning(false);
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'Coder': return <Code className="w-4 h-4" />;
      case 'Stylist': return <Palette className="w-4 h-4" />;
      case 'Researcher': return <Search className="w-4 h-4" />;
      case 'Builder': return <Hammer className="w-4 h-4" />;
      default: return <Bot className="w-4 h-4" />;
    }
  };

  const [activeTab, setActiveTab] = useState<'dashboard' | 'canvas' | 'workflow'>('dashboard');
  const [isExecuting, setIsExecuting] = useState(false);

  // Task Execution Engine
  useEffect(() => {
    const executeNextTask = async () => {
      if (isExecuting) return;
      
      const nextTask = tasks.find(t => t.status === 'pending');
      if (!nextTask) return;

      const agent = agents.find(a => a.id === nextTask.agent_id);
      if (!agent) return;

      setIsExecuting(true);
      
      try {
        // Update agent status to working
        await fetch('/api/logs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            agent_id: agent.id, 
            message: `Starting task: ${nextTask.description}`, 
            level: 'info' 
          })
        });

        // Simulate execution context (in a real app, this would be more complex)
        const context = logs.filter(l => l.agent_id === agent.id).map(l => l.message).join('\n');
        const result = await aiService.runAgentTask(agent, nextTask, context);

        // Log result
        await fetch('/api/logs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            agent_id: agent.id, 
            message: `Task Completed: ${result.substring(0, 100)}...`, 
            level: 'success' 
          })
        });

        // Mark task as completed (In a real app, we'd have a PATCH /api/tasks/:id)
        // For this demo, we'll just update local state to prevent loops
        setTasks(prev => prev.map(t => t.id === nextTask.id ? { ...t, status: 'completed' } : t));

      } catch (error) {
        console.error("Task execution failed", error);
        await fetch('/api/logs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            agent_id: agent.id, 
            message: `Task Failed: ${error instanceof Error ? error.message : 'Unknown error'}`, 
            level: 'error' 
          })
        });
        setTasks(prev => prev.map(t => t.id === nextTask.id ? { ...t, status: 'failed' } : t));
      } finally {
        setIsExecuting(false);
      }
    };

    const timer = setTimeout(executeNextTask, 2000);
    return () => clearTimeout(timer);
  }, [tasks, agents, isExecuting, logs]);

  return (
    <div className="min-h-screen bg-[#0A0A0B] text-[#E1E1E3] font-sans selection:bg-emerald-500/30">
      {/* Header */}
      <header className="h-16 border-b border-white/5 flex items-center justify-between px-6 bg-[#0A0A0B]/80 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Layers className="text-black w-5 h-5" />
            </div>
            <h1 className="font-bold tracking-tight text-lg">AETHER</h1>
          </div>
          
          <nav className="flex items-center gap-1 bg-white/5 p-1 rounded-xl border border-white/10">
            {[
              { id: 'dashboard', icon: Activity, label: 'Command' },
              { id: 'canvas', icon: Layers, label: 'Army' },
              { id: 'workflow', icon: Cpu, label: 'Workflow' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={cn(
                  "flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-medium transition-all",
                  activeTab === tab.id ? "bg-emerald-500 text-black shadow-lg shadow-emerald-500/20" : "text-white/40 hover:text-white hover:bg-white/5"
                )}
              >
                <tab.icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-full border border-white/10">
            <Activity className="w-3 h-3 text-emerald-500 animate-pulse" />
            <span className="text-[10px] font-mono uppercase tracking-widest opacity-60">System Online</span>
          </div>
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-emerald-500 to-cyan-500 border border-white/20" />
        </div>
      </header>

      <main className="flex h-[calc(100vh-64px)] overflow-hidden">
        {/* Sidebar - Agent Army */}
        <aside className="w-72 border-r border-white/5 flex flex-col bg-[#0D0D0F]">
          <div className="p-4 border-b border-white/5 flex items-center justify-between">
            <h2 className="text-xs font-mono uppercase tracking-widest opacity-50 flex items-center gap-2">
              <Cpu className="w-3 h-3" /> Agent Army
            </h2>
            <span className="text-[10px] font-mono bg-white/5 px-2 py-0.5 rounded border border-white/10">{agents.length}</span>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {agents.map((agent) => (
              <button
                key={agent.id}
                onClick={() => setSelectedAgentId(agent.id)}
                className={cn(
                  "w-full flex items-center gap-3 p-3 rounded-xl transition-all group",
                  selectedAgentId === agent.id ? "bg-emerald-500/10 border border-emerald-500/20" : "hover:bg-white/5 border border-transparent"
                )}
              >
                <div className={cn(
                  "w-10 h-10 rounded-lg flex items-center justify-center transition-colors",
                  selectedAgentId === agent.id ? "bg-emerald-500 text-black" : "bg-white/5 text-white/40 group-hover:text-white"
                )}>
                  {getRoleIcon(agent.role)}
                </div>
                <div className="text-left flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{agent.name}</div>
                  <div className="text-[10px] font-mono opacity-40 uppercase">{agent.role}</div>
                </div>
                {agent.status === 'working' && (
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                )}
              </button>
            ))}
            {agents.length === 0 && (
              <div className="p-8 text-center opacity-20 flex flex-col items-center gap-3">
                <Bot className="w-8 h-8" />
                <p className="text-xs">No agents deployed</p>
              </div>
            )}
          </div>
        </aside>

        {/* Main Content */}
        <section className="flex-1 flex flex-col min-w-0 bg-[#0A0A0B]">
          {/* Command Input */}
          <div className="p-6 border-b border-white/5">
            <div className="max-w-3xl mx-auto relative">
              <input
                type="text"
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleOrchestrate()}
                placeholder="Describe your objective to the Orchestrator..."
                className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-14 pr-32 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all text-sm"
              />
              <div className="absolute left-5 top-1/2 -translate-y-1/2 text-white/20">
                <Zap className="w-5 h-5" />
              </div>
              <button
                onClick={handleOrchestrate}
                disabled={isPlanning || !goal.trim()}
                className="absolute right-2 top-1/2 -translate-y-1/2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 disabled:hover:bg-emerald-500 text-black px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2"
              >
                {isPlanning ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3 fill-current" />}
                ORCHESTRATE
              </button>
            </div>
          </div>

          {/* Dashboard Grid */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="max-w-6xl mx-auto h-full">
              {activeTab === 'dashboard' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full">
                  {/* Task Queue */}
                  <div className="flex flex-col gap-4">
                    <h3 className="text-xs font-mono uppercase tracking-widest opacity-50 flex items-center gap-2 px-2">
                      <Terminal className="w-3 h-3" /> Task Pipeline
                    </h3>
                    <div className="flex-1 bg-[#0D0D0F] border border-white/5 rounded-2xl overflow-hidden flex flex-col">
                      <div className="p-4 border-b border-white/5 bg-white/5">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-mono opacity-60">ACTIVE OPERATIONS</span>
                          <span className="text-[10px] font-mono opacity-60">{tasks.length} TOTAL</span>
                        </div>
                      </div>
                      <div className="flex-1 overflow-y-auto p-4 space-y-3">
                        {tasks.map((task) => (
                          <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            key={task.id}
                            className="p-4 bg-white/5 border border-white/10 rounded-xl group hover:border-emerald-500/30 transition-colors"
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-[10px] font-mono text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                                    {agents.find(a => a.id === task.agent_id)?.name || 'Unknown'}
                                  </span>
                                  <ChevronRight className="w-3 h-3 opacity-20" />
                                  <span className="text-xs font-medium truncate opacity-80">{task.description}</span>
                                </div>
                                <p className="text-[10px] opacity-40 font-mono">ID: {task.id}</p>
                              </div>
                              {task.status === 'completed' ? (
                                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                              ) : task.status === 'failed' ? (
                                <AlertCircle className="w-4 h-4 text-red-500" />
                              ) : (
                                <div className="w-4 h-4 rounded-full border-2 border-emerald-500/20 border-t-emerald-500 animate-spin" />
                              )}
                            </div>
                          </motion.div>
                        ))}
                        {tasks.length === 0 && (
                          <div className="h-full flex flex-col items-center justify-center opacity-10 gap-4 py-20">
                            <Terminal className="w-12 h-12" />
                            <p className="text-sm font-mono">Awaiting instructions...</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Real-time Logs */}
                  <div className="flex flex-col gap-4">
                    <h3 className="text-xs font-mono uppercase tracking-widest opacity-50 flex items-center gap-2 px-2">
                      <Activity className="w-3 h-3" /> System Logs
                    </h3>
                    <div className="flex-1 bg-[#0D0D0F] border border-white/5 rounded-2xl overflow-hidden flex flex-col font-mono text-[11px]">
                      <div className="p-4 border-b border-white/5 bg-black/40 flex items-center justify-between">
                        <div className="flex gap-1.5">
                          <div className="w-2 h-2 rounded-full bg-red-500/50" />
                          <div className="w-2 h-2 rounded-full bg-yellow-500/50" />
                          <div className="w-2 h-2 rounded-full bg-emerald-500/50" />
                        </div>
                        <span className="opacity-40">LIVE_TELEMETRY.LOG</span>
                      </div>
                      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-1.5">
                        {logs.map((log, i) => (
                          <div key={i} className="flex gap-3 group">
                            <span className="opacity-20 select-none">[{new Date(log.created_at).toLocaleTimeString()}]</span>
                            <span className={cn(
                              "font-bold",
                              log.level === 'error' ? 'text-red-500' : 'text-emerald-500/70'
                            )}>
                              {agents.find(a => a.id === log.agent_id)?.name || 'SYS'}:
                            </span>
                            <span className="opacity-70 group-hover:opacity-100 transition-opacity">{log.message}</span>
                          </div>
                        ))}
                        {logs.length === 0 && (
                          <div className="opacity-10 py-4 italic">No telemetry data...</div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'canvas' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {agents.map((agent) => (
                    <motion.div
                      layoutId={agent.id}
                      key={agent.id}
                      className="bg-[#0D0D0F] border border-white/5 rounded-2xl p-6 flex flex-col gap-4 hover:border-emerald-500/30 transition-all group"
                    >
                      <div className="flex items-center justify-between">
                        <div className="w-12 h-12 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-500 group-hover:bg-emerald-500 group-hover:text-black transition-all">
                          {getRoleIcon(agent.role)}
                        </div>
                        <div className="flex flex-col items-end">
                          <span className="text-[10px] font-mono opacity-40 uppercase tracking-widest">{agent.role}</span>
                          <span className="text-xs font-bold text-emerald-500">ACTIVE</span>
                        </div>
                      </div>
                      <div>
                        <h4 className="text-lg font-bold mb-1">{agent.name}</h4>
                        <p className="text-xs opacity-50">Specialized in {agent.role.toLowerCase()} operations and multi-agent collaboration.</p>
                      </div>
                      <div className="pt-4 border-t border-white/5 flex items-center justify-between">
                        <div className="flex -space-x-2">
                          {[1, 2, 3].map(i => (
                            <div key={i} className="w-6 h-6 rounded-full bg-white/5 border border-[#0A0A0B]" />
                          ))}
                        </div>
                        <button className="text-[10px] font-bold text-emerald-500 hover:underline">VIEW DETAILS</button>
                      </div>
                    </motion.div>
                  ))}
                  {agents.length === 0 && (
                    <div className="col-span-full py-20 text-center opacity-20">
                      <Layers className="w-12 h-12 mx-auto mb-4" />
                      <p>No agents deployed in the field.</p>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'workflow' && (
                <div className="h-full flex flex-col gap-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-[#0D0D0F] border border-white/5 rounded-2xl p-6 flex flex-col gap-4">
                      <div className="flex items-center justify-between">
                        <h4 className="font-bold">Active Workflows</h4>
                        <Plus className="w-4 h-4 text-emerald-500 cursor-pointer" />
                      </div>
                      <div className="space-y-2">
                        {['Code Review Loop', 'Asset Generation', 'SEO Research'].map(w => (
                          <div key={w} className="p-3 bg-white/5 rounded-xl border border-white/10 flex items-center justify-between group cursor-pointer hover:border-emerald-500/30">
                            <span className="text-xs">{w}</span>
                            <Play className="w-3 h-3 opacity-0 group-hover:opacity-100 text-emerald-500" />
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="md:col-span-2 bg-[#0D0D0F] border border-white/5 rounded-2xl flex flex-col overflow-hidden">
                      <div className="p-4 border-b border-white/5 bg-white/5 flex items-center justify-between">
                        <span className="text-xs font-bold">Workflow Editor: Code Review Loop</span>
                        <button className="px-3 py-1 bg-emerald-500 text-black rounded-lg text-[10px] font-bold">SAVE WORKFLOW</button>
                      </div>
                      <div className="flex-1 p-8 relative overflow-hidden bg-[radial-gradient(#ffffff10_1px,transparent_1px)] [background-size:20px_20px]">
                        {/* Mock Nodes */}
                        <div className="absolute top-10 left-10 p-4 bg-white/5 border border-emerald-500/50 rounded-xl shadow-2xl backdrop-blur-sm">
                          <div className="text-[10px] font-mono opacity-40 mb-2">TRIGGER</div>
                          <div className="text-xs font-bold">On Task Created</div>
                        </div>
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 p-4 bg-white/5 border border-white/20 rounded-xl shadow-2xl backdrop-blur-sm">
                          <div className="text-[10px] font-mono opacity-40 mb-2">ACTION</div>
                          <div className="text-xs font-bold">Analyze with GPT-4o</div>
                        </div>
                        <div className="absolute bottom-10 right-10 p-4 bg-white/5 border border-white/20 rounded-xl shadow-2xl backdrop-blur-sm">
                          <div className="text-[10px] font-mono opacity-40 mb-2">OUTPUT</div>
                          <div className="text-xs font-bold">Post to Slack</div>
                        </div>
                        {/* Mock Connections */}
                        <svg className="absolute inset-0 w-full h-full pointer-events-none">
                          <path d="M 150 60 L 300 150" stroke="rgba(16, 185, 129, 0.2)" strokeWidth="2" fill="none" />
                          <path d="M 450 150 L 600 240" stroke="rgba(16, 185, 129, 0.2)" strokeWidth="2" fill="none" />
                        </svg>
                      </div>
                    </div>
                  </div>
                  <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-6 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-emerald-500 rounded-2xl flex items-center justify-center text-black">
                        <Zap className="w-6 h-6" />
                      </div>
                      <div>
                        <h4 className="font-bold">n8n Instance Connected</h4>
                        <p className="text-xs opacity-50">Your local n8n instance is synced. 12 workflows available.</p>
                      </div>
                    </div>
                    <button className="px-6 py-3 bg-white/5 border border-white/10 rounded-xl font-bold text-sm hover:bg-white/10 transition-all">
                      OPEN N8N DASHBOARD
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

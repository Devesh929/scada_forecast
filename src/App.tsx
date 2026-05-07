import React, { useEffect, useState, useMemo } from "react";
import { engine } from "./simulation/engine";
import { OnboardingAgent as AgentLogic } from "./agent/onboardingAgent";
import { askLLM } from "./agent/llmClient";
import { buildDeviationPrompt } from "./agent/insightPrompts";
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, BarChart, Bar,
  ComposedChart
} from "recharts";
import { 
  Sun, Wind, MessageSquare, Activity, AlertTriangle, Database, 
  Settings as SettingsIcon, Play, Pause, ChevronRight, Download,
  Zap, CheckCircle2, MapPin, BarChart2, PlusCircle, LayoutDashboard, History, Info, Clock
} from "lucide-react";

const agent = new AgentLogic();

// --- Types ---
type ViewMode = "start" | "onboarding" | "simulation";
type AssetType = "solar" | "wind";

export default function App() {
  const [viewMode, setViewMode] = useState<ViewMode>("start");
  const [assetType, setAssetType] = useState<AssetType>("solar");
  const [simState, setSimState] = useState<any>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeStory, setActiveStory] = useState("ops");

  // --- Simulation Loop ---
  useEffect(() => {
    const updateState = () => {
      setSimState({
        time: engine.getTimeString(),
        ...engine.generateStateData()
      });
    };

    updateState();
    const timer = setInterval(() => {
      if (isPlaying) {
        engine.tick();
      }
      updateState();
    }, 1000);
    return () => clearInterval(timer);
  }, [isPlaying]);

  if (!simState) return null;

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="logo" onClick={() => setViewMode("start")}>
          <div className="logo-dot" />
          <span className="logo-text">SuryaGrid AI</span>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 px-4 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
            <Clock size={14} className="text-emerald-400" />
            <div className="text-[11px] font-mono font-bold text-emerald-400 uppercase tracking-widest">
              Operational Clock: <span className="text-white">{simState.time}</span> IST
            </div>
          </div>
          <button className="btn-icon" onClick={() => setViewMode("start")} title="Menu">
            <LayoutDashboard size={20} />
          </button>
        </div>
      </header>

      <main className="flex flex-1 overflow-hidden">
        {viewMode === "start" && <StartScreen onOnboard={() => setViewMode("onboarding")} onSim={() => setViewMode("simulation")} />}
        {viewMode === "onboarding" && <OnboardingView onComplete={() => setViewMode("simulation")} />}
        {viewMode === "simulation" && (
          <SimulationWorkbench 
            simState={simState} 
            assetType={assetType} 
            setAssetType={setAssetType} 
            isPlaying={isPlaying} 
            setIsPlaying={setIsPlaying}
            activeStory={activeStory}
            setActiveStory={setActiveStory}
          />
        )}
      </main>
    </div>
  );
}

// --- Start Screen ---
function StartScreen({ onOnboard, onSim }: { onOnboard: () => void; onSim: () => void }) {
  return (
    <div className="start-screen">
      <div className="start-card" onClick={onOnboard}>
        <div className="card-icon"><PlusCircle size={48} /></div>
        <h2 className="card-title">Plant Onboarding</h2>
        <p className="card-desc">Initialize new assets, analyze data schemas, and configure agentic forecasting models.</p>
      </div>
      <div className="start-card" onClick={onSim}>
        <div className="card-icon"><Zap size={48} /></div>
        <h2 className="card-title">Simulation Engine</h2>
        <p className="card-desc">Enter the operational control room. Simulate weather events and monitor real-time generation.</p>
      </div>
    </div>
  );
}

// --- Onboarding View ---
function OnboardingView({ onComplete }: { onComplete: () => void }) {
  const [inputVal, setInputVal] = useState("timestamp, actual_mw, poa_irradiance, module_temp, inverter_availability, local_limit_mw");
  const [analysis, setAnalysis] = useState<any>(null);
  const [analyzing, setAnalyzing] = useState(false);

  const handleAnalyze = () => {
    setAnalyzing(true);
    setTimeout(() => {
      const res = agent.processSchemaUpload("Karnataka Solar Cluster", inputVal);
      setAnalysis(res);
      setAnalyzing(false);
    }, 1200);
  };

  return (
    <div className="onboarding-container">
      <div className="section-title">
        <span>Asset Configuration</span>
        <h2>Onboard New Asset</h2>
        <p>Define the technical metadata and data feeds for the forecasting agent.</p>
      </div>

      <div className="grid-2">
        <div className="wb-section p-8">
          <h3 className="mb-4">Schema Definition</h3>
          <p className="text-secondary text-sm mb-6">Paste your SCADA or telemetry header string below.</p>
          <textarea 
            className="w-full h-40 bg-black/40 border border-emerald-500/20 rounded-2xl p-4 font-mono text-sm mb-6"
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
          />
          <button className="primary w-full" onClick={handleAnalyze} disabled={analyzing}>
            {analyzing ? "Analyzing Infrastructure..." : "Initialize Agent"}
          </button>
        </div>

        <div className="wb-section p-8">
          <h3 className="mb-4">Readiness Intelligence</h3>
          {!analysis ? (
            <div className="h-full flex items-center justify-center text-muted italic">
              Awaiting schema analysis...
            </div>
          ) : (
            <div className="animate-in fade-in duration-500">
              <div className="flex items-center gap-4 mb-8">
                <Kpi label="Readiness Score" value={`${analysis.readiness.score}%`} tone={analysis.readiness.score > 80 ? "green" : "amber"} />
                <Kpi label="Asset Type" value="SOLAR PV" tone="white" />
              </div>
              <div className="agent-output">
                <p className="font-bold text-green-400 mb-2 flex items-center gap-2">
                  <CheckCircle2 size={16} /> Agent Recommendation
                </p>
                <p className="text-sm">{analysis.summary}</p>
              </div>
              <div className="mt-8 space-y-2">
                <p className="text-xs font-bold uppercase text-muted">Detected Components</p>
                {analysis.readiness.available_fields.map((f: any) => (
                  <div key={f} className="flex items-center gap-2 text-sm text-secondary">
                    <div className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                    {f}
                  </div>
                ))}
              </div>
              <button className="primary w-full mt-8 flex items-center justify-center gap-2" onClick={onComplete}>
                Deploy to Production <ChevronRight size={18} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// --- Simulation Workbench ---
import SimulationTab from "./components/SimulationTab";

function SimulationWorkbench({ 
  simState, assetType, setAssetType, isPlaying, setIsPlaying 
}: any) {
  return (
    <SimulationTab 
      simState={simState} 
      assetType={assetType} 
      setAssetType={setAssetType} 
      isPlaying={isPlaying} 
      setIsPlaying={setIsPlaying} 
    />
  );
}


// --- Helper UI Components ---

function KpiCard({ label, value, tone = "green" }: { label: string; value: string | number; tone?: string }) {
  return (
    <div className="kpi-card">
      <div className="kpi-label">{label}</div>
      <div className={`kpi-value ${tone}`}>{value}</div>
    </div>
  );
}

function Kpi({ label, value, tone = "green" }: { label: string; value: string | number; tone?: "green" | "amber" | "red" | "white" }) {
  return (
    <div className="bg-black/20 border border-white/5 p-4 rounded-xl flex-1">
      <span className="text-[10px] uppercase font-bold text-muted block mb-1">{label}</span>
      <strong className={`text-xl font-bold ${tone === 'green' ? 'text-green-400' : tone === 'amber' ? 'text-amber-400' : 'text-white'}`}>{value}</strong>
    </div>
  );
}

function UnitHeatmap({ simState, assetType }: { simState: any; assetType: AssetType }) {
  const units = assetType === "solar" ? simState.blocks : simState.farms;
  return (
    <div className={`heatmap ${assetType === "wind" ? "wind" : ""}`}>
      {units.slice(0, 15).map((u: any, i: number) => {
        const perf = u.actual_mw / u.capacity_mw;
        const color = perf > 0.8 ? "rgba(53,208,127,0.4)" : perf > 0.4 ? "rgba(245,158,11,0.4)" : "rgba(239,68,68,0.4)";
        return (
          <div 
            key={i} 
            className="heat-cell" 
            style={{ backgroundColor: color, borderColor: perf > 0.8 ? '#35d07f' : perf > 0.4 ? '#f59e0b' : '#ef4444' }}
            title={`${u.actual_mw.toFixed(1)} MW`}
          />
        );
      })}
    </div>
  );
}

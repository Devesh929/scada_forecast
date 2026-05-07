import React, { useEffect, useState } from "react";
import { engine } from "./simulation/engine";
import { OnboardingAgent as AgentLogic } from "./agent/onboardingAgent";
import { analyzeRequirement } from "./agent/requirementAnalyst";
import { useDropzone } from "react-dropzone";
import { extractTextFromPDF } from "./lib/pdfUtil";
import { 
  MessageSquare, Activity, AlertTriangle, 
  Play, Pause, ChevronRight, 
  Zap, CheckCircle2, PlusCircle, LayoutDashboard, Clock, Terminal, Cpu, Rocket, ShieldCheck, RefreshCcw,
  FileText, X, Upload, FileJson, Sparkles, GitBranch, Database, Settings, Target, ShieldAlert, Info
} from "lucide-react";
import SimulationTab from "./components/SimulationTab";

const agent = new AgentLogic();

// Sample text from the PDFs to allow "Quick Load"
const SAMPLE_DOCS = [
  {
    name: "01_SuryaGrid_Business_Proposal_and_RFP_Brief.pdf",
    content: `SURYAGRID AI Business Proposal and RFP Brief.
    Objective: Implement a multi-horizon forecasting system for the Karnataka Solar Cluster (Pavagada).
    Key Requirements:
    - Real-time ramp detection (< 15min lead time)
    - Intra-hour dispatch block optimization (15min and 60min)
    - Day-ahead scheduling for SLDC compliance.
    - Deviation penalty reduction is the primary financial KPI.`
  },
  {
    name: "02_Pavagada_SCADA_MET_NWP_Data_Specification.pdf",
    content: `SURYAGRID AI SCADA, Meteorological and NWP Data Specification.
    Interfaces:
    - SCADA: Inverter-level MW, AC/DC Voltage, Current, Status Codes. (1-min resolution)
    - MET: GHI, POA, Ambient Temp, Module Temp from 4 weather stations.
    - NWP: Ensemble forecasts from ECMWF and GFS. Parameters: Clear Sky Index, Cloud Cover, Wind Speed at 10m.`
  },
  {
    name: "03_Plant_Technical_Onboarding_Dossier.pdf",
    content: `SURYAGRID AI Plant Technical Onboarding Dossier.
    Asset: Pavagada Solar Park (Sector 3 & 4). 
    Capacity: 1000MW combined.
    Equipment: 1250kW Inverters (ABB PVS-175), SMA Cluster Controllers.
    Network: Fiber backbone with fallback LTE for telemetry export.`
  },
  {
    name: "04_Grid_Operations_RFP_and_Evaluation_Brief.pdf",
    content: `SURYAGRID AI Grid Operations RFP and Evaluation Brief.
    Compliance: CERC Forecasting & Scheduling Regulations.
    Penalty Structure: Bands of 5%, 10%, 15% deviation vs schedule.
    Evaluation Metrics: Normalized Mean Absolute Error (nMAE), Bias, and Ramp Catch Rate.`
  }
];

export interface SimulationState {
  time: string;
  plants: any[];
  blocks: any[];
  farms: any[];
  alerts: any[];
  forecasts: any[];
  stateTotalActual: number;
  stateTotalForecast: number;
  stateTotalCapacity: number;
  metrics: any;
}

type ViewMode = "start" | "onboarding" | "simulation";
type AssetType = "solar" | "wind";

export default function App() {
  const [viewMode, setViewMode] = useState<ViewMode>("start");
  const [assetType, setAssetType] = useState<AssetType>("solar");
  const [simState, setSimState] = useState<any>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    const updateState = () => {
      setSimState({
        time: engine.getTimeString(),
        ...engine.generateStateData()
      });
    };
    updateState();
    const timer = setInterval(() => {
      if (isPlaying) engine.tick();
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
          />
        )}
      </main>
    </div>
  );
}

function ForecastDag({ dag }: { dag: any }) {
  if (!dag || !dag.nodes) return null;

  return (
    <div className="mt-8 p-8 bg-black/40 border border-white/5 rounded-3xl overflow-hidden relative">
      <div className="absolute top-4 right-4 flex items-center gap-2">
        <GitBranch size={14} className="text-emerald-500" />
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Execution DAG</span>
      </div>
      
      <div className="flex flex-wrap justify-center gap-8 relative py-12">
        {dag.nodes.map((node: any, idx: number) => (
          <div key={node.id || idx} className="relative group">
            <div className={`w-40 p-4 rounded-2xl border transition-all ${
              node.type === 'data_ingest' ? 'bg-blue-500/10 border-blue-500/30 text-blue-400' :
              node.type === 'processing' ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' :
              node.type === 'model' ? 'bg-purple-500/10 border-purple-500/30 text-purple-400' :
              'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
            }`}>
              <div className="flex items-center gap-2 mb-2">
                {node.type === 'data_ingest' && <Database size={14} />}
                {node.type === 'processing' && <Settings size={14} />}
                {node.type === 'model' && <Cpu size={14} />}
                {node.type === 'output' && <Zap size={14} />}
                <span className="text-[10px] font-black uppercase tracking-tighter">{node.type?.replace('_', ' ') || 'NODE'}</span>
              </div>
              <p className="text-xs font-bold text-white mb-1">{node.label}</p>
              <p className="text-[9px] text-slate-400 leading-tight opacity-0 group-hover:opacity-100 transition-opacity absolute top-full left-0 right-0 mt-2 bg-black/80 p-2 rounded-lg z-10 border border-white/10 pointer-events-none">
                {node.description}
              </p>
            </div>
            
            {idx < dag.nodes.length - 1 && (
              <div className="absolute top-1/2 -right-6 translate-x-1/2 -translate-y-1/2 hidden md:block">
                <ChevronRight size={16} className="text-slate-700" />
              </div>
            )}
          </div>
        ))}
      </div>

      {dag.edges && dag.edges.length > 0 && (
        <div className="mt-4 pt-4 border-t border-white/5 grid grid-cols-1 md:grid-cols-2 gap-4">
          {dag.edges.map((edge: any, i: number) => (
            <div key={i} className="flex items-center gap-3 text-[10px]">
              <span className="px-2 py-0.5 rounded bg-white/5 text-slate-400 font-mono">{edge.from}</span>
              <div className="flex-1 h-[1px] bg-white/5 relative">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-black px-2 text-[8px] text-slate-600 font-bold uppercase">{edge.label}</div>
              </div>
              <span className="px-2 py-0.5 rounded bg-white/5 text-slate-400 font-mono">{edge.to}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RequirementDisplay({ result }: { result: any }) {
  if (!result) return null;

  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-700 pb-20 mt-12 pt-12 border-t border-white/10">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-white/5 pb-8">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
            <span className="text-[10px] font-black uppercase text-emerald-500 tracking-[0.3em]">AI Requirements Analysis Complete</span>
          </div>
          <h2 className="text-4xl font-bold text-white tracking-tight leading-none">
            {result.request_understanding?.primary_use_case?.replace(/_/g, ' ').toUpperCase() || "Operational Plan"}
          </h2>
          <p className="text-lg text-slate-400 font-medium">
            {result.request_understanding?.business_goal_plain_language}
          </p>
        </div>
        <div className="flex gap-4">
          <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
            <p className="text-[9px] uppercase text-slate-500 font-black mb-1">Architecture</p>
            <p className="text-sm font-bold text-white">{result.recommended_solution?.architecture_style || "Hierarchical ensemble"}</p>
          </div>
          <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
            <p className="text-[9px] uppercase text-slate-500 font-black mb-1">Solution Type</p>
            <p className="text-sm font-bold text-white">{result.recommended_solution?.solution_type}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        <div className="lg:col-span-2 space-y-12">
          <section className="space-y-6">
            <h3 className="text-[10px] font-black uppercase text-slate-500 tracking-widest flex items-center gap-2">
              <Target size={14} /> Extraction: Detailed Objectives
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {result.request_understanding?.detailed_objectives?.map((obj: string, i: number) => (
                <div key={i} className="p-4 rounded-2xl bg-white/5 border border-white/5 flex gap-3">
                  <div className="w-5 h-5 rounded-full bg-emerald-500/10 flex items-center justify-center text-[10px] font-bold text-emerald-400 shrink-0">{i+1}</div>
                  <p className="text-xs text-slate-300 font-medium">{obj}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="space-y-6">
            <h3 className="text-[10px] font-black uppercase text-slate-500 tracking-widest flex items-center gap-2">
              <Clock size={14} /> Horizon-Specific Architecture
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {result.horizon_plan?.map((plan: any, i: number) => (
                <div key={i} className="group p-6 rounded-3xl bg-black/40 border border-white/10 hover:border-emerald-500/30 transition-all hover:bg-emerald-500/[0.02]">
                  <div className="flex justify-between items-start mb-6">
                    <div className="px-3 py-1 rounded-full bg-emerald-500 text-black text-[10px] font-black uppercase tracking-tighter shadow-lg shadow-emerald-500/20">
                      {plan.horizon}
                    </div>
                    <div className={`px-3 py-1 rounded-full border text-[10px] font-bold ${
                      plan.confidence === 'high' ? 'border-emerald-500/30 text-emerald-400' : 
                      plan.confidence === 'medium' ? 'border-amber-500/30 text-amber-400' : 'border-rose-500/30 text-rose-400'
                    }`}>
                      {plan.confidence.toUpperCase()} CONFIDENCE
                    </div>
                  </div>
                  <h4 className="text-lg font-bold text-white mb-3 group-hover:text-emerald-400 transition-colors">{plan.business_name}</h4>
                  <p className="text-xs text-slate-400 leading-relaxed mb-6 font-medium italic">"{plan.plain_language_explanation}"</p>
                  
                  <div className="space-y-2">
                    <p className="text-[9px] font-black uppercase text-slate-500 mb-2">Required Variables</p>
                    <div className="flex flex-wrap gap-2">
                      {plan.required_variables?.map((v: any, j: number) => (
                        <span key={j} className="px-2 py-1 rounded-lg bg-white/5 border border-white/5 text-[10px] text-slate-300 font-mono">
                          {v.variable} <span className="text-slate-600">[{v.source}]</span>
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="space-y-6">
            <h3 className="text-[10px] font-black uppercase text-slate-500 tracking-widest flex items-center gap-2">
              <GitBranch size={14} /> Forecast Execution DAG
            </h3>
            <ForecastDag dag={result.execution_dag} />
          </section>
        </div>

        <div className="space-y-12">
          <section className="space-y-6">
            <h3 className="text-[10px] font-black uppercase text-slate-500 tracking-widest flex items-center gap-2">
              <Zap size={14} /> Critical Metrics
            </h3>
            <div className="space-y-3">
              {result.recommended_solution?.required_metrics?.map((m: any, i: number) => (
                <div key={i} className="p-4 rounded-2xl bg-white/5 border border-white/5">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-bold text-white">{m.metric}</span>
                    <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded ${
                      m.importance === 'critical' ? 'bg-rose-500/20 text-rose-400' :
                      m.importance === 'high' ? 'bg-amber-500/20 text-amber-400' : 'bg-blue-500/20 text-blue-400'
                    }`}>{m.importance}</span>
                  </div>
                  <p className="text-[10px] text-slate-500 font-medium">Target: <span className="text-slate-300">{m.target}</span></p>
                </div>
              ))}
            </div>
          </section>

          <section className="space-y-6">
            <h3 className="text-[10px] font-black uppercase text-slate-500 tracking-widest flex items-center gap-2">
              <ShieldAlert size={14} /> Data Gaps & Risk
            </h3>
            <div className="p-6 rounded-3xl bg-rose-500/5 border border-rose-500/10 space-y-4">
              <p className="text-xs text-rose-200/70 leading-relaxed font-medium italic">"{result.data_gap_impact}"</p>
              <div className="space-y-2">
                <p className="text-[9px] font-black uppercase text-rose-500/60">Missing Information</p>
                {result.missing_information?.map((info: string, i: number) => (
                  <div key={i} className="flex items-start gap-2 text-[10px] text-rose-200/50">
                    <span className="text-rose-500 mt-1">•</span>
                    <span>{info}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="space-y-6">
            <h3 className="text-[10px] font-black uppercase text-slate-500 tracking-widest flex items-center gap-2">
              <Settings size={14} /> Implementation Steps
            </h3>
            <div className="space-y-4">
              {result.implementation_steps?.map((step: string, i: number) => (
                <div key={i} className="flex gap-4 items-center">
                  <div className="w-6 h-6 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-[10px] font-bold text-slate-500 shrink-0">{i+1}</div>
                  <p className="text-xs text-slate-400 font-medium">{step}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>

      <div className="flex justify-center pt-8 border-t border-white/5">
        <button 
          onClick={() => window.location.href = '/simulation'}
          className="group relative px-12 py-5 bg-emerald-500 rounded-2xl text-black font-black uppercase text-sm tracking-widest hover:bg-emerald-400 transition-all shadow-[0_20px_50px_rgba(16,185,129,0.3)] hover:scale-105 active:scale-95"
        >
          Initialize Workbench
          <div className="absolute inset-0 bg-white/20 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity blur-lg -z-10" />
        </button>
      </div>
    </div>
  );
}

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

function OnboardingView({ onComplete }: { onComplete: () => void }) {
  const [inputVal, setInputVal] = useState("timestamp, actual_mw, poa_irradiance, ambient_temp, module_temp, inverter_availability, local_limit_mw");
  const [businessReq, setBusinessReq] = useState("We need a 15-minute intra-hour forecast for our 50MW solar site in Pavagada. The goal is to minimize deviation penalties.");
  const [uploadedFiles, setUploadedFiles] = useState<any[]>([]);
  const [proposal, setProposal] = useState<any>(null);
  const [analyzing, setAnalyzing] = useState(false);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { 'application/pdf': ['.pdf'] },
    onDrop: (acceptedFiles) => {
      const newFiles = acceptedFiles.map(f => ({ file: f, isSample: false, name: f.name }));
      setUploadedFiles(prev => [...prev, ...newFiles]);
    }
  });

  const loadSamples = () => {
    setUploadedFiles(SAMPLE_DOCS.map(d => ({ ...d, isSample: true })));
    setBusinessReq("Multi-horizon renewable forecast system for deviation, dispatch, reserve and day-ahead planning as per RFP brief.");
  };

  const handleAnalyze = async () => {
    setAnalyzing(true);
    try {
      let combinedRequest = businessReq;
      
      for (const item of uploadedFiles) {
        let text = "";
        if (item.isSample) {
          text = item.content;
        } else {
          text = await extractTextFromPDF(item.file);
        }
        combinedRequest += `\n\n[DOCUMENT: ${item.name}]\n${text.slice(0, 10000)}`;
      }

      const llmProposal = await analyzeRequirement(combinedRequest, "Karnataka Solar Cluster", inputVal);
      setProposal(llmProposal);
    } catch (err) {
      console.error(err);
      alert("Analysis failed. See console.");
    } finally {
      setAnalyzing(false);
    }
  };

  const removeFile = (index: number) => {
    setUploadedFiles(files => files.filter((_, i) => i !== index));
  };

  return (
    <div className="onboarding-container w-full max-w-full overflow-x-hidden">
      <div className="max-w-[1400px] mx-auto px-12 py-12">
        <div className="flex justify-between items-start mb-12">
          <div className="section-title">
            <div className="flex items-center gap-3 mb-2">
               <div className="p-2 bg-emerald-500/20 rounded-lg text-emerald-400"><Rocket size={20} /></div>
               <span className="text-sm font-bold uppercase tracking-widest text-emerald-400">Strategic Onboarding</span>
            </div>
            <h2 className="text-4xl font-black text-white">Initialize Forecasting Agent</h2>
            <p className="text-slate-400 mt-2 max-w-2xl">Augment your request with RFP documents and data specifications for high-fidelity planning.</p>
          </div>
          <button 
            onClick={loadSamples}
            className="flex items-center gap-2 px-6 py-3 bg-blue-500/10 border border-blue-500/30 rounded-2xl text-blue-400 text-xs font-black uppercase tracking-widest hover:bg-blue-500/20 transition-all"
          >
            <Sparkles size={16} /> Load Sample RFP Dossier
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          <div className="space-y-8">
            <div className="bg-[#050a0a] border border-white/5 rounded-3xl p-8 shadow-2xl">
              <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-3">
                <MessageSquare size={18} className="text-blue-400" />
                1. Project Requirements & Document Context
              </h3>
              <textarea 
                className="w-full h-24 bg-black/40 border border-white/10 rounded-2xl p-4 font-medium text-sm mb-4 focus:border-blue-500/50 outline-none text-slate-300"
                value={businessReq}
                onChange={(e) => setBusinessReq(e.target.value)}
              />

              <div 
                {...getRootProps()} 
                className={`border-2 border-dashed rounded-2xl p-6 mb-4 transition-all cursor-pointer flex flex-col items-center justify-center gap-2 ${
                  isDragActive ? "border-emerald-500 bg-emerald-500/5" : "border-white/10 hover:border-white/20 bg-white/5"
                }`}
              >
                <input {...getInputProps()} />
                <Upload className="text-slate-500" size={24} />
                <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Drag & Drop RFP PDFs</p>
              </div>

              {uploadedFiles.length > 0 && (
                <div className="space-y-2">
                  {uploadedFiles.map((f, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-white/5 border border-white/5 rounded-xl">
                      <div className="flex items-center gap-3">
                        <FileText size={16} className={f.isSample ? "text-blue-400" : "text-emerald-400"} />
                        <span className="text-xs text-slate-300 truncate max-w-[250px]">{f.name}</span>
                        {f.isSample && <span className="text-[8px] px-1.5 py-0.5 bg-blue-500/20 text-blue-400 rounded uppercase font-bold">Sample</span>}
                      </div>
                      <button onClick={() => removeFile(i)} className="text-slate-500 hover:text-rose-400 transition-colors">
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-[#050a0a] border border-white/5 rounded-3xl p-8 shadow-2xl">
              <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-3">
                <Terminal size={18} className="text-emerald-400" />
                2. Technical Telemetry Schema
              </h3>
              <textarea 
                className="w-full h-24 bg-black/40 border border-white/10 rounded-2xl p-4 font-mono text-[11px] mb-6 focus:border-emerald-500/50 outline-none text-emerald-400/80"
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
              />
              <button 
                className="w-full py-4 bg-emerald-500 hover:bg-emerald-400 text-black font-black uppercase tracking-widest rounded-2xl transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                onClick={handleAnalyze} 
                disabled={analyzing}
              >
                {analyzing ? (
                  <><RefreshCcw className="animate-spin" size={20} /> Extracting Intelligence...</>
                ) : (
                  <><Cpu size={20} /> Initialize Strategic Agent</>
                )}
              </button>
            </div>
          </div>

          <div className="bg-[#050a0a] border border-emerald-500/20 rounded-3xl p-8 shadow-2xl overflow-hidden relative min-h-[600px] flex flex-col items-center justify-center">
            <div className="absolute top-0 right-0 p-8 opacity-5"><ShieldCheck size={200} /></div>
            
            {!proposal ? (
              <div className="flex flex-col items-center justify-center text-slate-500 italic space-y-4">
                <div className="w-12 h-12 border-2 border-slate-800 border-t-emerald-500 rounded-full animate-spin" />
                <p>Awaiting requirement analysis...</p>
              </div>
            ) : (
              <div className="text-center space-y-4">
                <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center text-emerald-400 mx-auto">
                  <CheckCircle2 size={40} />
                </div>
                <h4 className="text-xl font-bold text-white">Analysis Ready</h4>
                <p className="text-slate-400 max-w-xs mx-auto">Scroll down to view the full strategic architecture and execution DAG.</p>
              </div>
            )}
          </div>
        </div>

        {proposal && <RequirementDisplay result={proposal} />}
      </div>
    </div>
  );
}

function SimulationWorkbench({ simState, assetType, setAssetType, isPlaying, setIsPlaying }: any) {
  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#020806]">
      <SimulationTab 
        simState={simState} 
        assetType={assetType} 
        setAssetType={setAssetType} 
        isPlaying={isPlaying} 
        setIsPlaying={setIsPlaying} 
      />
    </div>
  );
}

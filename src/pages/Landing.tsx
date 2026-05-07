import React from "react";
import { ArrowRight, Activity, Database, AlertTriangle } from "lucide-react";

export default function Landing() {
  return (
    <div className="max-w-5xl mx-auto py-8">
      <div className="mb-12">
        <h1 className="text-4xl font-bold mb-4 tracking-tight">RampMitra AI</h1>
        <p className="text-xl text-slate-400 mb-6">
          Agentic Renewable Forecasting, SCADA Readiness, and Curtailment Detection
        </p>
        <p className="text-slate-300 max-w-3xl leading-relaxed">
          RampMitra AI does not assume one universal model fits every renewable plant. It first understands the plant's available infrastructure — SCADA, meteorological sensors, weather forecasts, local limits, and historical data. It then recommends the right horizon-wise forecasting pipeline to produce probabilistic forecasts, ramp alerts, curtailment detection, and operator-ready recommendations.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <Database className="text-blue-400 mb-4" size={32} />
          <h3 className="text-lg font-semibold mb-2">1. Onboard Any Plant</h3>
          <p className="text-sm text-slate-400">
            Upload SCADA schemas and metadata. The agent maps data, scores readiness, and outputs data contracts.
          </p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <Activity className="text-emerald-400 mb-4" size={32} />
          <h3 className="text-lg font-semibold mb-2">2. Dynamic Forecasting</h3>
          <p className="text-sm text-slate-400">
            Automatically select persistence, physical PV, or ML residual models based on data tier and forecast horizon.
          </p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <AlertTriangle className="text-amber-400 mb-4" size={32} />
          <h3 className="text-lg font-semibold mb-2">3. Explain Risk & Action</h3>
          <p className="text-sm text-slate-400">
            Detect cloud ramps, curtailment vs equipment faults, and explain the root cause using an LLM.
          </p>
        </div>
      </div>

      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-8 mb-8">
        <h2 className="text-xl font-semibold mb-6">Workflow</h2>
        <div className="flex items-center justify-between text-sm font-medium text-slate-300">
          <div className="flex flex-col items-center gap-2">
            <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center border border-slate-700">1</div>
            <span>Plant Data</span>
          </div>
          <ArrowRight className="text-slate-600" />
          <div className="flex flex-col items-center gap-2">
            <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center border border-slate-700 text-blue-400">2</div>
            <span>Readiness Agent</span>
          </div>
          <ArrowRight className="text-slate-600" />
          <div className="flex flex-col items-center gap-2">
            <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center border border-slate-700 text-purple-400">3</div>
            <span>Forecast Design</span>
          </div>
          <ArrowRight className="text-slate-600" />
          <div className="flex flex-col items-center gap-2">
            <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center border border-slate-700 text-emerald-400">4</div>
            <span>Probabilistic Engine</span>
          </div>
          <ArrowRight className="text-slate-600" />
          <div className="flex flex-col items-center gap-2">
            <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center border border-slate-700 text-amber-400">5</div>
            <span>Alerts & Actions</span>
          </div>
        </div>
      </div>
      
      <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4 text-xs text-amber-200/80">
        <strong>Note:</strong> This prototype uses synthetic SCADA, weather, availability, curtailment, and forecast data generated locally. Reported accuracy values are synthetic backtest metrics and should not be interpreted as production performance. Production deployment requires real plant SCADA, weather/NWP feeds, and operational validation.
      </div>
    </div>
  );
}

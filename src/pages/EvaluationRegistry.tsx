import React from "react";
import { BarChart2, Activity, GitCommit, CheckCircle2 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, ScatterChart, Scatter, ZAxis, ReferenceLine } from "recharts";

export default function EvaluationRegistry() {
  // Mock data for the error histogram
  const errorHistogramData = [
    { range: "-5%", count: 12 },
    { range: "-3%", count: 28 },
    { range: "-1%", count: 85 },
    { range: "0%", count: 120 },
    { range: "+1%", count: 76 },
    { range: "+3%", count: 22 },
    { range: "+5%", count: 8 },
  ];

  // Mock data for reliability/ROC scatter (Forecast Probability vs Observed Frequency)
  const reliabilityData = [
    { forecast: 10, observed: 12 },
    { forecast: 20, observed: 18 },
    { forecast: 30, observed: 33 },
    { forecast: 40, observed: 42 },
    { forecast: 50, observed: 48 },
    { forecast: 60, observed: 58 },
    { forecast: 70, observed: 65 },
    { forecast: 80, observed: 82 },
    { forecast: 90, observed: 88 },
  ];

  const models = [
    { id: "PV_PHYS_LGBM", name: "PV Physical + LightGBM Residual", asset: "Solar", horizon: "2-Hour", nmae: "5.2%", coverage: "84%", status: "CHAMPION" },
    { id: "PV_Q_XGB", name: "Quantile XGBoost Direct", asset: "Solar", horizon: "2-Hour", nmae: "5.8%", coverage: "88%", status: "CHALLENGER" },
    { id: "PERSIST_5M", name: "Ramp-Rate Persistence", asset: "Solar/Wind", horizon: "5-Min", nmae: "2.1%", coverage: "92%", status: "CHAMPION" },
    { id: "WIND_PC_XGB", name: "Power Curve + XGB Residual", asset: "Wind", horizon: "2-Hour", nmae: "7.8%", coverage: "81%", status: "CHAMPION" },
    { id: "NWP_ENS_40", name: "NWP Ensemble Scenario", asset: "Portfolio", horizon: "40-Hour", nmae: "11.5%", coverage: "78%", status: "CHAMPION" },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <BarChart2 className="text-purple-400" size={18} />
            Error Distribution (2-Hour Horizon)
          </h3>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={errorHistogramData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} vertical={false} />
                <XAxis dataKey="range" stroke="#94a3b8" fontSize={12} />
                <YAxis stroke="#94a3b8" fontSize={12} />
                <RechartsTooltip 
                  cursor={{fill: '#1e293b'}}
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f8fafc' }}
                />
                <Bar dataKey="count" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Activity className="text-emerald-400" size={18} />
            Event Reliability Diagram (Cloud Ramps)
          </h3>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                <XAxis type="number" dataKey="forecast" name="Forecast Prob" stroke="#94a3b8" fontSize={12} domain={[0, 100]} />
                <YAxis type="number" dataKey="observed" name="Observed Freq" stroke="#94a3b8" fontSize={12} domain={[0, 100]} />
                <ZAxis range={[50, 50]} />
                <RechartsTooltip cursor={{strokeDasharray: '3 3'}} contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f8fafc' }} />
                {/* Perfect calibration line */}
                <ReferenceLine segment={[{ x: 0, y: 0 }, { x: 100, y: 100 }]} stroke="#64748b" strokeDasharray="3 3" />
                <Scatter name="Calibration" data={reliabilityData} fill="#10b981" line={{stroke: '#10b981', strokeWidth: 2}} />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <div className="flex justify-between items-center mb-6">
          <h3 className="font-semibold flex items-center gap-2">
            <GitCommit className="text-blue-400" size={18} />
            Model Registry & Champion/Challenger
          </h3>
          <button className="px-3 py-1.5 bg-blue-600/20 text-blue-400 rounded-md text-xs font-medium border border-blue-500/30 hover:bg-blue-600/30 transition-colors">
            Retrain Models
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-slate-400 uppercase bg-slate-800/50">
              <tr>
                <th className="px-4 py-3 rounded-tl-lg">Model ID</th>
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3">Asset & Horizon</th>
                <th className="px-4 py-3">nMAE</th>
                <th className="px-4 py-3">P10/P90 Coverage</th>
                <th className="px-4 py-3 rounded-tr-lg">Status</th>
              </tr>
            </thead>
            <tbody>
              {models.map((model, idx) => (
                <tr key={idx} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                  <td className="px-4 py-3 font-mono text-slate-300">{model.id}</td>
                  <td className="px-4 py-3">{model.name}</td>
                  <td className="px-4 py-3 text-slate-400">{model.asset} · {model.horizon}</td>
                  <td className="px-4 py-3 font-mono text-emerald-400">{model.nmae}</td>
                  <td className="px-4 py-3 font-mono">{model.coverage}</td>
                  <td className="px-4 py-3">
                    {model.status === "CHAMPION" ? (
                      <span className="flex items-center gap-1 text-xs font-semibold text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded w-max border border-emerald-400/20">
                        <CheckCircle2 size={12} /> CHAMPION
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs font-semibold text-amber-400 bg-amber-400/10 px-2 py-1 rounded w-max border border-amber-400/20">
                        CHALLENGER
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

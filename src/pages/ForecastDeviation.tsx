import React, { useState, useEffect } from "react";
import { SimulationState } from "../App";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from "recharts";
import { Activity, Thermometer, Cloud, CheckCircle, Zap } from "lucide-react";
import { askLLM } from "../agent/llmClient";
import { buildDeviationPrompt } from "../agent/insightPrompts";

export default function ForecastDeviation({ simState }: { simState: SimulationState }) {
  const [horizon, setHorizon] = useState("2hour");
  const [llmInsight, setLlmInsight] = useState("Loading insight...");

  const targetPlant = simState.plants.find(p => p.plant_id === "PAV");
  const activeForecast = simState.forecasts.find(f => f.asset_id === "PAV" && f.horizon === horizon);

  useEffect(() => {
    if (targetPlant && activeForecast && activeForecast.points.length > 0) {
      const p50 = activeForecast.points[0].p50;
      const act = targetPlant.actual_mw;
      const prompt = buildDeviationPrompt(
        "PAV", 
        { forecast_p50_mw: p50 } as any, 
        { actual_mw: act, local_limit_mw: targetPlant.local_limit_mw, curtailment_flag: targetPlant.curtailment_flag, quality_flag: targetPlant.data_quality_flag } as any, 
        targetPlant.outage_flag
      );
      askLLM(prompt).then(setLlmInsight);
    }
  }, [horizon, targetPlant?.actual_mw, activeForecast]);

  const mockHistory = activeForecast ? activeForecast.points.map(pt => ({
    time: `T+${pt.offset_min}m`,
    p90: pt.p90,
    p50: pt.p50,
    p10: pt.p10,
    scheduled: pt.scheduled,
    actual: pt.actual // Only present for current time
  })) : [];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-4">
            <p className="text-xs text-slate-400 uppercase">nMAE (Normalized Error)</p>
            <p className="text-xl font-bold text-slate-200 mt-1">{activeForecast?.nMAE_pct || "0"}%</p>
          </CardContent>
        </Card>
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-4">
            <p className="text-xs text-slate-400 uppercase">P10/P90 Coverage</p>
            <p className="text-xl font-bold text-slate-200 mt-1">{activeForecast?.coverage_pct || "0"}%</p>
          </CardContent>
        </Card>
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-4 flex flex-col justify-between">
            <p className="text-xs text-slate-400 uppercase">Forecast Horizon</p>
            <select 
              value={horizon}
              onChange={(e) => setHorizon(e.target.value)}
              className="mt-1 bg-slate-950 border border-slate-700 text-slate-200 text-sm rounded p-1 w-full outline-none focus:border-blue-500"
            >
              <option value="5min">5 Min Nowcast</option>
              <option value="2hour">Intraday (2-Hour)</option>
              <option value="40hour">Day-Ahead (40-Hour)</option>
            </select>
          </CardContent>
        </Card>
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-4">
            <p className="text-xs text-slate-400 uppercase">Active Model</p>
            <p className="text-sm font-bold text-blue-400 mt-1 font-mono">{activeForecast?.model_id || "N/A"}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-slate-900 border-slate-800">
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-base text-slate-200 flex items-center gap-2">
            <Activity size={18} className="text-blue-400"/>
            Probabilistic Forecast (Pavagada Solar Park)
          </CardTitle>
          <div className="flex gap-4 text-xs font-mono text-slate-400">
            <span className="flex items-center gap-1"><div className="w-3 h-3 bg-blue-500/20 border border-blue-500 rounded-sm"></div> P10-P90 Band</span>
            <span className="flex items-center gap-1"><div className="w-3 h-0 border-t-2 border-blue-500"></div> P50 Forecast</span>
            <span className="flex items-center gap-1"><div className="w-3 h-0 border-t-2 border-purple-500 border-dashed"></div> Scheduled</span>
          </div>
        </CardHeader>
        <CardContent className="h-[350px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={mockHistory} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="time" stroke="#475569" fontSize={12} tickLine={false} />
              <YAxis stroke="#475569" fontSize={12} tickLine={false} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', color: '#f8fafc' }}
                itemStyle={{ fontSize: 12, fontWeight: 600 }}
              />
              <Area type="monotone" dataKey="p90" stroke="none" fill="#3b82f6" fillOpacity={0.15} />
              <Area type="monotone" dataKey="p10" stroke="none" fill="#0f172a" fillOpacity={1} />
              
              <Line type="monotone" dataKey="p50" stroke="#3b82f6" strokeWidth={2} dot={false} name="Forecast P50" />
              <Line type="stepAfter" dataKey="scheduled" stroke="#a855f7" strokeWidth={2} strokeDasharray="5 5" dot={false} name="Scheduled MW" />
              <Line type="monotone" dataKey="actual" stroke="#10b981" strokeWidth={4} dot={{ r: 4, fill: '#10b981', stroke: '#0f172a', strokeWidth: 2 }} name="Actual MW" />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-slate-200">Forecast Driver Contributions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 pt-2">
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-400 flex items-center gap-1"><Zap size={12}/> Clear Sky Potential</span>
                  <span className="text-emerald-400 font-mono">100%</span>
                </div>
                <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 w-full"></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-400 flex items-center gap-1"><Cloud size={12}/> Cloud Cover Impact</span>
                  <span className="text-rose-400 font-mono">-12%</span>
                </div>
                <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden flex justify-end">
                  <div className="h-full bg-rose-500 w-[12%]"></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-400 flex items-center gap-1"><Thermometer size={12}/> Temperature Derating</span>
                  <span className="text-orange-400 font-mono">-4%</span>
                </div>
                <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden flex justify-end">
                  <div className="h-full bg-orange-500 w-[4%]"></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-400 flex items-center gap-1"><CheckCircle size={12}/> Inverter Availability</span>
                  <span className="text-amber-400 font-mono">-1%</span>
                </div>
                <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden flex justify-end">
                  <div className="h-full bg-amber-500 w-[1%]"></div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800 bg-blue-950/20 border-blue-900/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-blue-400">LLM Context Engine</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-300 leading-relaxed font-mono">
              {llmInsight}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

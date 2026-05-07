import React, { useState } from "react";
import type { SimulationState } from "../App";
import { Wind, Activity, AlertTriangle, Fan } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from "recharts";

export default function WindForecasting({ simState }: { simState: SimulationState }) {
  const windFarms = simState.farms;
  const windPlants = simState.plants.filter(p => p.technology === "wind");

  // Aggregate wind total
  const totalWindActual = windPlants.reduce((sum, p) => sum + p.actual_mw, 0);
  const totalWindForecast = windPlants.reduce((sum, p) => sum + p.forecast_p50_mw, 0);
  const totalWindCap = windPlants.reduce((sum, p) => sum + p.capacity_mw, 0);

  // Generate mock power curve data for display
  const powerCurveData = Array.from({ length: 25 }, (_, i) => {
    const ws = i;
    let power = 0;
    if (ws >= 3 && ws < 12) power = Math.pow((ws - 3) / 9, 3) * 100;
    else if (ws >= 12 && ws <= 25) power = 100;
    return { windSpeed: ws, powerPct: power };
  });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1">State Wind Generation</div>
          <div className="text-2xl font-bold font-mono text-emerald-400">{totalWindActual.toFixed(0)} MW</div>
          <div className="text-sm text-slate-500 mt-2">Capacity: {totalWindCap} MW</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1">P50 Forecast</div>
          <div className="text-2xl font-bold font-mono text-amber-400">{totalWindForecast.toFixed(0)} MW</div>
          <div className="text-sm text-slate-500 mt-2">Aggregated across clusters</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1">Avg Hub Wind Speed</div>
          <div className="text-2xl font-bold font-mono text-blue-400">
            {(windFarms.reduce((s, f) => s + f.hub_wind_speed_ms, 0) / (windFarms.length || 1)).toFixed(1)} m/s
          </div>
          <div className="text-sm text-slate-500 mt-2">Active Turbines: {windFarms.reduce((s,f) => s + f.turbine_available, 0)}</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1">Active Wind Alerts</div>
          <div className="text-2xl font-bold font-mono text-red-400">
            {simState.alerts.filter(a => a.technology === "wind").length}
          </div>
          <div className="text-sm text-slate-500 mt-2 flex items-center gap-1"><AlertTriangle size={12}/> Needs attention</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-5">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Wind className="text-blue-400" size={18} />
            Cluster Performance & Forecast
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-slate-400 uppercase bg-slate-800/50">
                <tr>
                  <th className="px-4 py-3 rounded-tl-lg">Cluster</th>
                  <th className="px-4 py-3">Actual (MW)</th>
                  <th className="px-4 py-3">P50 (MW)</th>
                  <th className="px-4 py-3">Hub Speed</th>
                  <th className="px-4 py-3">Direction</th>
                  <th className="px-4 py-3">Avail %</th>
                  <th className="px-4 py-3 rounded-tr-lg">Risk</th>
                </tr>
              </thead>
              <tbody>
                {windFarms.map((farm, idx) => (
                  <tr key={idx} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                    <td className="px-4 py-3 font-medium">{farm.farm_name}</td>
                    <td className="px-4 py-3 font-mono text-emerald-400">{farm.actual_mw.toFixed(1)}</td>
                    <td className="px-4 py-3 font-mono text-amber-400">{farm.forecast_p50_mw.toFixed(1)}</td>
                    <td className="px-4 py-3 font-mono">{farm.hub_wind_speed_ms.toFixed(1)} m/s</td>
                    <td className="px-4 py-3 font-mono">{farm.wind_direction_deg.toFixed(0)}°</td>
                    <td className="px-4 py-3 font-mono">{farm.turbine_availability_pct}%</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        farm.ramp_risk === 'HIGH' ? 'bg-red-500/20 text-red-400' :
                        farm.ramp_risk === 'MEDIUM' ? 'bg-amber-500/20 text-amber-400' :
                        'bg-emerald-500/20 text-emerald-400'
                      }`}>
                        {farm.ramp_risk}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Activity className="text-purple-400" size={18} />
            Theoretical Power Curve
          </h3>
          <div className="flex-1 min-h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={powerCurveData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                <XAxis dataKey="windSpeed" stroke="#94a3b8" fontSize={12} tickFormatter={(val) => `${val} m/s`} />
                <YAxis stroke="#94a3b8" fontSize={12} tickFormatter={(val) => `${val}%`} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f8fafc' }}
                  labelFormatter={(val) => `${val} m/s`}
                />
                <Area type="monotone" dataKey="powerPct" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.2} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 text-xs text-slate-400 text-center">
            Standard 3.5MW Turbine Profile (Cut-in: 3m/s, Rated: 12m/s, Cut-out: 25m/s)
          </div>
        </div>
      </div>
    </div>
  );
}

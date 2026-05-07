import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SimulationState } from "../App";

export default function PlantSCADA({ simState }: { simState: SimulationState }) {
  const pavagada = simState.plants.find(p => p.plant_id === "PAV");

  const tags = [
    { name: "PLANT.ACTUAL_MW", val: pavagada?.actual_mw.toFixed(2), unit: "MW", lat: "2s", stat: "GOOD", src: "KSPDCL" },
    { name: "PLANT.SCHEDULED_MW", val: pavagada?.scheduled_mw.toFixed(2), unit: "MW", lat: "5m", stat: "GOOD", src: "REMC" },
    { name: "PLANT.FORECAST_P50_MW", val: pavagada?.forecast_p50_mw.toFixed(2), unit: "MW", lat: "0s", stat: "GOOD", src: "SuryaGrid AI" },
    { name: "MET.POA_IRRADIANCE", val: pavagada?.poa_irradiance_wm2.toFixed(1), unit: "W/m2", lat: "2s", stat: "GOOD", src: "MET_MAST_1" },
    { name: "MET.MODULE_TEMP", val: pavagada?.module_temperature_c.toFixed(1), unit: "°C", lat: "2s", stat: "GOOD", src: "MET_MAST_1" },
    { name: "GRID.LOCAL_LIMIT_MW", val: pavagada?.local_limit_mw.toFixed(2), unit: "MW", lat: "15m", stat: "STALE", src: "SLDC" }
  ];

  return (
    <div className="space-y-6">
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <CardTitle className="text-slate-200">Live Telemetry & SCADA Tags</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-slate-400 bg-slate-800">
                <tr>
                  <th className="px-4 py-3">Tag Name</th>
                  <th className="px-4 py-3">Latest Value</th>
                  <th className="px-4 py-3">Unit</th>
                  <th className="px-4 py-3">Latency</th>
                  <th className="px-4 py-3">Source</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {tags.map((t, i) => (
                  <tr key={i} className="border-b border-slate-800 text-slate-300">
                    <td className="px-4 py-3 font-mono">{t.name}</td>
                    <td className="px-4 py-3 font-bold">{t.val}</td>
                    <td className="px-4 py-3">{t.unit}</td>
                    <td className="px-4 py-3">{t.lat}</td>
                    <td className="px-4 py-3">{t.src}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-xs font-bold ${t.stat === 'GOOD' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
                        {t.stat}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

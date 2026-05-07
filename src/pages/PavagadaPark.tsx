import React, { useState } from "react";
import { SimulationState } from "../App";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BlockRecord } from "../simulation/types";
import { ShieldAlert, Zap, AlertTriangle } from "lucide-react";

export default function PavagadaPark({ simState }: { simState: SimulationState }) {
  const pavagada = simState.plants.find((p: any) => p.plant_id === "PAV");
  const pavBlocks = simState.blocks.filter((b: any) => b.park_id === "PAV");
  
  const [selectedBlock, setSelectedBlock] = useState<BlockRecord | null>(null);

  if (!pavagada) return <div>Data loading...</div>;

  const segments = ["S1", "S2", "S3", "S4", "S5", "S6", "S7", "S8"];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-4">
            <p className="text-xs text-slate-400 uppercase">Park Capacity</p>
            <p className="text-xl font-bold text-slate-200 mt-1">{pavagada.capacity_mw} MW</p>
          </CardContent>
        </Card>
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-4">
            <p className="text-xs text-slate-400 uppercase">Current Actual</p>
            <p className="text-xl font-bold text-emerald-400 mt-1">{pavagada.actual_mw.toFixed(1)} MW</p>
          </CardContent>
        </Card>
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-4">
            <p className="text-xs text-slate-400 uppercase">Forecast P50 (Nowcast)</p>
            <p className="text-xl font-bold text-blue-400 mt-1">{pavagada.forecast_p50_mw.toFixed(1)} MW</p>
          </CardContent>
        </Card>
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-4">
            <p className="text-xs text-slate-400 uppercase">Total Deviation</p>
            <p className={`text-xl font-bold mt-1 ${pavagada.deviation_mw < -50 ? 'text-rose-400' : 'text-emerald-400'}`}>
              {Math.abs(pavagada.deviation_mw).toFixed(1)} MW
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="col-span-1 lg:col-span-2 space-y-6">
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-slate-200">Segment & Block Heatmap</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 gap-4">
                {segments.map((seg: any) => {
                  const segBlocks = pavBlocks.filter((b: any) => b.segment_id === seg);
                  const segActual = segBlocks.reduce((sum: any, b: any) => sum + b.actual_mw, 0);
                  const segCap = segBlocks.reduce((sum: any, b: any) => sum + b.capacity_mw, 0);
                  
                  return (
                    <div key={seg} className="border border-slate-700 rounded-md p-3 bg-slate-950/50">
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-bold text-sm">{seg}</span>
                        <span className="text-xs font-mono text-emerald-400">{segActual.toFixed(0)}/{segCap}</span>
                      </div>
                      <div className="grid grid-cols-5 gap-1">
                        {segBlocks.map((block: any) => {
                          let bg = "bg-emerald-500/80";
                          if (block.curtailment_status === 'CONFIRMED') bg = "bg-rose-500/80";
                          else if (block.curtailment_flag) bg = "bg-amber-500/80";
                          else if (block.inverter_availability_pct < 80) bg = "bg-orange-500/80";
                          else if (block.scada_quality_flag === 'STALE') bg = "bg-slate-500/80";
                          else if (block.underperformance_score > 15) bg = "bg-blue-500/80";
                          else if (block.actual_mw < 1) bg = "bg-slate-800";

                          return (
                            <button
                              key={block.block_id}
                              onClick={() => setSelectedBlock(block)}
                              className={`aspect-square rounded-sm ${bg} hover:ring-2 hover:ring-white transition-all flex items-center justify-center group relative`}
                            >
                              <span className="text-[8px] opacity-0 group-hover:opacity-100 font-mono font-bold text-white shadow-sm">
                                {block.block_id.replace('B','')}
                              </span>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
              <div className="mt-6 flex flex-wrap gap-4 justify-center text-xs text-slate-400">
                <span className="flex items-center gap-1"><div className="w-3 h-3 bg-emerald-500/80 rounded-sm"></div> Normal</span>
                <span className="flex items-center gap-1"><div className="w-3 h-3 bg-blue-500/80 rounded-sm"></div> Weather Derate</span>
                <span className="flex items-center gap-1"><div className="w-3 h-3 bg-orange-500/80 rounded-sm"></div> Equip. Fault</span>
                <span className="flex items-center gap-1"><div className="w-3 h-3 bg-rose-500/80 rounded-sm"></div> Curtailment</span>
                <span className="flex items-center gap-1"><div className="w-3 h-3 bg-slate-500/80 rounded-sm"></div> Data Stale</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="col-span-1">
          <Card className="bg-slate-900 border-slate-800 h-full flex flex-col">
            <CardHeader className="pb-2 border-b border-slate-800 flex-shrink-0">
              <CardTitle className="text-base text-slate-200">
                {selectedBlock ? `Block ${selectedBlock.segment_id}-${selectedBlock.block_id} Details` : 'Select a block'}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 flex-1 overflow-auto">
              {selectedBlock ? (
                <div className="space-y-4">
                  <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                    <span className="text-sm text-slate-400 flex items-center gap-1"><Zap size={14}/> Actual Power</span>
                    <span className="font-mono text-emerald-400 font-bold">{selectedBlock.actual_mw.toFixed(2)} MW</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                    <span className="text-sm text-slate-400">Expected Power</span>
                    <span className="font-mono text-blue-400 font-bold">{selectedBlock.expected_mw.toFixed(2)} MW</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                    <span className="text-sm text-slate-400">Inverter Availability</span>
                    <span className={`font-mono font-bold ${selectedBlock.inverter_availability_pct < 100 ? 'text-amber-400' : 'text-slate-200'}`}>
                      {selectedBlock.inverter_availability_pct}% ({selectedBlock.inverter_available}/{selectedBlock.inverter_total})
                    </span>
                  </div>
                  <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                    <span className="text-sm text-slate-400">POA Irradiance</span>
                    <span className="font-mono text-amber-200 font-bold">{selectedBlock.poa_irradiance_wm2.toFixed(0)} W/m²</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                    <span className="text-sm text-slate-400">Local Grid Limit</span>
                    <span className={`font-mono font-bold ${selectedBlock.curtailment_flag ? 'text-rose-400' : 'text-slate-200'}`}>
                      {selectedBlock.local_limit_mw.toFixed(1)} MW
                    </span>
                  </div>
                  <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                    <span className="text-sm text-slate-400">Curtailment Status</span>
                    <span className={`font-mono text-xs px-2 py-0.5 rounded ${selectedBlock.curtailment_status === 'CONFIRMED' ? 'bg-rose-500/20 text-rose-400 font-bold' : 'bg-slate-800 text-slate-400'}`}>
                      {selectedBlock.curtailment_status}
                    </span>
                  </div>
                  <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                    <span className="text-sm text-slate-400">SCADA Quality</span>
                    <span className={`font-mono text-xs px-2 py-0.5 rounded ${selectedBlock.scada_quality_flag === 'GOOD' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
                      {selectedBlock.scada_quality_flag}
                    </span>
                  </div>

                  {selectedBlock.likely_cause && (
                    <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-md">
                      <p className="text-xs text-amber-500 font-semibold mb-1 flex items-center gap-1">
                        <AlertTriangle size={12}/> Agent Diagnosis
                      </p>
                      <p className="text-sm text-amber-200">{selectedBlock.likely_cause}</p>
                    </div>
                  )}
                  {selectedBlock.curtailment_status === 'CONFIRMED' && (
                    <div className="mt-4 p-3 bg-rose-500/10 border border-rose-500/30 rounded-md">
                      <p className="text-xs text-rose-400 font-semibold mb-1 flex items-center gap-1">
                        <ShieldAlert size={12}/> Curtailment Event Active
                      </p>
                      <p className="text-sm text-rose-200">Local limit constraint is actively capping production. Do not penalize forecast model.</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-10 text-slate-500 text-sm">
                  Click on any block in the heatmap to view real-time SCADA and forecasting diagnostics.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

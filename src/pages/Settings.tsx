import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SimulationEngine } from "../simulation/engine";
import { Download } from "lucide-react";

export default function Settings({ engine }: { engine: SimulationEngine }) {
  const [, setTick] = useState(0);

  const forceUpdate = () => setTick(t => t + 1);

  const handleScenarioChange = (s: any) => {
    engine.setScenario(s);
    forceUpdate();
  };

  const exportCSV = () => {
    // Generate a simple CSV string from a snapshot of data
    const data = engine.generateStateData();
    const headers = "timestamp,plant_id,actual_mw,forecast_p50_mw,deviation_mw\n";
    const rows = data.plants.map(p => `${p.timestamp},${p.plant_id},${p.actual_mw.toFixed(2)},${p.forecast_p50_mw.toFixed(2)},${p.deviation_mw.toFixed(2)}`).join("\n");
    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('href', url);
    a.setAttribute('download', 'plant_timeseries.csv');
    a.click();
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader className="pb-2">
          <CardTitle className="text-base text-slate-200">Demo Scenario Controls</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-2">Solar & General Scenarios</h3>
          <div className="grid grid-cols-2 gap-4">
            <button 
              className={`p-3 rounded border text-sm transition-colors ${engine.scenario === 'clear_sky' ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-950 border-slate-800 hover:border-slate-600'}`}
              onClick={() => handleScenarioChange('clear_sky')}
            >
              1. Clear Sky / Baseline
            </button>
            <button 
              className={`p-3 rounded border text-sm transition-colors ${engine.scenario === 'moving_cloud' ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-950 border-slate-800 hover:border-slate-600'}`}
              onClick={() => handleScenarioChange('moving_cloud')}
            >
              2. Moving Cloud Band (Pavagada)
            </button>
            <button 
              className={`p-3 rounded border text-sm transition-colors ${engine.scenario === 'inverter_outage' ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-950 border-slate-800 hover:border-slate-600'}`}
              onClick={() => {
                engine.inverterOutageSeverity = 100;
                handleScenarioChange('inverter_outage');
              }}
            >
              3. Inverter Outage (Pavagada S3-B02)
            </button>
            <button 
              className={`p-3 rounded border text-sm transition-colors ${engine.scenario === 'grid_curtailment' ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-950 border-slate-800 hover:border-slate-600'}`}
              onClick={() => {
                engine.curtailmentActive = true;
                handleScenarioChange('grid_curtailment');
              }}
            >
              4. Grid Curtailment (S5-S8)
            </button>
            <button 
              className={`p-3 rounded border text-sm transition-colors ${engine.scenario === 'scada_stuck' ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-950 border-slate-800 hover:border-slate-600'}`}
              onClick={() => {
                engine.scadaFailureActive = true;
                handleScenarioChange('scada_stuck');
              }}
            >
              5. SCADA Sensor Stuck (S1-B01)
            </button>
          </div>

          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mt-6 mb-2">Wind Scenarios</h3>
          <div className="grid grid-cols-2 gap-4">
            <button 
              className={`p-3 rounded border text-sm transition-colors ${engine.scenario === 'wind_ramp_down' ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-950 border-slate-800 hover:border-slate-600'}`}
              onClick={() => handleScenarioChange('wind_ramp_down')}
            >
              6. Sudden Wind Ramp-Down
            </button>
            <button 
              className={`p-3 rounded border text-sm transition-colors ${engine.scenario === 'turbine_outage' ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-950 border-slate-800 hover:border-slate-600'}`}
              onClick={() => handleScenarioChange('turbine_outage')}
            >
              7. Turbine Maintenance / Outage
            </button>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-slate-900 border-slate-800">
        <CardHeader className="pb-2">
          <CardTitle className="text-base text-slate-200">Data Exports</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <button 
              onClick={exportCSV}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded text-sm transition-colors"
            >
              <Download size={16} />
              Export Synthetic SCADA (CSV)
            </button>
          </div>
          <p className="text-xs text-slate-500 mt-4">
            Generates a snapshot of the current simulated parameters mimicking KSPDCL historian schema.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

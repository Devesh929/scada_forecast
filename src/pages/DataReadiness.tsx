import React from "react";
import { SimulationState } from "../App";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, XCircle } from "lucide-react";

export default function DataReadiness({ simState }: { simState: SimulationState }) {
  const schemaReqs = [
    { field: "Timestamp", desc: "For timeseries modeling", present: true },
    { field: "Plant/Block ID", desc: "For hierarchy mapping", present: true },
    { field: "Actual Generation MW", desc: "Target variable", present: true },
    { field: "Scheduled Generation MW", desc: "For deviation calculation", present: true },
    { field: "Irradiance (POA / GHI)", desc: "Primary weather driver", present: true },
    { field: "Module Temperature", desc: "Thermal derating driver", present: true },
    { field: "Inverter Availability", desc: "Plant availability derating", present: true },
    { field: "Local Limit MW", desc: "Grid constraint cap", present: true },
    { field: "Control Setpoint", desc: "PPC target", present: true },
    { field: "Curtailment Flag", desc: "Supervised label for curtailment", present: true },
    { field: "Weather Forecast", desc: "Forward-looking input", present: true },
    { field: "Data Quality Flag", desc: "Stale/Missing indicator", present: true },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="pb-2 border-b border-slate-800">
            <CardTitle className="text-base text-slate-200">KSPDCL Data Schema Requirements</CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="space-y-3">
              {schemaReqs.map((req, i) => (
                <div key={i} className="flex items-center justify-between p-2 rounded hover:bg-slate-800/50">
                  <div className="flex items-center gap-3">
                    {req.present ? 
                      <CheckCircle2 className="h-5 w-5 text-emerald-500" /> : 
                      <XCircle className="h-5 w-5 text-slate-600" />
                    }
                    <div>
                      <p className="text-sm font-medium text-slate-200">{req.field}</p>
                      <p className="text-xs text-slate-500">{req.desc}</p>
                    </div>
                  </div>
                  <div className="text-xs font-mono px-2 py-1 bg-slate-800 rounded text-slate-300">
                    {req.present ? 'MAPPED' : 'REQUIRED'}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="bg-slate-900 border-slate-800 border-l-4 border-l-blue-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-slate-200">Why Data Readiness Matters</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 text-sm text-slate-300">
                <p>If KSPDCL provides only <strong>Actual MW</strong>, the AI can only build a baseline autoregressive forecast.</p>
                <p>By integrating <strong>Irradiance + Inverter Availability + Local Limits</strong>, RampMitra AI can accurately calculate <em>Possible Power</em> and decouple weather impacts from equipment or grid issues.</p>
                <p>This explainability is critical for identifying exactly why a block is deviating from its schedule.</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900 border-slate-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-slate-200">AI Schema Mapper (Mock)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="p-3 bg-slate-950 rounded border border-slate-800 flex items-center justify-between">
                  <div>
                    <span className="text-xs text-slate-400 block mb-1">Uploaded Column</span>
                    <span className="font-mono text-sm text-blue-300">GenMW_Avg_15m</span>
                  </div>
                  <div className="text-slate-500 text-lg">→</div>
                  <div className="text-right">
                    <span className="text-xs text-slate-400 block mb-1">Mapped Canonical</span>
                    <span className="font-mono text-sm text-emerald-400">actual_mw</span>
                  </div>
                  <div className="px-2 py-1 bg-emerald-500/20 text-emerald-400 text-xs rounded font-bold">
                    94%
                  </div>
                </div>

                <div className="p-3 bg-slate-950 rounded border border-slate-800 flex items-center justify-between">
                  <div>
                    <span className="text-xs text-slate-400 block mb-1">Uploaded Column</span>
                    <span className="font-mono text-sm text-blue-300">Rad_POA</span>
                  </div>
                  <div className="text-slate-500 text-lg">→</div>
                  <div className="text-right">
                    <span className="text-xs text-slate-400 block mb-1">Mapped Canonical</span>
                    <span className="font-mono text-sm text-emerald-400">poa_irradiance_wm2</span>
                  </div>
                  <div className="px-2 py-1 bg-emerald-500/20 text-emerald-400 text-xs rounded font-bold">
                    89%
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

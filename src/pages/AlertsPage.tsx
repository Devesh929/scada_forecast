import React from "react";
import { SimulationState } from "../App";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, Info, CheckCircle2, ShieldAlert } from "lucide-react";

export default function AlertsPage({ simState }: { simState: SimulationState }) {
  const { alerts, plants } = simState;

  const getSeverityIcon = (sev: string) => {
    switch (sev) {
      case "CRITICAL": return <AlertTriangle className="h-5 w-5 text-rose-500" />;
      case "WARNING": return <AlertTriangle className="h-5 w-5 text-amber-500" />;
      default: return <Info className="h-5 w-5 text-blue-500" />;
    }
  };

  const confirmedCurtailment = plants.filter(p => p.curtailment_status === "CONFIRMED");
  const suspectedCurtailment = plants.filter(p => p.curtailment_status === "SUSPECTED");

  return (
    <div className="space-y-6">
      
      {/* Curtailment Panel */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="pb-2 border-b border-slate-800">
            <CardTitle className="text-base text-slate-200 flex items-center gap-2">
              <ShieldAlert className="text-amber-500" size={18} />
              Curtailment Detection & Root Cause
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-950/50 rounded-lg p-3 border border-slate-800">
                <div className="text-xs text-slate-400 mb-1 flex items-center gap-1">
                  <CheckCircle2 size={12} className="text-emerald-500" /> Confirmed
                </div>
                <div className="text-xl font-bold font-mono text-emerald-400">
                  {confirmedCurtailment.length} <span className="text-xs text-slate-500 font-sans font-normal">assets</span>
                </div>
                <div className="text-[10px] text-slate-500 mt-1">Local limits match clipped AC power.</div>
              </div>
              <div className="bg-slate-950/50 rounded-lg p-3 border border-slate-800">
                <div className="text-xs text-slate-400 mb-1 flex items-center gap-1">
                  <AlertTriangle size={12} className="text-amber-500" /> Suspected
                </div>
                <div className="text-xl font-bold font-mono text-amber-400">
                  {suspectedCurtailment.length} <span className="text-xs text-slate-500 font-sans font-normal">assets</span>
                </div>
                <div className="text-[10px] text-slate-500 mt-1">Plateau detected without local limit signal.</div>
              </div>
            </div>
            {confirmedCurtailment.length > 0 && (
              <div className="mt-4 text-sm text-slate-300">
                Active Curtailment at: {confirmedCurtailment.map(p => p.plant_name).join(", ")}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="pb-2 border-b border-slate-800">
            <CardTitle className="text-base text-slate-200">Alert Classification</CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="grid grid-cols-2 gap-4 h-full">
              <div className="flex flex-col items-center justify-center text-center">
                <p className="text-xs text-slate-400 uppercase mb-1">Weather / Ramps</p>
                <p className="text-2xl font-bold text-blue-400">
                  {alerts.filter(a => a.likely_cause.includes("Weather")).length}
                </p>
              </div>
              <div className="flex flex-col items-center justify-center text-center">
                <p className="text-xs text-slate-400 uppercase mb-1">Equipment Outage</p>
                <p className="text-2xl font-bold text-amber-400">
                  {alerts.filter(a => a.likely_cause.includes("Equipment")).length}
                </p>
              </div>
              <div className="flex flex-col items-center justify-center text-center">
                <p className="text-xs text-slate-400 uppercase mb-1">Grid / Curtailment</p>
                <p className="text-2xl font-bold text-rose-400">
                  {alerts.filter(a => a.likely_cause.includes("Grid")).length}
                </p>
              </div>
              <div className="flex flex-col items-center justify-center text-center">
                <p className="text-xs text-slate-400 uppercase mb-1">SCADA Quality</p>
                <p className="text-2xl font-bold text-slate-400">
                  {alerts.filter(a => a.likely_cause.includes("Telemetry")).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alert Queue */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader className="pb-4 border-b border-slate-800">
          <CardTitle className="text-base text-slate-200">Active Intelligence Queue</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {alerts.length === 0 ? (
            <div className="p-12 text-center flex flex-col items-center justify-center text-slate-500">
              <CheckCircle2 className="h-12 w-12 text-emerald-500/50 mb-3" />
              <p>No active alerts. Grid parameters are normal.</p>
            </div>
          ) : (
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-slate-400 uppercase bg-slate-950/50 border-b border-slate-800">
                <tr>
                  <th className="px-6 py-3">Time</th>
                  <th className="px-6 py-3">Location</th>
                  <th className="px-6 py-3">Alert Type</th>
                  <th className="px-6 py-3">Root Cause</th>
                  <th className="px-6 py-3 text-right">Impact</th>
                  <th className="px-6 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {alerts.map((alert) => (
                  <tr key={alert.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                    <td className="px-6 py-4 font-mono text-slate-500">{alert.time}</td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-200">{alert.plant}</div>
                      <div className="text-xs text-slate-400">{alert.segment} {alert.block}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {getSeverityIcon(alert.severity)}
                        <span className="font-medium text-slate-200">{alert.alert_type}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-300">{alert.likely_cause}</td>
                    <td className="px-6 py-4 font-mono font-bold text-right text-rose-400">
                      {alert.impact_mw > 0 ? `-${alert.impact_mw.toFixed(1)} MW` : '-'}
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 rounded text-xs font-bold tracking-wider bg-slate-800 text-slate-300">
                        {alert.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

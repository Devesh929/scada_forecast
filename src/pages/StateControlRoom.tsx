import React from "react";
import { SimulationState } from "../App";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, AlertTriangle, Battery, MapPin, Zap } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, AreaChart, Area } from "recharts";
import { MapContainer, TileLayer, CircleMarker, Tooltip as LeafletTooltip } from 'react-leaflet';

export default function StateControlRoom({ simState }: { simState: SimulationState }) {
  // Simple history mock for chart
  const mockHistory = Array.from({ length: 20 }).map((_, i) => {
    return {
      time: `T-${20 - i}`,
      actual: simState.stateTotalActual * (0.8 + Math.random() * 0.4),
      forecast: simState.stateTotalForecast * (0.8 + Math.random() * 0.4),
    }
  });

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-6">
            <div className="flex items-center justify-between space-y-0 pb-2">
              <p className="text-sm font-medium text-slate-400">Total Generation</p>
              <Zap className="h-4 w-4 text-emerald-500" />
            </div>
            <div className="text-2xl font-bold text-white">{simState.stateTotalActual.toFixed(0)} MW</div>
            <p className="text-xs text-slate-500 mt-1">vs Capacity {simState.stateTotalCapacity} MW</p>
          </CardContent>
        </Card>
        
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-6">
            <div className="flex items-center justify-between space-y-0 pb-2">
              <p className="text-sm font-medium text-slate-400">Next 30-min Forecast</p>
              <Activity className="h-4 w-4 text-blue-400" />
            </div>
            <div className="text-2xl font-bold text-white">{simState.stateTotalForecast.toFixed(0)} MW</div>
            <p className="text-xs text-emerald-400 mt-1">High Confidence</p>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-6">
            <div className="flex items-center justify-between space-y-0 pb-2">
              <p className="text-sm font-medium text-slate-400">State Deviation Risk</p>
              <AlertTriangle className="h-4 w-4 text-amber-500" />
            </div>
            <div className="text-2xl font-bold text-white">Moderate</div>
            <p className="text-xs text-amber-500 mt-1">{simState.alerts.length} Active Alerts</p>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800 bg-gradient-to-br from-slate-900 to-slate-800/50">
          <CardContent className="p-6 flex flex-col justify-between h-full">
            <p className="text-sm font-medium text-emerald-400 mb-2">Operator Recommendation</p>
            <p className="text-sm text-slate-300 leading-tight">
              Prepare reserve support for expected ramp-down in Pavagada S3/S4 due to incoming cloud band.
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Real Map */}
        <Card className="col-span-1 lg:col-span-1 bg-slate-900 border-slate-800 min-h-[400px] flex flex-col relative z-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-slate-200">Karnataka Solar Assets</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 relative p-0 m-4 rounded-md overflow-hidden border border-slate-800">
            <MapContainer 
              center={[15.3173, 75.7139]} 
              zoom={6} 
              scrollWheelZoom={true} 
              style={{ height: "100%", width: "100%", minHeight: "400px", zIndex: 0 }}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              />
              {simState.plants.map(p => (
                <CircleMarker
                  key={p.plant_id}
                  center={[p.lat, p.lon]}
                  radius={p.capacity_mw > 1000 ? 12 : 6}
                  pathOptions={{
                    fillColor: p.deviation_mw < -20 ? '#f59e0b' : '#10b981',
                    color: p.deviation_mw < -20 ? '#fcd34d' : '#6ee7b7',
                    weight: 2,
                    fillOpacity: 0.7,
                  }}
                >
                  <LeafletTooltip direction="top" offset={[0, -10]} opacity={1}>
                    <div className="text-slate-900 font-sans">
                      <p className="font-bold">{p.plant_name}</p>
                      <p className="text-xs">Capacity: {p.capacity_mw} MW</p>
                      <p className="text-xs">Actual: {p.actual_mw.toFixed(1)} MW</p>
                      <p className={`text-xs font-bold ${p.deviation_mw < -20 ? 'text-amber-600' : 'text-emerald-600'}`}>
                        Deviation: {p.deviation_mw.toFixed(1)} MW
                      </p>
                    </div>
                  </LeafletTooltip>
                </CircleMarker>
              ))}
            </MapContainer>
          </CardContent>
        </Card>

        {/* Charts */}
        <div className="col-span-1 lg:col-span-2 space-y-6">
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-slate-200">Actual vs Forecast (State Aggregate)</CardTitle>
            </CardHeader>
            <CardContent className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={mockHistory}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="time" stroke="#475569" fontSize={12} tickLine={false} />
                  <YAxis stroke="#475569" fontSize={12} tickLine={false} />
                  <RechartsTooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', color: '#f8fafc' }} />
                  <Line type="monotone" dataKey="actual" stroke="#10b981" strokeWidth={2} dot={false} name="Actual MW" />
                  <Line type="monotone" dataKey="forecast" stroke="#3b82f6" strokeWidth={2} strokeDasharray="5 5" dot={false} name="Forecast MW" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="bg-slate-900 border-slate-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-slate-200">Active High-Priority Alerts</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {simState.alerts.slice(0, 3).map(alert => (
                  <div key={alert.id} className="flex items-start gap-3 p-3 rounded-lg border border-slate-800 bg-slate-950/50">
                    <AlertTriangle className={`mt-0.5 h-5 w-5 flex-shrink-0 ${alert.severity === 'CRITICAL' ? 'text-rose-500' : 'text-amber-500'}`} />
                    <div>
                      <h4 className="text-sm font-medium text-slate-200">{alert.alert_type} - {alert.plant} {alert.segment}</h4>
                      <p className="text-xs text-slate-400 mt-1">{alert.likely_cause}</p>
                      <div className="flex gap-4 mt-2 text-[10px] uppercase font-semibold">
                        <span className="text-rose-400">Impact: {alert.impact_mw.toFixed(1)} MW</span>
                        <span className="text-blue-400">Action: {alert.recommended_action}</span>
                      </div>
                    </div>
                  </div>
                ))}
                {simState.alerts.length === 0 && (
                  <div className="text-sm text-slate-500 py-4 text-center">No active alerts. Grid operates normally.</div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

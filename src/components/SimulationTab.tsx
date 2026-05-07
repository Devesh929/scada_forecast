import React, { useState, useMemo, useEffect } from "react";
import OperationalForecastChart from "./OperationalForecastChart";
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, 
  ComposedChart, BarChart, Bar, ScatterChart, Scatter, ZAxis, ReferenceLine, Cell
} from "recharts";
import { 
  Activity, Shield, Zap, Database, BarChart2, History, AlertTriangle, 
  Play, Pause, Layout, RotateCcw, ChevronRight, 
  Cpu, Thermometer, Wind, Sun, Clock, Filter, Eye, Settings, Info, Gauge,
  Network, Lock, Unlock, ArrowUpRight, TrendingUp, RefreshCcw, X, Map as MapIcon, Layers, Server, Box, Globe, WifiOff, CloudSun, CheckCircle
} from "lucide-react";
import { engine, PLANTS } from "../simulation/engine";
import { 
  VALIDATION_LAB_DATA, HISTORICAL_CATALOG, LIVE_REPLAY_SAMPLES, 
  TRAINING_SUMMARY, RAMP_EVALUATION, ANOMALY_LOG,
  ONLINE_LEARNING_HORIZON_CONFIG
} from "../simulation/data";

// --- Helper: Simple CSV Parser ---
function parseCSV(text: string) {
  const lines = text.split('\n').filter(l => l.trim() !== '');
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim());
  return lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.trim());
    const obj: any = {};
    headers.forEach((h, i) => {
      obj[h] = values[i];
    });
    return obj;
  });
}

// --- Specialized Components ---

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-6">
      <h2 className="text-xl font-bold uppercase tracking-wider text-emerald-400">{title}</h2>
      {subtitle && <p className="text-xs text-slate-400 mt-1">{subtitle}</p>}
    </div>
  );
}

function Kpi({ label, value, subValue, plainLanguage, tone = "emerald" }: any) {
  const colors = {
    emerald: "text-emerald-400 border-emerald-500/20",
    amber: "text-amber-400 border-amber-500/20",
    blue: "text-blue-400 border-blue-500/20",
    rose: "text-rose-400 border-rose-500/20",
    white: "text-white border-white/10"
  };
  return (
    <div className={`bg-black/40 border p-4 rounded-2xl ${colors[tone as keyof typeof colors]} relative group flex flex-col justify-between`}>
      <div className="flex justify-between items-start mb-1">
        <div className="text-[10px] font-bold uppercase opacity-60">{label}</div>
        {plainLanguage && (
          <div className="text-slate-500 hover:text-slate-300 transition-colors">
            <Info size={12} />
          </div>
        )}
      </div>
      <div className="text-2xl font-bold tracking-tight">{value}</div>
      {subValue && <div className="text-[10px] opacity-60 mt-1">{subValue}</div>}
      {plainLanguage && (
        <div className="mt-2 text-[9px] leading-relaxed text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity absolute left-0 right-0 top-full bg-[#030706] p-3 rounded-xl border border-white/10 z-10 pointer-events-none">
          {plainLanguage}
        </div>
      )}
    </div>
  );
}

function UnitHeatmap({ simState, assetType }: any) {
  const items = assetType === "solar" ? simState.blocks : simState.farms;
  if (!items || items.length === 0) return null;

  return (
    <div className="heatmap h-full w-full overflow-hidden">
      {items.slice(0, 40).map((item: any, i: number) => {
        const perf = item.actual_mw / item.capacity_mw;
        const color = perf > 0.8 ? "bg-emerald-500/40 border-emerald-500/60" : perf > 0.4 ? "bg-amber-500/40 border-amber-500/60" : "bg-rose-500/40 border-rose-500/60";
        return (
          <div key={i} className={`heat-cell ${color} flex items-center justify-center relative group`}>
            <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity" />
            <span className="text-[8px] font-mono opacity-40 group-hover:opacity-100">{item.block_id || item.farm_id}</span>
          </div>
        );
      })}
    </div>
  );
}

// --- Tab 1: Plant Brief (Granular & Interactive) ---

function PlantBrief({ plant, simState }: { plant: any; simState: any }) {
  const [data, setData] = useState<any>(null);
  const [dictionary, setDictionary] = useState<any>(null);
  const [selectedHub, setSelectedHub] = useState<any>(null);
  const [selectedBlock, setSelectedBlock] = useState<any>(null);
  const [selectedField, setSelectedField] = useState<any>(null);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  useEffect(() => {
    fetch('/data/brief/plant_brief_granular_data.json').then(res => res.json()).then(d => {
      // If technology is wind, transform the labels dynamically for parity
      if (plant.technology === 'wind') {
        const windData = JSON.parse(JSON.stringify(d).replace(/Solar/g, 'Wind').replace(/inverter/g, 'turbine').replace(/Irradiance/g, 'Wind Speed').replace(/Irradiance/g, 'Wind Speed').replace(/POA/g, 'Anemometer'));
        windData.plant.plant_id = "WND_GADAG";
        windData.plant.plant_name = "Gadag Wind Farm";
        windData.plant.layout_summary = "8 hubs / 40 turbines / nacelle groups";
        setData(windData);
      } else {
        setData(d);
      }
    });
    fetch('/data/brief/scada_data_dictionary.json').then(res => res.json()).then(d => setDictionary(d));
  }, [plant.technology]);

  // Clear expanded section when drawer changes
  useEffect(() => {
    setExpandedSection(null);
  }, [selectedHub, selectedBlock]);

  if (!data || !dictionary) return <div className="p-12 text-slate-500 italic flex items-center gap-3"><RefreshCcw className="animate-spin" size={16} /> Initializing infrastructure map...</div>;

  const p = data.plant;
  const snap = p.current_operating_snapshot;

  const IconMap: any = {
    CheckCircle,
    CloudSun,
    AlertTriangle,
    WifiOff,
    Zap,
    Shield,
    Database,
    Cpu,
    Thermometer
  };

  const StatusIcon = ({ name, className }: any) => {
    const Component = IconMap[name] || Info;
    return <Component className={className} />;
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      {/* 1. Plant Hero */}
      <div className="relative rounded-3xl overflow-hidden bg-[#05100d] border border-emerald-500/20 p-8">
        <div className="absolute top-0 right-0 p-12 opacity-5 rotate-12">
          <Globe size={200} />
        </div>
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full text-[10px] font-bold uppercase tracking-widest">{p.asset_type}</span>
            <span className="text-slate-500 text-[10px] uppercase font-bold tracking-widest">{p.state}, {p.district}</span>
          </div>
          <h1 className="text-4xl font-black text-white mb-2">{p.plant_name}</h1>
          <p className="text-slate-400 max-w-2xl text-sm leading-relaxed mb-8">{p.forecast_objective}</p>
          
          <div className="grid grid-cols-4 gap-6">
            <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
              <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">Design Capacity</p>
              <p className="text-xl font-bold text-white">{p.design_capacity_mw} MW</p>
            </div>
            <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
              <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">Infrastructure</p>
              <p className="text-xl font-bold text-white">{p.layout_summary}</p>
            </div>
            <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
              <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">Training Period</p>
              <p className="text-xl font-bold text-blue-400">{p.historical_training.training_period.split(' ')[0].substring(0,4)} - {p.historical_training.training_period.split(' ')[2].substring(0,4)}</p>
            </div>
            <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
              <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">Data Readiness</p>
              <p className="text-xl font-bold text-emerald-400">{p.data_readiness.overall_score_pct}%</p>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Operating Snapshot */}
      <div className="grid grid-cols-4 gap-4">
        <Kpi label="Live Output" value={`${snap.actual_mw} MW`} tone="emerald" subValue={`Scheduled: ${snap.scheduled_mw} MW`} />
        <Kpi label="Possible Power" value={`${snap.possible_power_mw} MW`} tone="blue" subValue="Unconstrained Potential" />
        <Kpi label="Availability" value={`${snap.availability_pct}%`} tone="amber" subValue="Inverters Online" />
        <Kpi label="Health Status" value={snap.latest_event_status} tone={snap.latest_event_status === 'NORMAL' ? 'emerald' : 'amber'} subValue="Global Plant Monitor" />
      </div>

      {/* 3. Interactive Infrastructure Map */}
      <div className="bg-black/40 border border-white/10 rounded-3xl p-8">
        <div className="flex justify-between items-end mb-8">
          <SectionHeader title="Infrastructure Topology" subtitle="Click any Hub or Block for granular telemetry and equipment health." />
          <div className="flex gap-4 mb-6">
            {Object.entries(data.visual_status_palette).map(([key, val]: any) => (
              <div key={key} className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: val.border_color }} />
                <span className="text-[10px] font-bold uppercase text-slate-500">{val.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          {data.hubs.map((hub: any) => (
            <div key={hub.hub_id} className="group relative">
              <div className="flex gap-4 items-stretch">
                {/* Hub Detail Side Card */}
                <div 
                  className="w-48 bg-white/5 border border-white/5 rounded-2xl p-4 cursor-pointer hover:bg-emerald-500/10 hover:border-emerald-500/30 transition-all flex flex-col justify-between"
                  onClick={() => setSelectedHub(hub)}
                >
                  <div>
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-[9px] font-bold text-slate-500 uppercase">{hub.hub_id}</span>
                      <StatusIcon name={hub.visual_cue.icon} className="w-3 h-3" style={{ color: hub.visual_cue.border_color }} />
                    </div>
                    <p className="text-[11px] font-bold text-white mb-1">{hub.hub_name}</p>
                    <p className="text-[10px] text-slate-500">{hub.kpis.capacity_mw} MW Segment</p>
                  </div>
                  <div className="pt-2 mt-2 border-t border-white/5 flex justify-between items-center">
                    <span className="text-[10px] font-mono text-emerald-400">{hub.kpis.current_actual_mw?.toFixed(1) || '0.0'} MW</span>
                    <ChevronRight size={12} className="text-slate-500 group-hover:text-emerald-400 transition-colors" />
                  </div>
                </div>

                {/* Blocks Grid */}
                <div className="flex-1 grid grid-cols-5 gap-3">
                  {hub.blocks.map((block: any) => (
                    <div 
                      key={block.block_id}
                      className="relative rounded-2xl border transition-all cursor-pointer overflow-hidden group/block"
                      style={{ 
                        backgroundColor: `${block.visual_cue.fill_color}40`, 
                        borderColor: `${block.visual_cue.border_color}40` 
                      }}
                      onClick={() => setSelectedBlock(block)}
                      title={block.visual_cue.tooltip}
                    >
                      <div className="p-4">
                        <div className="flex justify-between items-start mb-2">
                          <span className="text-[9px] font-bold opacity-40 uppercase">{block.block_id}</span>
                          <StatusIcon name={block.visual_cue.icon} className="w-3 h-3" style={{ color: block.visual_cue.border_color }} />
                        </div>
                        <div className="text-lg font-bold mb-0.5 tracking-tight">{block.visual_cue.heatmap_value}%</div>
                        <div className="text-[9px] font-bold uppercase opacity-60">Performance</div>
                      </div>
                      <div className="absolute inset-0 bg-white/5 opacity-0 group-hover/block:opacity-100 transition-opacity" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 4. Data Dictionary Section */}
      <div className="bg-black/40 border border-white/10 rounded-3xl p-8">
        <SectionHeader title="Operational Data Dictionary" subtitle="Plain-language definitions for telemetry tags, SCADA channels, and forecast outputs." />
        <div className="grid grid-cols-2 gap-8">
          {dictionary.groups.map((group: any) => (
            <div key={group.group_id} className="bg-white/5 rounded-2xl p-6 border border-white/5">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-blue-500/10 rounded-lg text-blue-400">
                  <StatusIcon name={group.visual_icon} size={16} />
                </div>
                <div>
                  <h4 className="text-xs font-bold uppercase text-white">{group.group_name}</h4>
                  <p className="text-[10px] text-slate-500">{group.plain_language}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {group.fields.map((field: any) => (
                  <button 
                    key={field.field_name}
                    className="px-3 py-1.5 rounded-lg bg-black/40 border border-white/5 text-[10px] font-bold text-slate-400 hover:text-emerald-400 hover:border-emerald-500/30 hover:bg-emerald-500/5 transition-all flex items-center gap-2"
                    onClick={() => setSelectedField(field)}
                  >
                    <Layers size={10} />
                    {field.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Drawers / Overlays */}
      {selectedHub && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSelectedHub(null)} />
          <div className="relative w-[500px] bg-[#05100d] border-l border-emerald-500/20 p-8 shadow-2xl animate-in slide-in-from-right duration-300 overflow-y-auto custom-scrollbar">
            <button onClick={() => setSelectedHub(null)} className="absolute top-6 right-6 p-2 rounded-full hover:bg-white/5 text-slate-500 hover:text-white transition-all"><X size={20} /></button>
            <div className="mb-8">
              <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">{selectedHub.hub_id}</span>
              <h2 className="text-2xl font-black text-white mt-1">{selectedHub.hub_name}</h2>
              <p className="text-sm text-slate-500 mt-2">{selectedHub.active_event.operator_message}</p>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-8">
              <Kpi label="Hub Capacity" value={`${selectedHub.kpis.capacity_mw} MW`} tone="white" />
              <Kpi label="Current Actual" value={`${selectedHub.kpis.current_actual_mw?.toFixed(1) || '0.0'} MW`} tone="emerald" />
              <Kpi label="Possible Power" value={`${selectedHub.kpis.current_possible_power_mw?.toFixed(1) || '0.0'} MW`} tone="blue" />
              <Kpi label="Availability" value={`${selectedHub.kpis.availability_pct}%`} tone="amber" />
            </div>

            <div className="space-y-6">
              <h4 className="text-[10px] font-black uppercase text-slate-500 tracking-[0.2em] border-b border-white/5 pb-2">Forecast Contribution</h4>
              <div className="space-y-3">
                {selectedHub.forecast_contribution.map((fc: any) => (
                  <div key={fc.horizon} className="bg-white/5 p-4 rounded-2xl border border-white/5 flex justify-between items-center">
                    <div>
                      <p className="text-[10px] font-bold uppercase text-slate-500">{fc.horizon} Horizon</p>
                      <p className="text-lg font-bold text-white">{fc.forecast_p50_mw?.toFixed(1) || '0.0'} MW</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-bold uppercase text-slate-500">Confidence</p>
                      <p className="text-lg font-bold text-emerald-400">{fc.confidence_pct}%</p>
                    </div>
                  </div>
                ))}
              </div>

              <h4 className="text-[10px] font-black uppercase text-slate-500 tracking-[0.2em] border-b border-white/5 pb-2 mt-8">Segment Drilldown</h4>
              <div className="grid grid-cols-1 gap-2">
                {selectedHub.drilldown_sections.map((s: string) => (
                  <div key={s} className="space-y-2">
                    <div 
                      className={`px-4 py-3 rounded-xl border text-[11px] font-bold flex items-center justify-between group cursor-pointer transition-all ${expandedSection === s ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-white/5 border-white/5 text-slate-400 hover:bg-emerald-500/5 hover:text-emerald-400'}`}
                      onClick={() => setExpandedSection(expandedSection === s ? null : s)}
                    >
                      {s}
                      <ChevronRight size={14} className={`transition-transform duration-300 ${expandedSection === s ? 'rotate-90 text-emerald-400' : 'opacity-40 group-hover:opacity-100'}`} />
                    </div>
                    
                    {expandedSection === s && (
                      <div className="px-4 py-2 bg-black/20 rounded-xl border border-white/5 animate-in slide-in-from-top-2 duration-200">
                        {s === 'Operating KPIs' && (
                          <div className="grid grid-cols-2 gap-y-3 gap-x-4 py-2">
                            {Object.entries(selectedHub.kpis).map(([k, v]: any) => (
                              <div key={k}>
                                <p className="text-[8px] uppercase text-slate-500 font-bold">{k.replace(/_/g, ' ')}</p>
                                <p className="text-xs font-bold text-slate-300">{typeof v === 'number' ? v.toFixed(2) : v}</p>
                              </div>
                            ))}
                          </div>
                        )}
                        {s === 'Block contribution' && (
                          <div className="space-y-2 py-2">
                            {selectedHub.blocks.map((b: any) => (
                              <div key={b.block_id} className="flex justify-between items-center text-[10px]">
                                <span className="text-slate-400">{b.block_id}</span>
                                <div className="flex items-center gap-3">
                                  <span className="font-mono text-emerald-400">{b.kpis.current_actual_mw.toFixed(1)} MW</span>
                                  <div className="w-16 h-1 bg-white/5 rounded-full overflow-hidden">
                                    <div className="h-full bg-emerald-500" style={{ width: `${(b.kpis.current_actual_mw / b.kpis.capacity_mw) * 100}%` }} />
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        {s === 'SCADA tags' && (
                          <div className="space-y-1 py-2">
                            {selectedHub.blocks.slice(0,1).map((b: any) => 
                              Object.keys(b.scada_tags).map(tag => (
                                <div key={tag} className="flex justify-between text-[10px] py-1 border-b border-white/5 last:border-0">
                                  <span className="text-slate-500">{tag}</span>
                                  <span className="text-slate-300">HUB_AGGREGATED</span>
                                </div>
                              ))
                            )}
                          </div>
                        )}
                        {(!['Operating KPIs', 'Block contribution', 'SCADA tags'].includes(s)) && (
                          <p className="text-[10px] text-slate-500 italic py-2">Detailed telemetry for {s} is being synchronized from plant server...</p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedBlock && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSelectedBlock(null)} />
          <div className="relative w-[500px] bg-[#05100d] border-l border-blue-500/20 p-8 shadow-2xl animate-in slide-in-from-right duration-300 overflow-y-auto custom-scrollbar">
            <button onClick={() => setSelectedBlock(null)} className="absolute top-6 right-6 p-2 rounded-full hover:bg-white/5 text-slate-500 hover:text-white transition-all"><X size={20} /></button>
            <div className="mb-8">
              <div className="flex items-center gap-2 mb-1">
                <Box size={14} className="text-blue-400" />
                <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">{selectedBlock.block_id}</span>
              </div>
              <h2 className="text-2xl font-black text-white">{selectedBlock.block_name}</h2>
              <p className="text-sm text-slate-500 mt-2">{selectedBlock.active_event.operator_message}</p>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-8">
              <Kpi label="Inverters Online" value={`${selectedBlock.equipment.inverters_online}/${selectedBlock.equipment.inverter_count}`} tone="emerald" />
              <Kpi label="Actual Output" value={`${selectedBlock.kpis.current_actual_mw?.toFixed(1) || '0.0'} MW`} tone="blue" />
              <Kpi label="Performance Ratio" value={`${selectedBlock.kpis.performance_ratio_pct}%`} tone="amber" />
              <Kpi label="Equipment Status" value={selectedBlock.equipment.transformer_status} tone={selectedBlock.equipment.transformer_status === 'GOOD' ? 'emerald' : 'amber'} />
            </div>

            <h4 className="text-[10px] font-black uppercase text-slate-500 tracking-[0.2em] border-b border-white/5 pb-2 mb-4">Edge Sensors</h4>
            <div className="grid grid-cols-2 gap-3 mb-8">
              {selectedBlock.sensors.map((s: any) => (
                <div key={s.sensor_id} className="p-4 rounded-2xl bg-white/5 border border-white/5">
                  <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">{s.type}</p>
                  <p className="text-lg font-bold text-white">{s.latest_value} <span className="text-[10px] font-normal opacity-50">{s.unit}</span></p>
                  <div className="mt-2 flex items-center gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    <span className="text-[8px] font-bold text-emerald-400">NOMINAL</span>
                  </div>
                </div>
              ))}
            </div>

            <h4 className="text-[10px] font-black uppercase text-slate-500 tracking-[0.2em] border-b border-white/5 pb-2 mb-4">SCADA Tag Snapshot</h4>
            <div className="space-y-2">
              {Object.entries(selectedBlock.scada_tags).map(([key, tag]: any) => (
                <div key={key} className="flex justify-between items-center p-3 bg-black/40 rounded-xl border border-white/5">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-tighter">{key.replace(/_/g, ' ')}</span>
                  <div className="text-right">
                    <span className="text-xs font-bold text-white mr-2">{tag.value} {tag.unit}</span>
                    <span className="text-[8px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-black">OK</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {selectedField && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-12">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setSelectedField(null)} />
          <div className="relative w-[600px] bg-[#05100d] border border-blue-500/30 p-10 rounded-3xl shadow-2xl animate-in zoom-in-95 duration-300">
             <button onClick={() => setSelectedField(null)} className="absolute top-6 right-6 p-2 rounded-full hover:bg-white/5 text-slate-500 hover:text-white transition-all"><X size={20} /></button>
             <div className="flex items-center gap-4 mb-6">
                <div className="p-4 bg-blue-500/20 rounded-2xl text-blue-400">
                  <Server size={32} />
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase text-blue-400 tracking-[0.3em]">{selectedField.source}</span>
                  <h2 className="text-3xl font-black text-white">{selectedField.label}</h2>
                </div>
             </div>

             <div className="space-y-8">
                <div>
                  <h4 className="text-[10px] font-black uppercase text-slate-500 mb-3 tracking-widest">Plain Language Explanation</h4>
                  <p className="text-xl text-slate-200 leading-relaxed font-medium">"{selectedField.plain_language}"</p>
                </div>

                <div className="grid grid-cols-2 gap-8">
                  <div>
                    <h4 className="text-[10px] font-black uppercase text-slate-500 mb-3 tracking-widest">Why it matters</h4>
                    <p className="text-sm text-slate-400 leading-relaxed">{selectedField.why_it_matters}</p>
                  </div>
                  <div>
                    <h4 className="text-[10px] font-black uppercase text-slate-500 mb-3 tracking-widest">Data Quality Rule</h4>
                    <p className="text-sm text-slate-400 leading-relaxed">{selectedField.quality_rule}</p>
                  </div>
                </div>

                <div className="pt-8 border-t border-white/5 flex gap-8">
                  <div>
                    <p className="text-[10px] font-bold text-slate-500 uppercase">Unit</p>
                    <p className="text-lg font-bold text-white">{selectedField.unit || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-500 uppercase">Refresh Rate</p>
                    <p className="text-lg font-bold text-white">{selectedField.refresh_rate}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-500 uppercase">Visual Type</p>
                    <p className="text-lg font-bold text-blue-400 uppercase tracking-tighter">{selectedField.visual_type}</p>
                  </div>
                </div>
             </div>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Horizon Configuration Metadata ---
const HORIZON_CONFIGS: Record<string, any> = {
  "5min": {
    business_name: "Real-time nowcast / control-room forecast",
    forecast_usage: "Immediate operating awareness and fast ramp/SCADA response.",
    model_family: "Persistence + ramp-rate correction + live SCADA quality gate",
    operator_copy: "Use this horizon to answer: do I need to act in the next few minutes?",
    metrics: [
      { label: "Rolling nMAE", target: "< 5%", plain: "Average recent forecast miss as % of capacity. Lower is better.", tone: "emerald" },
      { label: "Ramp hit rate", target: "> 80%", plain: "Of the real ramp events that happened, how many were detected in time.", tone: "emerald" },
      { label: "Lead time", target: ">= 15 min", plain: "How many minutes before the actual event the forecast raised a useful warning.", tone: "blue" },
      { label: "SCADA health", target: "GOOD", plain: "Whether the real-time signal is fresh enough to trust.", tone: "emerald" },
      { label: "Phase error", target: "low mins", plain: "How early or late the predicted ramp start was compared with actual.", tone: "amber" }
    ],
    show_reliability: false,
    show_rank: false,
    show_ramps: true
  },
  "15min": {
    business_name: "Intra-hour dispatch / short-term correction",
    forecast_usage: "Update operating schedule and detect fast weather-driven changes.",
    model_family: "Persistence + physical weather-to-power blend + quality-aware residual",
    operator_copy: "Use this horizon to answer: is the current dispatch block still safe?",
    metrics: [
      { label: "nMAE", target: "< 6%", plain: "How far the forecast is from actual output in normalized percentage terms.", tone: "emerald" },
      { label: "Ramp hit rate", target: "> 78%", plain: "How often the model catches intra-hour ramps.", tone: "emerald" },
      { label: "False alarm rate", target: "low", plain: "How often the model warns about a ramp that does not really happen.", tone: "rose" },
      { label: "P10-P90 coverage", target: "80-90%", plain: "How often actual output falls inside the uncertainty band.", tone: "blue" },
      { label: "Amplitude error", target: "low MW", plain: "How much the predicted ramp size differs from actual size.", tone: "amber" }
    ],
    show_reliability: false,
    show_rank: false,
    show_ramps: true
  },
  "2hour": {
    business_name: "Intraday forecast / reserve planning",
    forecast_usage: "Support intraday schedule revision, reserve planning, and ramp-risk decisions.",
    model_family: "Physical weather-to-power model + residual correction + Probabilistic spread",
    operator_copy: "Use this horizon to answer: what schedule or reserve correction is needed later today?",
    metrics: [
      { label: "RMSE", target: "lower is best", plain: "Penalizes large misses more strongly. Useful for reserve-risk assessment.", tone: "blue" },
      { label: "nMAE", target: "< 8%", plain: "Typical percentage forecast miss.", tone: "emerald" },
      { label: "Coverage", target: "calibrated", plain: "Whether the uncertainty band is honest enough.", tone: "emerald" },
      { label: "Bias", target: "near zero", plain: "Whether the model is systematically over-forecasting or under-forecasting.", tone: "amber" },
      { label: "Ramp Amplitude", target: "low MW", plain: "Whether the model gets the size of intraday ramps right.", tone: "blue" }
    ],
    show_reliability: true,
    show_rank: false,
    show_ramps: true
  },
  "day_ahead_40hour": {
    business_name: "Day-ahead probabilistic forecast",
    forecast_usage: "Day-ahead scheduling, commitment, market/grid planning, and risk communication.",
    model_family: "NWP ensemble weather-to-power + calibration / quantile mapping",
    operator_copy: "Use this horizon to answer: what should we schedule tomorrow and how uncertain is it?",
    metrics: [
      { label: "MAE / RMSE", target: "lower is best", plain: "How large the day-ahead energy/output forecast error is.", tone: "blue" },
      { label: "Bias", target: "near zero", plain: "Whether day-ahead forecast is usually too high or too low.", tone: "amber" },
      { label: "Reliability", target: "diagonal", plain: "When the model says 70% probability, does it happen about 70% of the time?", tone: "emerald" },
      { label: "Rank histogram", target: "flat-ish", plain: "Shows if ensemble forecasts are too narrow, too wide, or biased.", tone: "blue" },
      { label: "P10-P90 coverage", target: "calibrated", plain: "Whether the forecast band captures actual outcomes as expected.", tone: "emerald" }
    ],
    show_reliability: true,
    show_rank: true,
    show_ramps: false
  },
  "8day": {
    business_name: "Medium-range planning outlook",
    forecast_usage: "Maintenance planning, low-renewable risk windows, weekly reserve outlook.",
    model_family: "Ensemble scenario + analog days + climatology-informed uncertainty",
    operator_copy: "Use this horizon to answer: what is the weekly planning risk?",
    metrics: [
      { label: "Regime accuracy", target: "high", plain: "Did the model identify the correct broad weather/power regime?", tone: "emerald" },
      { label: "Low-gen risk hit", target: "high", plain: "When low-generation risk was predicted, did it actually happen?", tone: "rose" },
      { label: "Weekly Coverage", target: "calibrated", plain: "Whether the wide planning band captures actual daily generation.", tone: "emerald" },
      { label: "Bias", target: "near zero", plain: "Systematic over/under estimate over the week.", tone: "amber" },
      { label: "Scenario spread", target: "interpretable", plain: "How uncertain the weekly outlook is across ensemble paths.", tone: "blue" }
    ],
    show_reliability: true,
    show_rank: true,
    show_ramps: false
  }
};

// --- Tab 2: Historical Training ---

function HistoricalTraining({ plant, selectedHorizon, setSelectedHorizon, scenarioCatalog, rampEvaluations }: any) {
  if (!plant) return <div className="p-12 text-slate-500 italic">Select an asset to view historical validation.</div>;
  
  const config = HORIZON_CONFIGS[selectedHorizon] || HORIZON_CONFIGS["2hour"];
  
  const valData = VALIDATION_LAB_DATA[plant.id] || {
    metrics: { nmae: "0.0%", rmse: "0.0 MW", bias: "0.0 MW", coverage: "0.0%", ramp_hit: "0.0%" },
    reliability: [],
    rank: []
  };

  const metricsData = TRAINING_SUMMARY.find(m => m.plant === plant.id && m.horizon === selectedHorizon) || valData.metrics;

  const filteredCatalog = useMemo(() => {
    return scenarioCatalog.filter((e: any) => e.plant_id === plant.id || e.plant_id === 'all').slice(0, 10);
  }, [scenarioCatalog, plant.id]);

  const filteredRamps = useMemo(() => {
    return rampEvaluations.filter((e: any) => e.plant_id === plant.id).slice(0, 4);
  }, [rampEvaluations, plant.id]);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-start">
        <div>
          <SectionHeader title="Validation Laboratory" subtitle={config.business_name} />
          <div className="flex items-center gap-2 -mt-4 mb-6">
            <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/20 font-mono uppercase tracking-tighter">
              {config.model_family}
            </span>
          </div>
        </div>
        <div className="flex gap-2 bg-black/40 p-1 rounded-xl border border-white/10">
          {Object.keys(HORIZON_CONFIGS).map(h => (
            <button 
              key={h} 
              className={`px-3 py-1 text-[10px] font-bold rounded-lg transition-all ${selectedHorizon === h ? "bg-emerald-500 text-black shadow-[0_0_15px_rgba(16,185,129,0.3)]" : "text-slate-400 hover:text-white"}`}
              onClick={() => setSelectedHorizon(h)}
            >
              {h.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-emerald-500/5 border border-emerald-500/10 p-4 rounded-2xl flex items-center gap-3">
        <Info size={16} className="text-emerald-400 flex-shrink-0" />
        <p className="text-xs text-slate-300 italic font-medium">{config.operator_copy}</p>
      </div>

      <div className="grid grid-cols-5 gap-4">
        {config.metrics.map((m: any, idx: number) => (
          <Kpi 
            key={idx}
            label={m.label} 
            value={idx === 0 ? metricsData.nmae || metricsData.rmse : idx === 1 ? metricsData.ramp_hit : idx === 2 ? metricsData.coverage : idx === 3 ? metricsData.bias : "8.4 MW"} 
            subValue={`Target: ${m.target}`} 
            plainLanguage={m.plain}
            tone={m.tone} 
          />
        ))}
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Reliability Diagram */}
        <div className={`bg-white/5 border border-white/10 p-6 rounded-3xl transition-opacity ${config.show_reliability ? "opacity-100" : "opacity-40 pointer-events-none"}`}>
           <h4 className="text-xs font-bold uppercase text-slate-400 mb-2 flex justify-between">
              Reliability Diagram <span className="text-emerald-500 lowercase font-normal italic">Calibration Plot</span>
           </h4>
           <p className="text-[10px] text-slate-500 mb-4">Checks whether predicted probabilities are honest. If predicted 80% events happen around 80% of the time, the model is calibrated.</p>
           <ResponsiveContainer width="100%" height={200}>
              <ScatterChart margin={{ top: 10, right: 30, bottom: 20, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                <XAxis type="number" dataKey="prob" name="Forecast Probability" domain={[0, 1]} tick={{fill: '#64748b', fontSize: 10}} label={{ value: 'Forecast Prob.', position: 'bottom', fill: '#64748b', fontSize: 10 }} />
                <YAxis type="number" dataKey="obs" name="Observed Frequency" domain={[0, 1]} tick={{fill: '#64748b', fontSize: 10}} label={{ value: 'Observed Freq.', angle: -90, position: 'left', fill: '#64748b', fontSize: 10 }} />
                <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                <ReferenceLine segment={[{ x: 0, y: 0 }, { x: 1, y: 1 }]} stroke="#64748b" strokeDasharray="3 3" />
                <Scatter name="Calibration" data={valData.reliability} fill="#10b981" line />
              </ScatterChart>
           </ResponsiveContainer>
           <div className="mt-4 p-3 bg-black/40 rounded-xl border border-white/5">
              <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Why this visual matters</p>
              <p className="text-[9px] text-slate-500 leading-relaxed">It prevents over-confidence. For probabilistic horizons ({selectedHorizon}), operators need to know if a 90% risk signal can be trusted at face value for reserve commitment.</p>
           </div>
        </div>

        {/* Rank Histogram or Ramp Small Multiples */}
        {config.show_rank ? (
          <div className="bg-white/5 border border-white/10 p-6 rounded-3xl">
             <h4 className="text-xs font-bold uppercase text-slate-400 mb-2 flex justify-between">
                Rank Histogram <span className="text-blue-500 lowercase font-normal italic">Ensemble Spread</span>
             </h4>
             <p className="text-[10px] text-slate-500 mb-4">Checks whether the weather ensemble spread is too narrow, too wide or biased. A flat-ish histogram means the ensemble is more reliable.</p>
             <ResponsiveContainer width="100%" height={200}>
                <BarChart data={valData.rank}>
                   <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                   <XAxis dataKey="rank" tick={{fill: '#64748b', fontSize: 10}} label={{ value: 'Rank Index', position: 'bottom', fill: '#64748b', fontSize: 10 }} />
                   <YAxis tick={{fill: '#64748b', fontSize: 10}} />
                   <Tooltip />
                   <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
             </ResponsiveContainer>
             <div className="mt-4 p-3 bg-black/40 rounded-xl border border-white/5">
                <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Why this visual matters</p>
                <p className="text-[9px] text-slate-500 leading-relaxed">Identifies structural under-dispersion. If the bars are high at the edges (U-shaped), the model is consistently surprised because the forecast band is too narrow.</p>
             </div>
          </div>
        ) : (
          <div className="bg-white/5 border border-white/10 p-6 rounded-3xl">
             <h4 className="text-xs font-bold uppercase text-slate-400 mb-2 flex justify-between">
                Ramp Evaluation History <span className="text-amber-500 lowercase font-normal italic">Timing & Shape</span>
             </h4>
             <p className="text-[10px] text-slate-500 mb-4">Shows whether the model got ramp timing and ramp shape right, not just the average error across 2015-2025 events.</p>
             <div className="space-y-3 mt-4">
                {filteredRamps.length > 0 ? filteredRamps.map((e: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between bg-black/40 p-3 rounded-xl border border-white/5 group hover:border-emerald-500/30 transition-all">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-mono text-emerald-400">{e.scenario_id.split('_').slice(0,2).join('_')}</span>
                      <span className="text-[9px] text-slate-500 truncate max-w-[120px]">{e.event_type.replace(/_/g, ' ')}</span>
                    </div>
                    <div className="flex gap-4 items-center">
                      <div className="text-right">
                        <div className="text-[10px] font-bold text-slate-300">{e.phase_error_minutes}m</div>
                        <div className="text-[8px] text-slate-500 uppercase">Phase Err</div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] font-bold text-slate-300">{parseFloat(e.actual_amplitude_mw).toFixed(0)} MW</div>
                        <div className="text-[8px] text-slate-500 uppercase">Amplitude</div>
                      </div>
                      <div className={`text-[10px] font-bold ${e.detected === 'Y' ? 'text-emerald-400' : 'text-rose-400'}`}>{e.detected === 'Y' ? 'HIT' : 'MISS'}</div>
                    </div>
                  </div>
                )) : (
                  <div className="text-[10px] text-slate-500 italic p-8 text-center">No ramp evaluations available for this selection.</div>
                )}
             </div>
          </div>
        )}
      </div>

      <div className="bg-black/40 border border-white/10 rounded-3xl p-6">
        <div className="flex justify-between items-center mb-4">
          <h4 className="text-xs font-bold uppercase text-slate-400">Historical Event Training History</h4>
          <span className="text-[10px] text-slate-500 bg-white/5 px-3 py-1 rounded-full border border-white/5">
            Historical library: {scenarioCatalog.length} catalogued major events across 2015-2025
          </span>
        </div>
        <div className="overflow-hidden rounded-xl border border-white/5">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-white/5 text-slate-400">
                <th className="p-3 text-left">Event ID</th>
                <th className="p-3 text-left">Type</th>
                <th className="p-3 text-left">Root Cause</th>
                <th className="p-3 text-right">Horizon Context</th>
                <th className="p-3 text-center">Outcome</th>
              </tr>
            </thead>
            <tbody className="text-slate-300">
              {filteredCatalog.map((row: any, i: number) => (
                <tr key={i} className="border-t border-white/5 hover:bg-white/5 transition-colors cursor-pointer group">
                  <td className="p-3 font-mono text-emerald-400">{row.scenario_id.split('_').slice(0,2).join('_')}</td>
                  <td className="p-3">{row.event_type.replace(/_/g, ' ')}</td>
                  <td className="p-3 text-slate-500 uppercase">{row.root_cause} / {row.pattern_shape?.split(' ')[0] || 'N/A'}</td>
                  <td className="p-3 text-right font-bold text-slate-400">{selectedHorizon.toUpperCase()}</td>
                  <td className="p-3 text-center">
                     <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">CALIBRATED</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-[9px] text-slate-500 leading-relaxed">
          Showing sample records from the 2015-2025 event catalog. These records are used for recursive model training and calibration across {selectedHorizon} horizons.
        </p>
      </div>
    </div>
  );
}


// --- Tab 3: Live Simulation ---

function LiveSimulation({ simState, plant, isPlaying, selectedHorizon, setSelectedHorizon }: any) {
  if (!plant) return <div className="p-12 text-slate-500 italic">Select an asset to view live simulation.</div>;
  const [history, setHistory] = useState<any[]>([]);
  const targetPlant = simState.plants.find((p: any) => p.plant_id === plant.id);
  
  // Track growth of history for "Live Replay" behavior
  useEffect(() => {
    if (!targetPlant) return;
    setHistory(prev => {
      const last = prev[prev.length - 1];
      if (last?.timestamp === targetPlant.timestamp) return prev;
      return [...prev, { ...targetPlant }].slice(-60); // Keep last 60 points
    });
  }, [targetPlant]);

  const forecast = simState.forecasts.find((f: any) => f.asset_id === plant.id && f.horizon === "2hour");
  const forecastPoints = forecast?.points || [];
  
  // Combine history with future forecast
  const chartData = useMemo(() => {
    // Current time for the "NOW" reference
    const nowTime = targetPlant?.timestamp;

    const combined = history.map(h => ({
      time: h.timestamp,
      actual: h.actual_mw,
      p50_history: h.forecast_p50_mw,
      p10: h.forecast_p10_mw,
      p90: h.forecast_p90_mw,
      limit: h.local_limit_mw,
      possible: h.possible_power_mw,
      type: 'history'
    }));

    // Future points (P50/P10/P90 only)
    const future = forecastPoints.map((p: any, i: number) => {
      const timeStr = engine.getTimeString(p.offset_min);
      // Avoid overlap with history
      if (history.some(h => h.timestamp === timeStr)) return null;
      
      return {
        time: timeStr,
        actual: null,
        p50_future: p.p50,
        p10: p.p10,
        p90: p.p90,
        limit: targetPlant?.local_limit_mw,
        type: 'future'
      };
    }).filter(Boolean);

    return [...combined, ...future];
  }, [history, forecastPoints, targetPlant]);

  const currentPattern = LIVE_REPLAY_SAMPLES.find(s => 
    s.scenario === engine.scenario && 
    s.plant === plant.id && 
    s.time === targetPlant?.timestamp
  );

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-end">
        <SectionHeader title="Live Operating Day" subtitle="Real-time probability fan and operational intelligence." />
        {currentPattern && (
          <div className="bg-amber-500/10 border border-amber-500/30 px-4 py-2 rounded-2xl flex items-center gap-3 animate-pulse">
            <Activity size={16} className="text-amber-400" />
            <div>
              <p className="text-[8px] font-bold uppercase text-amber-500/60 leading-none">Detected Pattern</p>
              <p className="text-xs font-bold text-amber-400">{currentPattern.scenario.replace(/_/g, ' ').toUpperCase()}</p>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-4 gap-4">
        <Kpi label="Current Actual" value={`${targetPlant?.actual_mw?.toFixed(1) || '0.0'} MW`} tone="emerald" />
        <Kpi label="P50 Forecast" value={`${targetPlant?.forecast_p50_mw?.toFixed(1) || '0.0'} MW`} tone="blue" />
        <Kpi label="Current Bias" value={`${(targetPlant?.deviation_pct || 0).toFixed(1)}%`} tone={Math.abs(targetPlant?.deviation_pct || 0) > 10 ? "amber" : "emerald"} />
        <Kpi label="Telemetry Quality" value={targetPlant?.data_quality_flag || "GOOD"} tone={targetPlant?.data_quality_flag === 'GOOD' ? 'emerald' : 'amber'} />
      </div>

      <div className="bg-black/40 border border-white/10 rounded-3xl p-4">
        <OperationalForecastChart 
          isPlaying={isPlaying} 
          selectedHorizon={selectedHorizon} 
          setSelectedHorizon={setSelectedHorizon} 
          simState={simState}
          assetType={plant.technology}
        />
      </div>
    </div>
  );
}

// --- Tab 4: Forecast Aggregation ---

function AggregationView({ plant, simState, hierarchyTree, hierarchyTimeline }: any) {
  const [selectedHubId, setSelectedHubId] = useState<string | null>(null);

  if (!plant || !hierarchyTree) return <div className="p-12 text-slate-500 italic text-center">Loading aggregation hierarchy...</div>;

  const targetPlant = simState.plants.find((p: any) => p.plant_id === plant.id);
  
  const plantNode = useMemo(() => {
    const found = hierarchyTree?.children?.find((c: any) => c.asset_id === plant.id);
    if (found) return found;
    
    // Fallback for Wind or missing data: Create virtual hierarchy
    if (plant.technology === 'wind') {
      return {
        asset_id: plant.id,
        asset_name: plant.name,
        capacity_mw: plant.capacity_mw,
        children: Array.from({ length: 2 }, (_, i) => ({
          asset_id: `${plant.id}_FARM_${i+1}`,
          asset_name: `Wind Farm ${i+1}`,
          capacity_mw: plant.capacity_mw / 2,
          children: Array.from({ length: 60 }, (_, j) => ({
            asset_id: `${plant.id}_T${i+1}_${j+1}`,
            asset_name: `Turbine ${j+1}`,
            capacity_mw: 3.5
          }))
        }))
      };
    }
    return hierarchyTree?.children?.[0] || { asset_id: plant.id, asset_name: plant.name, capacity_mw: plant.capacity_mw, children: [] };
  }, [hierarchyTree, plant]);
  
  const hubs = useMemo(() => {
    if (plant.technology === 'wind') {
      // For wind, explicitly return the 2 farms from wind_config
      return [
        { asset_id: `${plant.id}_FARM_1`, asset_name: "Wind Farm 1", capacity_mw: plant.capacity_mw / 2, children: Array.from({length: 60}) },
        { asset_id: `${plant.id}_FARM_2`, asset_name: "Wind Farm 2", capacity_mw: plant.capacity_mw / 2, children: Array.from({length: 60}) }
      ];
    }
    return plantNode?.children || [];
  }, [plantNode, plant.technology, plant.id, plant.capacity_mw]);

  const selectedHub = hubs.find((h: any) => h.asset_id === selectedHubId) || hubs[0];

  // Filter timeline for selected hub
  const hubEvents = useMemo(() => {
    if (!selectedHub) return [];
    return hierarchyTimeline.filter((e: any) => e.asset_id === selectedHub.asset_id && e.plant_id === plant.id);
  }, [selectedHub, hierarchyTimeline]);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <SectionHeader 
        title="Forecast Aggregation Hierarchy" 
        subtitle="Visualizing how block-level telemetry rolls up to hub and plant-level grid injection." 
      />

      <div className="flex flex-col xl:flex-row gap-8">
        {/* Left Section: Hierarchy Grid */}
        <div className="flex-1 space-y-6">
          <div className="space-y-4">
            <div className="text-[10px] font-black uppercase text-slate-500 tracking-widest mb-2">Level 1: Plant Total</div>
            <div className="p-6 rounded-3xl bg-emerald-500/10 border border-emerald-500/30">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <p className="text-sm font-bold text-white">{plantNode?.asset_name}</p>
                  <p className="text-[10px] text-emerald-400 font-mono tracking-wider uppercase">{plantNode?.asset_id}</p>
                </div>
                <div className="p-2 bg-black/40 rounded-lg shadow-inner"><Globe size={18} className="text-emerald-400" /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-black/20 p-3 rounded-2xl border border-white/5">
                  <span className="text-[9px] uppercase text-slate-500 font-bold block mb-1">Aggregated Output</span>
                  <span className="text-xl font-bold text-white tracking-tight">{targetPlant?.actual_mw?.toFixed(1) || '0.0'} MW</span>
                </div>
                <div className="bg-black/20 p-3 rounded-2xl border border-white/5">
                  <span className="text-[9px] uppercase text-slate-500 font-bold block mb-1">Design Capacity</span>
                  <span className="text-xl font-bold text-slate-400 tracking-tight">{plantNode?.capacity_mw} MW</span>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-center mb-2">
              <div className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Level 2: Hub / Segment Rollup</div>
              <span className="text-[9px] text-slate-500 italic">Click a hub to view segment intelligence</span>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {hubs.map((hub: any) => {
                const hubActual = hub.capacity_mw * (targetPlant?.actual_mw / targetPlant?.capacity_mw);
                const isSelected = selectedHubId === hub.asset_id;
                
                return (
                  <div 
                    key={hub.asset_id} 
                    onClick={() => setSelectedHubId(hub.asset_id)}
                    className={`p-5 rounded-2xl transition-all cursor-pointer border ${
                      isSelected 
                      ? 'bg-emerald-500/20 border-emerald-500/50 ring-1 ring-emerald-500/30' 
                      : 'bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/10'
                    }`}
                  >
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-[11px] font-bold text-white truncate max-w-[120px]">{hub.asset_name}</span>
                      <span className={`text-[8px] font-bold px-2 py-0.5 rounded-full ${hub.latest_event ? 'bg-amber-500/20 text-amber-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                        {hub.latest_event ? 'EVENT' : 'NOMINAL'}
                      </span>
                    </div>
                    
                    <div className="flex justify-between items-end mb-3">
                      <div>
                        <p className="text-[8px] uppercase text-slate-500 font-black tracking-tighter">Contribution</p>
                        <p className={`text-lg font-bold ${isSelected ? 'text-emerald-300' : 'text-emerald-400'}`}>{hubActual.toFixed(1)} MW</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[8px] uppercase text-slate-500 font-black tracking-tighter">Capacity</p>
                        <p className="text-[11px] text-slate-300 font-medium">{hub.capacity_mw} MW</p>
                      </div>
                    </div>
                    
                    <div className="h-1.5 w-full bg-black/40 rounded-full overflow-hidden">
                      <div 
                        className={`h-full transition-all duration-1000 ${hub.latest_event ? 'bg-amber-500/60' : 'bg-emerald-500/60'}`} 
                        style={{ width: `${(hubActual / hub.capacity_mw) * 100}%` }} 
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Section: Hub Intelligence */}
        <div className="w-full xl:w-[400px] space-y-6">
          <div className="text-[10px] font-black uppercase text-slate-500 tracking-widest mb-2">Segment Intelligence</div>
          
          {selectedHub ? (
            <div className="bg-black/40 border border-white/10 rounded-3xl p-6 space-y-6 sticky top-0 animate-in fade-in zoom-in-95 duration-300">
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-2xl ${selectedHub.latest_event ? 'bg-amber-500/10 text-amber-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                  <Zap size={24} />
                </div>
                <div>
                  <h4 className="text-lg font-bold text-white tracking-tight">{selectedHub.asset_name}</h4>
                  <p className="text-[10px] text-slate-500 font-mono uppercase tracking-widest">{selectedHub.asset_id}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
                  <p className="text-[9px] uppercase text-slate-500 font-black mb-1">Block Count</p>
                  <p className="text-xl font-bold text-white">{selectedHub.children?.length || 0}</p>
                </div>
                <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
                  <p className="text-[9px] uppercase text-slate-500 font-black mb-1">Status</p>
                  <p className={`text-sm font-bold ${selectedHub.latest_event ? 'text-amber-400' : 'text-emerald-400'}`}>
                    {selectedHub.latest_event?.event_type?.replace(/_/g, ' ') || 'Nominal Performance'}
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Recent Performance Rollups</p>
                  <History size={14} className="text-slate-600" />
                </div>
                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                  {hubEvents.length > 0 ? hubEvents.map((evt: any, idx: number) => (
                    <div key={idx} className="p-3 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors">
                      <div className="flex justify-between items-start mb-1">
                        <span className="text-[10px] font-bold text-white truncate max-w-[150px]">{evt.event_type?.replace(/_/g, ' ') || 'Normal Load'}</span>
                        <span className="text-[9px] font-mono text-slate-500">{evt.start_time?.split('T')[1]?.substring(0, 5)}</span>
                      </div>
                      <div className="flex justify-between text-[11px]">
                        <span className="text-slate-500">Output Loss:</span>
                        <span className={parseFloat(evt.max_loss_mw) > 0 ? 'text-amber-400' : 'text-emerald-400'}>
                          {parseFloat(evt.max_loss_mw).toFixed(1)} MW
                        </span>
                      </div>
                    </div>
                  )) : (
                    <div className="py-8 text-center">
                      <p className="text-[10px] text-slate-500 italic">No significant events detected for this segment.</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/10">
                <div className="flex items-start gap-3">
                  <Activity size={16} className="text-emerald-400 mt-1" />
                  <div>
                    <p className="text-[10px] font-bold text-emerald-400 uppercase mb-1">Rollup Intelligence</p>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      Telemetry for this segment is aggregated from {selectedHub.children?.length} individual blocks. 
                      Forecast bias is currently within acceptable limits (&lt;5%).
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="h-[500px] flex items-center justify-center border border-dashed border-white/10 rounded-3xl">
              <p className="text-xs text-slate-600 italic">Select a hub to view details</p>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}

// --- Tab 5: Online Learning ---

function OnlineLearning({ plant, simState, timelineData, eventLog, selectedHorizon, setSelectedHorizon }: any) {
  if (!plant) return <div className="p-12 text-slate-500 italic">Select an asset to view online learning status.</div>;

  // Get current state from simState (using targetPlant.timestamp to match CSV)
  const targetPlant = simState.plants.find((p: any) => p.plant_id === plant.id);
  const rawTime = targetPlant?.timestamp || "13:00"; // Fallback to 13:00
  
  // Align with CSV timestamp format: e.g. "2025-01-05T13:00:00"
  const currentTime = rawTime.includes('T') ? rawTime : `2025-01-05T${rawTime.length === 5 ? rawTime : '13:00'}:00`;

  // Filter event log with technology-aware fallback if plant_id is missing
  const activeEvents = useMemo(() => {
    return eventLog.filter((e: any) => {
      const matchesHorizon = e.horizon.toLowerCase() === selectedHorizon.toLowerCase();
      const matchesTime = e.timestamp <= currentTime;
      
      // If plant_id exists, use it. Otherwise, infer from technology.
      if (e.plant_id) {
        return matchesHorizon && matchesTime && e.plant_id === plant.id;
      }

      // Logic to partition generic events if plant_id is missing
      const isSolar = plant.technology === 'solar';
      const eventLower = (e.event_title || e.plain_language_learning || "").toLowerCase();
      const isSolarEvent = eventLower.includes('cloud') || eventLower.includes('irradiance') || eventLower.includes('solar') || eventLower.includes('pv');
      const isWindEvent = eventLower.includes('wind') || eventLower.includes('turbine') || eventLower.includes('nacelle') || eventLower.includes('gust');
      
      // Generic events go to both, technology-specific ones are filtered
      if (isSolar && isWindEvent) return false;
      if (!isSolar && isSolarEvent) return false;

      return matchesHorizon && matchesTime;
    }).sort((a: any, b: any) => b.timestamp.localeCompare(a.timestamp));
  }, [eventLog, currentTime, selectedHorizon, plant.id, plant.technology]);

  // Also filter timelineData similarly for activeTimeline
  const activeTimeline = useMemo(() => {
    const horizonRows = timelineData.filter((r: any) => {
      const matchesHorizon = r.horizon.toLowerCase() === selectedHorizon.toLowerCase();
      if (r.plant_id) return matchesHorizon && r.plant_id === plant.id;
      
      // Fallback: If no plant_id in CSV, create technology-specific variations
      return matchesHorizon;
    });
    const matched = horizonRows.filter((r: any) => r.timestamp <= currentTime).slice(-1)[0];
    return matched || horizonRows[0];
  }, [timelineData, currentTime, selectedHorizon, plant.id]);

  const config = ONLINE_LEARNING_HORIZON_CONFIG[selectedHorizon] || ONLINE_LEARNING_HORIZON_CONFIG["2hour"];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      <div className="flex justify-between items-center">
        <SectionHeader title="Online Model Health" subtitle="Live tracking of forecast drift and autonomous learning." />
        <div className="flex items-center gap-3">
          <div className="text-[10px] font-mono text-emerald-500 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
            MODEL: {activeTimeline?.model_family || config.model_family}
          </div>
          <div className={`px-4 py-1 rounded-full border text-[10px] font-black uppercase tracking-widest animate-pulse ${
            activeTimeline?.ui_badge === 'REFRESH' ? 'bg-rose-500/20 text-rose-400 border-rose-500/40' :
            activeTimeline?.ui_badge === 'WATCH' ? 'bg-amber-500/20 text-amber-400 border-amber-500/40' :
            'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
          }`}>
            STATUS: {activeTimeline?.ui_badge || 'OK'}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-3">
        {["5min", "15min", "2hour", "40hour", "8day"].map(h => (
          <button
            key={h}
            onClick={() => setSelectedHorizon(h)}
            className={`px-4 py-3 rounded-2xl border text-[10px] font-bold uppercase transition-all ${
              selectedHorizon === h 
                ? "bg-emerald-500 text-black border-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.3)]" 
                : "bg-black/40 text-slate-500 border-white/10 hover:border-white/20"
            }`}
          >
            {h} Horizon
          </button>
        ))}
      </div>

      <div className="bg-emerald-900/10 border border-emerald-500/20 rounded-3xl p-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-5">
           <Zap size={120} />
        </div>
        <div className="flex items-start gap-8 relative z-10">
           <div className="p-5 bg-emerald-500/20 rounded-2xl text-emerald-400 shadow-inner">
             <Cpu size={40} />
           </div>
           <div className="flex-1">
             <div className="flex items-center gap-2 mb-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <h4 className="text-xs font-bold uppercase text-emerald-400 tracking-tighter">Learning Signal: {activeTimeline?.learning_signal || 'NORMAL_LEARNING'}</h4>
             </div>
             <p className="text-2xl font-bold text-white mb-6 leading-tight">{activeTimeline?.plain_language_learning || 'The model is operating within nominal statistical bands.'}</p>
             <div className="flex gap-4">
                <div className="text-[10px] text-slate-400 bg-black/60 px-4 py-2 rounded-xl border border-white/5">
                   <span className="opacity-40 uppercase mr-2 font-bold">Root Cause:</span>
                   <span className="text-slate-200 font-bold uppercase">{activeTimeline?.root_cause || 'none'}</span>
                </div>
                <div className="text-[10px] text-slate-400 bg-black/60 px-4 py-2 rounded-xl border border-white/5">
                   <span className="opacity-40 uppercase mr-2 font-bold">Application:</span>
                   <span className="text-emerald-400 font-bold">{config.business_name}</span>
                </div>
             </div>
           </div>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {config.primary_online_metrics.map((m: string) => {
          let rawVal = activeTimeline?.[m];
          let val = rawVal || "0.0";
          let label = m.replace(/_/g, ' ').replace(' pct', '').replace(' mw', '').toUpperCase();
          
          if (m.includes('pct')) {
            val = parseFloat(val).toFixed(1) + '%';
          } else if (m.includes('mw')) {
            val = parseFloat(val).toFixed(1) + ' MW';
          } else if (m.includes('minutes')) {
             val = val + 'm';
          }
          
          return (
            <Kpi 
              key={m} 
              label={label} 
              value={val} 
              plainLanguage={config.what_learning_means}
              tone={activeTimeline?.ui_badge === 'OK' ? "emerald" : (activeTimeline?.ui_badge === 'WATCH' ? 'amber' : 'rose')} 
            />
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-8">
        <div className="bg-black/40 border border-white/10 rounded-3xl p-8 flex flex-col h-[400px]">
          <SectionHeader title="Learning Event Log" subtitle="History of autonomous parameter updates." />
          <div className="flex-1 space-y-4 overflow-y-auto custom-scrollbar pr-4">
            {activeEvents.map((ev: any, i: number) => (
              <div key={i} className="flex gap-4 items-start p-4 rounded-2xl hover:bg-white/5 transition-all border border-white/5 hover:border-white/10 group">
                <div className="mt-1.5">
                  <div className={`w-3 h-3 rounded-full border-2 border-black ${ev.intensity === 'high' ? 'bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.5)]' : 'bg-emerald-500'}`} />
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-[10px] font-mono text-slate-500 font-bold tracking-widest">{ev.timestamp.split('T')[1].substring(0,5)}</span>
                    <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded border ${
                      ev.action_code === 'REFRESH' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                    }`}>
                      {ev.action_code}
                    </span>
                  </div>
                  <p className="text-sm font-bold text-slate-200 group-hover:text-emerald-400 transition-colors">{ev.event_title}</p>
                  <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">{ev.explanation}</p>
                </div>
              </div>
            ))}
            {activeEvents.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-slate-600 italic text-xs gap-3">
                <Database size={24} className="opacity-20" />
                <span>No learning events recorded yet for this horizon.</span>
              </div>
            )}
          </div>
        </div>

        <div className="bg-black/40 border border-white/10 rounded-3xl p-8 flex flex-col h-[400px]">
          <SectionHeader title="Autonomous Recommendation" subtitle="Agent reasoning on model weights." />
          <div className="flex-1 flex flex-col">
            <div className="bg-emerald-500/5 p-5 rounded-2xl border border-emerald-500/10 mb-6 relative overflow-hidden">
              <div className="absolute -right-4 -top-4 opacity-5 rotate-12">
                 <Shield size={60} />
              </div>
              <div className="flex items-center gap-2 mb-3 text-emerald-400">
                <Info size={14} />
                <span className="text-[10px] font-black uppercase tracking-widest">Logic Reference</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed font-medium italic">
                "{config.refresh_rule}"
              </p>
            </div>
            
            <div className="bg-white/5 p-6 rounded-2xl border border-white/10 flex-1">
              <h5 className="text-[10px] font-black uppercase text-slate-500 mb-4 tracking-widest flex items-center gap-2">
                <Zap size={10} className="text-amber-500" /> Decision Reason
              </h5>
              <p className="text-sm text-slate-300 leading-relaxed mb-6">
                The model is tracking the <span className="text-emerald-400 font-bold underline underline-offset-4">{selectedHorizon}</span> horizon. 
                Based on current <span className="text-slate-100 font-medium">{activeTimeline?.root_cause === 'weather' ? 'atmospheric turbulence' : 'statistical drift'}</span> detected in the {config.learning_window}, 
                the Agent has determined that a <span className="text-emerald-400 font-bold px-1.5 py-0.5 bg-emerald-400/10 rounded">{activeTimeline?.model_action_code || 'PASSIVE_MONITORING'}</span> is appropriate.
              </p>
              
              <div className="mt-auto pt-4 border-t border-white/5">
                 <div className="flex justify-between items-center text-[10px]">
                    <span className="text-slate-500 uppercase font-bold">Recommended Action</span>
                    <span className="text-emerald-400 font-mono font-bold animate-pulse">{activeTimeline?.model_action_code === 'NO_ACTION' ? 'CONTINUE_NOMINAL' : activeTimeline?.model_action_code}</span>
                 </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Right Sidebar: System Monitor ---

function SystemMonitorSidebar({ plant, targetPlant }: any) {
  if (!plant || !targetPlant) return null;

  return (
    <aside className="w-80 bg-[#020806] border-l border-emerald-500/10 flex flex-col overflow-y-auto custom-scrollbar">
      <div className="p-6 border-b border-white/5">
        <h3 className="text-[10px] font-bold uppercase text-slate-500 tracking-[0.2em] mb-4">Grid Control Center</h3>
        
        <div className="bg-emerald-500/5 rounded-2xl p-5 border border-emerald-500/20 mb-6">
          <div className="flex justify-between items-center mb-4">
            <span className="text-[10px] font-bold text-slate-400 uppercase">Substation Health</span>
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span className="text-[9px] font-bold text-emerald-400">OPTIMAL</span>
            </div>
          </div>
          <div className="flex items-center justify-center py-4">
            <div className="relative w-24 h-24 flex items-center justify-center">
              <svg className="absolute inset-0 w-full h-full -rotate-90">
                <circle cx="48" cy="48" r="44" fill="none" stroke="currentColor" strokeWidth="6" className="text-white/5" />
                <circle cx="48" cy="48" r="44" fill="none" stroke="currentColor" strokeWidth="6" strokeDasharray="276" strokeDashoffset="27.6" className="text-emerald-500" strokeLinecap="round" />
              </svg>
              <div className="text-center">
                <Network className="w-6 h-6 text-emerald-400 mx-auto mb-1" />
                <div className="text-lg font-bold text-white">90<span className="text-[10px]">%</span></div>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-4">
            <div className="bg-black/40 p-2 rounded-lg border border-white/5">
              <div className="text-[8px] text-slate-500 uppercase mb-0.5">Transformer</div>
              <div className="text-[10px] font-bold text-slate-300">NOMINAL</div>
            </div>
            <div className="bg-black/40 p-2 rounded-lg border border-white/5">
              <div className="text-[8px] text-slate-500 uppercase mb-0.5">Breakers</div>
              <div className="text-[10px] font-bold text-emerald-400">CLOSED</div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Shield size={14} className="text-rose-400" />
              <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Curtailment Status</span>
            </div>
            
            <div className="space-y-3">
          <div className="p-4 rounded-2xl bg-black/40 border border-white/5 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-[10px] text-slate-500">Local Limit</span>
              <span className="text-xs font-bold text-rose-400 font-mono">{targetPlant?.local_limit_mw || 0} MW</span>
            </div>
            <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
              <div 
                className="h-full bg-rose-500 transition-all duration-1000" 
                style={{ width: `${Math.min(100, ((targetPlant?.actual_mw || 0) / (targetPlant?.local_limit_mw || 1)) * 100)}%` }} 
              />
            </div>
            <div className="flex justify-between items-center pt-1">
              <span className="text-[9px] text-slate-500 uppercase">Status</span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${targetPlant?.curtailment_flag ? 'bg-rose-500/20 text-rose-400 animate-pulse' : 'bg-emerald-500/20 text-emerald-400'}`}>
                {targetPlant?.curtailment_flag ? 'CURTAILED' : 'NOMINAL'}
              </span>
            </div>
          </div>
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-4">
              <Cpu size={14} className="text-blue-400" />
              <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Asset Performance</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                <div className="text-[8px] text-slate-500 uppercase mb-1">{plant.technology === 'solar' ? 'Inverters' : 'Turbines'}</div>
                <div className="text-xs font-bold text-white">{targetPlant?.inverter_availability_pct || 100}%</div>
              </div>
              <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                <div className="text-[8px] text-slate-500 uppercase mb-1">U-Score</div>
                <div className="text-xs font-bold text-amber-400">{targetPlant?.underperformance_score?.toFixed(1) || '0.0'}</div>
              </div>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-blue-500/5 border border-blue-500/10">
            <div className="flex items-center gap-2 mb-3">
              <Zap size={12} className="text-blue-400" />
              <span className="text-[9px] font-bold uppercase text-blue-400">Load Matching</span>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-[10px]">
                <span className="text-slate-500">Scheduled</span>
                <span className="text-slate-300">{targetPlant?.scheduled_mw?.toFixed(1) || '0.0'} MW</span>
              </div>
              <div className="flex justify-between text-[10px]">
                <span className="text-slate-500">Actual Export</span>
                <span className="text-emerald-400 font-bold">{targetPlant?.actual_mw?.toFixed(1) || '0.0'} MW</span>
              </div>
              <div className="flex justify-between text-[10px] pt-1 border-t border-white/5">
                <span className="text-slate-500">Deviation</span>
                <span className={`font-mono ${Math.abs((targetPlant?.actual_mw || 0) - (targetPlant?.scheduled_mw || 0)) > 5 ? 'text-rose-400' : 'text-emerald-400'}`}>
                  {((targetPlant?.actual_mw || 0) - (targetPlant?.scheduled_mw || 0)).toFixed(1)} MW
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div className="p-6 mt-auto border-t border-white/5">
        <div className="text-[9px] text-slate-500 leading-relaxed italic">
          Grid Control Sidebar: Real-time telemetry monitoring for substation {plant.id}_SUB_01. All measurements are updated every 5 simulation minutes.
        </div>
      </div>
    </aside>
  );
}

// --- Main Simulation Tab Component ---

export default function SimulationTab({ simState, assetType, setAssetType, isPlaying, setIsPlaying }: any) {
  const [activeSubTab, setActiveSubTab] = useState("brief");
  const [selectedPlantId, setSelectedPlantId] = useState(assetType === "solar" ? "SOL_PAVAGADA" : "WND_GADAG");
  const [selectedHorizon, setSelectedHorizon] = useState("5min");
  const [timelineData, setTimelineData] = useState<any[]>([]);
  const [eventLog, setEventLog] = useState<any[]>([]);
  const [scenarioCatalog, setScenarioCatalog] = useState<any[]>([]);
  const [rampEvaluations, setRampEvaluations] = useState<any[]>([]);
  const [hierarchyTree, setHierarchyTree] = useState<any>(null);
  const [hierarchyTimeline, setHierarchyTimeline] = useState<any[]>([]);

  // Load static data
  useEffect(() => {
    // Load timeline CSV
    fetch('/data/online_learning_timeline_horizonwise.csv')
      .then(res => res.text())
      .then(text => {
        const parsed = parseCSV(text);
        setTimelineData(parsed);
      });

    // Load event log JSON
    fetch('/data/online_learning_event_log.json')
      .then(res => res.json())
      .then(data => setEventLog(data));

    // Load historical catalog
    fetch('/data/scenario_event_catalog_2015_2025.csv')
      .then(res => res.text())
      .then(text => setScenarioCatalog(parseCSV(text)));

    // Load ramp evaluations
    fetch('/data/ramp_event_evaluation.csv')
      .then(res => res.text())
      .then(text => setRampEvaluations(parseCSV(text)));

    // Load hierarchy data
    fetch('/data/hierarchy/hierarchy_event_tree.json')
      .then(res => res.json())
      .then(data => setHierarchyTree(data));

    fetch('/data/hierarchy/hierarchy_event_timeline.csv')
      .then(res => res.text())
      .then(text => setHierarchyTimeline(parseCSV(text)));
  }, []);

  const availablePlants = useMemo(() => PLANTS.filter(p => p.technology === assetType), [assetType]);
  const currentPlant = useMemo(() => availablePlants.find(p => p.id === selectedPlantId) || availablePlants[0], [availablePlants, selectedPlantId]);

  // Sync selected plant when asset type changes
  useEffect(() => {
    setSelectedPlantId(assetType === "solar" ? "SOL_PAVAGADA" : "WND_GADAG");
  }, [assetType]);

  return (
    <div className="flex h-full overflow-hidden">
      {/* Simulation Sidebar */}
      <aside className="w-72 bg-[#05100d] border-r border-emerald-500/10 flex flex-col">
        <div className="p-6 border-b border-emerald-500/10">
          <div className="asset-toggle mb-6">
            <button className={assetType === "solar" ? "active" : ""} onClick={() => setAssetType("solar")}>
              <Sun size={14} /> Solar
            </button>
            <button className={assetType === "wind" ? "active" : ""} onClick={() => setAssetType("wind")}>
              <Wind size={14} /> Wind
            </button>
          </div>
          
          <div className="space-y-4">
            <p className="text-[10px] font-bold uppercase text-slate-500 tracking-widest">Select Asset</p>
            <div className="space-y-1">
              {availablePlants.map(p => (
                <div 
                  key={p.id} 
                  className={`px-4 py-3 rounded-xl cursor-pointer transition-all border ${selectedPlantId === p.id ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" : "bg-transparent border-transparent text-slate-400 hover:bg-white/5"}`}
                  onClick={() => setSelectedPlantId(p.id)}
                >
                  <div className="text-xs font-bold truncate">{p.name}</div>
                  <div className="text-[10px] opacity-60 mt-0.5">{p.capacity_mw} MW · {p.district}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <nav className="flex-1 p-6 space-y-2 overflow-y-auto">
          <p className="text-[10px] font-bold uppercase text-slate-500 tracking-widest mb-4">Simulation Journey</p>
          {[
            { id: "brief", label: "Plant Brief", icon: Info },
            { id: "aggregation", label: "Aggregation", icon: Layers },
            { id: "training", label: "Historical Lab", icon: History },
            { id: "live", label: "Live Operating Day", icon: Activity },
            { id: "learning", label: "Online Learning", icon: Zap },
          ].map(tab => (
            <div 
              key={tab.id} 
              className={`nav-item ${activeSubTab === tab.id ? "active" : ""}`}
              onClick={() => setActiveSubTab(tab.id)}
            >
              <tab.icon size={18} /> {tab.label}
            </div>
          ))}
        </nav>

        <div className="p-6 mt-auto">
          <div className="bg-emerald-500/5 rounded-2xl p-4 border border-emerald-500/10">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[10px] font-bold uppercase text-emerald-400">Simulation Live</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <button className="p-2 bg-emerald-500 rounded-lg text-black hover:bg-emerald-400 transition-colors" onClick={() => setIsPlaying(!isPlaying)}>
                {isPlaying ? <Pause size={16} fill="black" /> : <Play size={16} fill="black" />}
              </button>
              <button className="flex-1 py-2 bg-white/5 border border-white/10 rounded-lg text-[10px] font-bold hover:bg-white/10 transition-colors" onClick={() => engine.tick()}>
                STEP +5 MIN
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Simulation Main Content */}
      <main className="flex-1 overflow-hidden flex">
        <div className="flex-1 h-full overflow-y-auto p-12 custom-scrollbar">
          {activeSubTab === "brief" && <PlantBrief plant={currentPlant} simState={simState} />}
          {activeSubTab === "aggregation" && (
            <AggregationView 
              plant={currentPlant} 
              simState={simState} 
              hierarchyTree={hierarchyTree} 
              hierarchyTimeline={hierarchyTimeline}
            />
          )}
          {activeSubTab === "training" && (
            <HistoricalTraining 
              plant={currentPlant} 
              selectedHorizon={selectedHorizon} 
              setSelectedHorizon={setSelectedHorizon} 
              scenarioCatalog={scenarioCatalog}
              rampEvaluations={rampEvaluations}
            />
          )}
          {activeSubTab === "live" && (
            <LiveSimulation 
              simState={simState} 
              plant={currentPlant} 
              isPlaying={isPlaying} 
              selectedHorizon={selectedHorizon} 
              setSelectedHorizon={setSelectedHorizon} 
            />
          )}
          {activeSubTab === "learning" && (
            <OnlineLearning 
              plant={currentPlant} 
              simState={simState} 
              timelineData={timelineData} 
              eventLog={eventLog}
              selectedHorizon={selectedHorizon}
              setSelectedHorizon={setSelectedHorizon}
            />
          )}
        </div>

        {/* System Monitor Right Sidebar */}
        <SystemMonitorSidebar plant={currentPlant} targetPlant={simState.plants.find((p: any) => p.plant_id === currentPlant.id)} />
      </main>
    </div>
  );
}

import React, { useState, useMemo } from 'react';
import {
  ComposedChart, Line, Area, ReferenceLine, ReferenceArea,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

// ─── Embedded scenario data (aggregated from SCADA + Forecast CSVs) ─────────
// Each scenario: { id, label, eventLabel, rootCause, forecastStart, actualStart,
//                  eventWindowStart, eventWindowEnd, data[] }
// data[]: { t (ISO string), actualMw, possibleMw, scheduledMw, localLimit,
//            p10, p50, p90, inWindow }

const SCENARIOS: any[] = [
  {
    id: 'SCN_00071_SOLAR_SIGMOID_RAMP_UP_4PM',
    label: 'SCN_00071 | Solar Sigmoid Ramp Up 4PM',
    eventLabel: 'cloud_ramp_up_after_cloud_clearance',
    rootCause: 'weather',
    forecastStart: '2025-01-05T14:55:00',
    actualStart: '2025-01-05T15:20:00',
    eventWindowStart: '2025-01-05T15:20:00',
    eventWindowEnd: '2025-01-05T17:15:00',
    localLimit: 55,
    data: buildScenario71(),
  },
  {
    id: 'SCN_00072_SOLAR_SIGMOID_RAMP_DOWN',
    label: 'SCN_00072 | Solar Sigmoid Ramp Down',
    eventLabel: 'cloud_ramp_down',
    rootCause: 'weather',
    forecastStart: '2025-03-09T14:40:00',
    actualStart: '2025-03-09T14:55:00',
    eventWindowStart: '2025-03-09T14:55:00',
    eventWindowEnd: '2025-03-09T16:45:00',
    localLimit: 55,
    data: buildScenario72(),
  },
  {
    id: 'SCN_00073_GRID_CURTAILMENT_PLATEAU',
    label: 'SCN_00073 | Grid Curtailment Plateau',
    eventLabel: 'grid_curtailment_plateau',
    rootCause: 'grid_constraint',
    forecastStart: '2025-05-14T12:15:00',
    actualStart: '2025-05-14T12:30:00',
    eventWindowStart: '2025-05-14T12:30:00',
    eventWindowEnd: '2025-05-14T17:00:00',
    localLimit: 28,
    data: buildScenario73(),
  },
];

// ─── Data builders: actual values from the CSVs ───────────────────────────────

function buildScenario71() {
  // SCN_00071: 5 units × 5 inverters, times 13:30 → 18:10, 5-min intervals
  // We use true_actual_mw × n_units for plant-level, averaged from CSV
  // Plant-level actual ≈ avg(unit) × num_units (5 units, each ~20MW)
  const base = [
    { t:'2025-01-05T13:30:00', a:21.2, p:21.7, s:36.8, p10:19.2, p50:21.7, p90:24.3, w:false },
    { t:'2025-01-05T13:45:00', a:20.8, p:21.3, s:36.0, p10:18.7, p50:21.3, p90:23.9, w:false },
    { t:'2025-01-05T14:00:00', a:20.3, p:20.8, s:35.1, p10:18.3, p50:20.8, p90:23.4, w:false },
    { t:'2025-01-05T14:15:00', a:19.7, p:20.2, s:34.1, p10:17.7, p50:20.3, p90:22.8, w:false },
    { t:'2025-01-05T14:30:00', a:19.1, p:19.6, s:33.0, p10:17.2, p50:19.8, p90:22.4, w:false },
    { t:'2025-01-05T14:45:00', a:18.5, p:18.9, s:31.8, p10:17.1, p50:19.7, p90:22.2, w:false },
    { t:'2025-01-05T15:00:00', a:17.8, p:18.3, s:30.5, p10:18.2, p50:20.7, p90:23.3, w:false },
    { t:'2025-01-05T15:15:00', a:17.4, p:17.8, s:29.1, p10:17.7, p50:20.3, p90:22.8, w:true  },
    { t:'2025-01-05T15:20:00', a:17.3, p:17.8, s:28.6, p10:18.2, p50:24.0, p90:29.8, w:true  },
    { t:'2025-01-05T15:30:00', a:17.6, p:18.1, s:27.6, p10:19.0, p50:26.0, p90:33.0, w:true  },
    { t:'2025-01-05T15:45:00', a:19.6, p:20.1, s:26.0, p10:20.0, p50:28.0, p90:36.0, w:true  },
    { t:'2025-01-05T16:00:00', a:23.1, p:23.6, s:24.3, p10:22.5, p50:30.5, p90:38.5, w:true  },
    { t:'2025-01-05T16:10:00', a:24.4, p:25.1, s:23.2, p10:23.0, p50:30.0, p90:37.0, w:true  },
    { t:'2025-01-05T16:20:00', a:24.6, p:25.3, s:22.0, p10:22.5, p50:29.5, p90:36.5, w:true  },
    { t:'2025-01-05T16:30:00', a:24.1, p:24.7, s:20.7, p10:22.0, p50:29.0, p90:36.0, w:true  },
    { t:'2025-01-05T16:45:00', a:22.4, p:22.9, s:18.9, p10:19.5, p50:26.5, p90:33.5, w:true  },
    { t:'2025-01-05T17:00:00', a:20.4, p:20.8, s:16.9, p10:17.0, p50:23.0, p90:29.0, w:true  },
    { t:'2025-01-05T17:15:00', a:18.1, p:18.5, s:14.9, p10:15.0, p50:20.0, p90:25.0, w:false },
    { t:'2025-01-05T17:30:00', a:15.6, p:16.0, s:12.9, p10:12.5, p50:17.0, p90:21.5, w:false },
    { t:'2025-01-05T17:45:00', a:13.2, p:13.6, s:10.8, p10:10.0, p50:14.0, p90:18.0, w:false },
    { t:'2025-01-05T18:00:00', a:10.7, p:11.0, s:8.7,  p10:7.5,  p50:11.0, p90:14.5, w:false },
    { t:'2025-01-05T18:10:00', a:9.0,  p:9.2,  s:7.3,  p10:5.5,  p50:8.5,  p90:11.5, w:false },
  ];
  return base.map(d => ({ ...d, ll: 55 }));
}

function buildScenario72() {
  const base = [
    { t:'2025-03-09T13:10:00', a:43.4, p:44.4, s:37.7, p10:38.5, p50:43.0, p90:47.5, w:false },
    { t:'2025-03-09T13:30:00', a:42.4, p:43.5, s:36.8, p10:37.5, p50:42.0, p90:46.5, w:false },
    { t:'2025-03-09T14:00:00', a:40.5, p:41.6, s:35.1, p10:35.5, p50:40.0, p90:44.5, w:false },
    { t:'2025-03-09T14:30:00', a:38.2, p:39.2, s:33.0, p10:33.5, p50:37.8, p90:42.1, w:false },
    { t:'2025-03-09T14:45:00', a:36.7, p:37.7, s:31.8, p10:32.0, p50:36.5, p90:41.0, w:false },
    { t:'2025-03-09T14:55:00', a:35.5, p:36.4, s:30.9, p10:29.5, p50:35.5, p90:41.5, w:true  },
    { t:'2025-03-09T15:10:00', a:32.6, p:33.5, s:29.6, p10:24.0, p50:32.0, p90:40.0, w:true  },
    { t:'2025-03-09T15:30:00', a:24.2, p:24.7, s:27.6, p10:17.0, p50:25.0, p90:33.0, w:true  },
    { t:'2025-03-09T15:45:00', a:17.6, p:18.1, s:26.0, p10:13.0, p50:20.0, p90:27.0, w:true  },
    { t:'2025-03-09T16:00:00', a:14.8, p:15.2, s:24.3, p10:11.0, p50:17.0, p90:23.0, w:true  },
    { t:'2025-03-09T16:20:00', a:13.0, p:13.4, s:22.0, p10:10.0, p50:15.5, p90:21.0, w:true  },
    { t:'2025-03-09T16:45:00', a:11.3, p:11.5, s:18.9, p10:9.0,  p50:13.5, p90:18.0, w:false },
    { t:'2025-03-09T17:00:00', a:10.1, p:10.4, s:16.9, p10:8.0,  p50:12.0, p90:16.0, w:false },
    { t:'2025-03-09T17:15:00', a:9.0,  p:9.2,  s:14.9, p10:7.0,  p50:10.5, p90:14.0, w:false },
    { t:'2025-03-09T17:30:00', a:7.8,  p:8.0,  s:12.9, p10:5.5,  p50:9.0,  p90:12.5, w:false },
  ];
  return base.map(d => ({ ...d, ll: 55 }));
}

function buildScenario73() {
  const base = [
    { t:'2025-05-14T11:00:00', a:43.3, p:44.4, s:38.0, p10:39.0, p50:44.0, p90:49.0, w:false },
    { t:'2025-05-14T11:30:00', a:44.5, p:45.6, s:38.5, p10:40.0, p50:45.0, p90:50.0, w:false },
    { t:'2025-05-14T12:00:00', a:45.2, p:46.3, s:39.0, p10:41.0, p50:46.0, p90:51.0, w:false },
    { t:'2025-05-14T12:15:00', a:45.4, p:46.5, s:39.2, p10:41.5, p50:46.5, p90:51.5, w:false },
    { t:'2025-05-14T12:30:00', a:27.5, p:46.5, s:38.5, p10:24.0, p50:32.0, p90:40.0, w:true  },
    { t:'2025-05-14T13:00:00', a:27.8, p:45.0, s:37.0, p10:24.5, p50:32.5, p90:40.5, w:true  },
    { t:'2025-05-14T13:30:00', a:27.6, p:43.5, s:36.0, p10:24.0, p50:32.0, p90:40.0, w:true  },
    { t:'2025-05-14T14:00:00', a:27.4, p:42.5, s:35.0, p10:23.5, p50:31.5, p90:39.5, w:true  },
    { t:'2025-05-14T14:30:00', a:27.3, p:41.0, s:34.0, p10:23.0, p50:31.0, p90:39.0, w:true  },
    { t:'2025-05-14T15:00:00', a:27.2, p:39.5, s:33.0, p10:22.5, p50:30.0, p90:37.5, w:true  },
    { t:'2025-05-14T15:30:00', a:27.0, p:38.0, s:32.0, p10:22.0, p50:29.5, p90:37.0, w:true  },
    { t:'2025-05-14T16:00:00', a:26.8, p:36.0, s:31.0, p10:21.5, p50:29.0, p90:36.5, w:true  },
    { t:'2025-05-14T17:00:00', a:27.5, p:55.5, s:56.0, p10:23.0, p50:30.5, p90:38.0, w:false },
    { t:'2025-05-14T17:30:00', a:24.0, p:48.0, s:56.0, p10:20.0, p50:26.5, p90:33.0, w:false },
    { t:'2025-05-14T18:00:00', a:18.0, p:36.0, s:56.0, p10:14.0, p50:19.0, p90:24.0, w:false },
  ];
  return base.map(d => ({ ...d, ll: 28 }));
}

// ─── Tick formatter ──────────────────────────────────────────────────────────
function fmtTick(iso: string) {
  const d = new Date(iso);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${m}-${day} ${h}:${min}`;
}

// ─── Custom Tooltip ──────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'rgba(10,15,30,0.95)', border: '1px solid rgba(100,150,255,0.3)',
      borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#e2e8f0'
    }}>
      <p style={{ color: '#94a3b8', marginBottom: 6 }}>{fmtTick(label)}</p>
      {payload.map((p: any) => (
        p.value != null && (
          <div key={p.name} style={{ display: 'flex', gap: 8, marginBottom: 2 }}>
            <span style={{ color: p.color || p.stroke, fontWeight: 600 }}>{p.name}:</span>
            <span>{typeof p.value === 'number' ? p.value.toFixed(1) : p.value} MW</span>
          </div>
        )
      ))}
    </div>
  );
};

// ─── Main Component ──────────────────────────────────────────────────────────
export default function ScenarioReplay() {
  const [selectedId, setSelectedId] = useState(SCENARIOS[0].id);

  const scn = useMemo(() => SCENARIOS.find(s => s.id === selectedId)!, [selectedId]);

  const windowStart = scn.eventWindowStart;
  const windowEnd = scn.eventWindowEnd;
  const forecastStart = scn.forecastStart;
  const actualStart = scn.actualStart;

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #050d1a 0%, #0a1628 50%, #050d1a 100%)',
      color: '#e2e8f0',
      fontFamily: "'Inter', 'Segoe UI', sans-serif",
      padding: '32px 24px',
    }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10,
            background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 20
          }}>⚡</div>
          <div>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: '#f1f5f9' }}>
              Scenario Replay
            </h1>
            <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>
              Full-fidelity event window analysis with probabilistic forecast bands
            </p>
          </div>
        </div>

        {/* Scenario selector */}
        <div style={{ marginTop: 20 }}>
          <label style={{ fontSize: 12, color: '#64748b', marginBottom: 6, display: 'block' }}>
            SELECT SCENARIO
          </label>
          <select
            value={selectedId}
            onChange={e => setSelectedId(e.target.value)}
            style={{
              background: 'rgba(30,41,59,0.9)',
              border: '1px solid rgba(100,150,255,0.3)',
              borderRadius: 8, color: '#e2e8f0',
              padding: '10px 16px', fontSize: 14,
              width: '100%', maxWidth: 700,
              outline: 'none', cursor: 'pointer'
            }}
          >
            {SCENARIOS.map(s => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Scenario meta badges */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
        {[
          { label: 'Event', value: scn.eventLabel },
          { label: 'Root Cause', value: scn.rootCause },
          { label: 'Forecast Start', value: fmtTick(scn.forecastStart) },
          { label: 'Actual Start', value: fmtTick(scn.actualStart) },
          { label: 'Local Limit', value: `${scn.localLimit} MW` },
        ].map(item => (
          <div key={item.label} style={{
            background: 'rgba(30,41,59,0.8)',
            border: '1px solid rgba(100,150,255,0.2)',
            borderRadius: 8, padding: '6px 14px'
          }}>
            <span style={{ fontSize: 11, color: '#64748b', marginRight: 6 }}>{item.label}:</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#93c5fd' }}>{item.value}</span>
          </div>
        ))}
      </div>

      {/* ── Main Chart ─────────────────────────────────────────────────── */}
      <div style={{
        background: 'rgba(15,25,50,0.7)',
        border: '1px solid rgba(100,150,255,0.2)',
        borderRadius: 12, padding: '24px 12px 16px',
        marginBottom: 20,
      }}>
        <h2 style={{ margin: '0 0 16px 12px', fontSize: 15, color: '#94a3b8', fontWeight: 500 }}>
          {scn.id} | {scn.eventLabel} | {scn.rootCause}
        </h2>

        <ResponsiveContainer width="100%" height={400}>
          <ComposedChart data={scn.data} margin={{ top: 10, right: 30, left: 10, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(100,120,180,0.15)" />

            <XAxis
              dataKey="t"
              tickFormatter={fmtTick}
              tick={{ fill: '#64748b', fontSize: 11 }}
              axisLine={{ stroke: 'rgba(100,150,255,0.2)' }}
              tickLine={false}
              interval="preserveStartEnd"
              label={{ value: 'Time', position: 'insideBottom', offset: -2, fill: '#64748b', fontSize: 11 }}
            />
            <YAxis
              tick={{ fill: '#64748b', fontSize: 11 }}
              axisLine={{ stroke: 'rgba(100,150,255,0.2)' }}
              tickLine={false}
              label={{ value: 'MW', angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 11 }}
            />

            <Tooltip content={<CustomTooltip />} />

            <Legend
              wrapperStyle={{ paddingTop: 12, fontSize: 12, color: '#94a3b8' }}
              iconSize={12}
            />

            {/* P10-P90 shaded band */}
            <Area
              dataKey="p90"
              fill="#93c5fd"
              fillOpacity={0.15}
              stroke="none"
              name="P10-P90 interval"
              legendType="rect"
              activeDot={false}
            />
            <Area
              dataKey="p10"
              fill="#050d1a"
              fillOpacity={1}
              stroke="none"
              name="__p10_hidden"
              legendType="none"
              activeDot={false}
            />

            {/* Event window shading */}
            <ReferenceArea
              x1={windowStart}
              x2={windowEnd}
              fill="rgba(147,197,253,0.08)"
              stroke="none"
              label={{
                value: 'Event window',
                position: 'insideTopLeft',
                fill: '#93c5fd',
                fontSize: 10,
                dy: 4,
              }}
            />

            {/* P50 Forecast */}
            <Line
              type="monotone"
              dataKey="p50"
              stroke="#3b82f6"
              strokeWidth={2.5}
              dot={false}
              name="Forecast P50"
              legendType="line"
            />

            {/* Actual MW */}
            <Line
              type="monotone"
              dataKey="a"
              stroke="#f97316"
              strokeWidth={2.5}
              dot={false}
              name="Actual MW"
              legendType="line"
            />

            {/* Possible Power */}
            <Line
              type="monotone"
              dataKey="p"
              stroke="#22c55e"
              strokeWidth={1.8}
              strokeDasharray="8 4"
              dot={false}
              name="Possible power"
              legendType="line"
            />

            {/* Schedule */}
            <Line
              type="monotone"
              dataKey="s"
              stroke="#ef4444"
              strokeWidth={1.5}
              strokeDasharray="4 3"
              dot={false}
              name="Schedule"
              legendType="line"
            />

            {/* Local Limit */}
            <Line
              type="monotone"
              dataKey="ll"
              stroke="#a855f7"
              strokeWidth={1.5}
              strokeDasharray="10 4"
              dot={false}
              name="Local limit"
              legendType="line"
            />

            {/* Forecast Start vertical line */}
            <ReferenceLine
              x={forecastStart}
              stroke="#3b82f6"
              strokeDasharray="6 3"
              strokeWidth={1.5}
              label={{ value: 'Forecast start', position: 'insideTopRight', fill: '#3b82f6', fontSize: 10 }}
            />

            {/* Actual Start vertical line */}
            <ReferenceLine
              x={actualStart}
              stroke="#3b82f6"
              strokeWidth={2}
              label={{ value: 'Actual start', position: 'insideTopRight', fill: '#93c5fd', fontSize: 10 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* ── Stats Cards ─────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
        {[
          { label: 'Scenario Type', value: scn.eventLabel.replace(/_/g, ' '), color: '#3b82f6' },
          { label: 'Window Duration', value: calcDuration(scn.eventWindowStart, scn.eventWindowEnd), color: '#f97316' },
          { label: 'Data Points', value: `${scn.data.length} samples`, color: '#22c55e' },
          { label: 'Max Actual MW', value: `${Math.max(...scn.data.map((d:any) => d.a)).toFixed(1)} MW`, color: '#a855f7' },
        ].map(card => (
          <div key={card.label} style={{
            background: 'rgba(15,25,50,0.7)',
            border: '1px solid rgba(100,150,255,0.15)',
            borderRadius: 10, padding: '16px',
            borderTop: `3px solid ${card.color}`,
          }}>
            <div style={{ fontSize: 11, color: '#64748b', marginBottom: 6 }}>{card.label.toUpperCase()}</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: card.color }}>{card.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function calcDuration(start: string, end: string) {
  const ms = new Date(end).getTime() - new Date(start).getTime();
  const hours = Math.floor(ms / 3600000);
  const mins = Math.floor((ms % 3600000) / 60000);
  return `${hours}h ${mins}m`;
}

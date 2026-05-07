import { EventLabel } from "../data/schemas";

const solarEventTypes = [
  "moving_cloud_band",
  "sudden_cloud_ramp_down",
  "inverter_outage",
  "local_grid_curtailment",
  "SCADA_stale_signal"
];

const windEventTypes = [
  "wind_ramp_down",
  "wind_ramp_up",
  "low_wind_lull",
  "turbine_outage",
  "local_grid_curtailment"
];

let eventIdCounter = 1;

export function generateSolarEvents(asset_id: string, timeStr: string): EventLabel | null {
  // Return random event
  const type = solarEventTypes[Math.floor(Math.random() * solarEventTypes.length)];
  let severity: "LOW"|"MEDIUM"|"HIGH"|"CRITICAL" = "MEDIUM";
  let rootCause: "WEATHER"|"EQUIPMENT"|"GRID_CONSTRAINT"|"DATA_QUALITY" = "WEATHER";
  
  if (type === "inverter_outage") { rootCause = "EQUIPMENT"; severity = "HIGH"; }
  if (type === "local_grid_curtailment") { rootCause = "GRID_CONSTRAINT"; severity = "MEDIUM"; }
  if (type === "SCADA_stale_signal") { rootCause = "DATA_QUALITY"; severity = "LOW"; }

  return {
    event_id: `EVT-${eventIdCounter++}`,
    asset_id,
    event_type: type,
    start_time: timeStr,
    end_time: new Date(new Date(timeStr).getTime() + 60*60*1000).toISOString(),
    severity,
    root_cause: rootCause,
    expected_impact_mw: 50,
    confirmed: true
  };
}

export function generateWindEvents(asset_id: string, timeStr: string): EventLabel | null {
  const type = windEventTypes[Math.floor(Math.random() * windEventTypes.length)];
  let severity: "LOW"|"MEDIUM"|"HIGH"|"CRITICAL" = "MEDIUM";
  let rootCause: "WEATHER"|"EQUIPMENT"|"GRID_CONSTRAINT"|"DATA_QUALITY" = "WEATHER";

  if (type === "turbine_outage") { rootCause = "EQUIPMENT"; severity = "HIGH"; }
  if (type === "local_grid_curtailment") { rootCause = "GRID_CONSTRAINT"; severity = "MEDIUM"; }

  return {
    event_id: `EVT-${eventIdCounter++}`,
    asset_id,
    event_type: type,
    start_time: timeStr,
    end_time: new Date(new Date(timeStr).getTime() + 120*60*1000).toISOString(),
    severity,
    root_cause: rootCause,
    expected_impact_mw: 30,
    confirmed: true
  };
}

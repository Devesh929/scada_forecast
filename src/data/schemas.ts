export type AssetType = "SOLAR_PLANT" | "SOLAR_CLUSTER" | "WIND_FARM" | "WIND_CLUSTER";

export interface AssetMaster {
  asset_id: string;
  asset_name: string;
  type: AssetType;
  district: string;
  capacity_mw: number;
  latitude: number;
  longitude: number;
  hierarchy?: any;
}

export interface ScadaMeasurement {
  timestamp: string;
  asset_id: string;
  actual_mw: number;
  local_limit_mw: number | null;
  control_setpoint_mw: number | null;
  curtailment_flag: boolean;
  quality_flag: "GOOD" | "STALE" | "MISSING" | "NOISY";
}

export interface MetObservation {
  timestamp: string;
  asset_id: string;
  ghi_wm2?: number;
  poa_irradiance_wm2?: number;
  module_temperature_c?: number;
  ambient_temperature_c?: number;
  wind_speed_ms?: number;
  wind_direction_deg?: number;
  air_density?: number;
  cloud_cover_pct?: number;
}

export interface NWPForecast {
  issue_time: string;
  valid_time: string;
  asset_id: string;
  horizon_minutes: number;
  ghi_wm2?: number;
  wind_speed_ms?: number;
  cloud_cover_pct?: number;
}

export interface AvailabilitySchedule {
  timestamp: string;
  asset_id: string;
  available_capacity_mw: number;
  outage_type: "PLANNED" | "UNPLANNED" | "NONE";
}

export interface ForecastOutput {
  issue_time: string;
  valid_time: string;
  asset_id: string;
  horizon_minutes: number;
  model_id: string;
  forecast_p10_mw: number;
  forecast_p50_mw: number;
  forecast_p90_mw: number;
}

export interface ForecastEvaluation {
  forecast_issue_time: string;
  valid_time: string;
  asset_id: string;
  horizon_minutes: number;
  model_id: string;
  forecast_p50_mw: number;
  actual_mw: number;
  error_mw: number;
  abs_error_mw: number;
  squared_error: number;
  inside_p10_p90: boolean;
}

export interface Alert {
  alert_id: string;
  timestamp: string;
  asset_id: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  alert_type: string;
  message: string;
}

export interface EventLabel {
  event_id: string;
  asset_id: string;
  event_type: string;
  start_time: string;
  end_time: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  root_cause: "WEATHER" | "EQUIPMENT" | "GRID_CONSTRAINT" | "DATA_QUALITY";
  expected_impact_mw: number;
  confirmed: boolean;
}

export interface ModelRegistryEntry {
  model_id: string;
  model_family: string;
  asset_type: "SOLAR" | "WIND" | "PORTFOLIO";
  horizon: string;
  description: string;
  status: "CHAMPION" | "CHALLENGER" | "RETIRED";
}

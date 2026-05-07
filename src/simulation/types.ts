// ─── Asset types ────────────────────────────────────────────────────────────

export interface Plant {
  id: string;
  name: string;
  district: string;
  capacity_mw: number;
  type: "solar_park" | "cluster" | "wind_cluster" | "wind_farm";
  lat: number;
  lon: number;
  technology: "solar" | "wind";
  hierarchy?: {
    segments: number;
    blocks_per_segment: number;
    block_capacity_mw: number;
  };
  wind_config?: {
    farms: number;
    turbines_per_farm: number;
    turbine_mw: number;
    hub_height_m: number;
    cut_in_ms: number;
    rated_ms: number;
    cut_out_ms: number;
  };
}

// ─── SCADA quality ───────────────────────────────────────────────────────────

export type ScadaQualityFlag =
  | "GOOD"
  | "MISSING"
  | "STALE"
  | "SUSPECT"
  | "OUT_OF_RANGE"
  | "LATENCY_HIGH"
  | "SENSOR_DRIFT"
  | "FLATLINE"
  | "INCONSISTENT";

// ─── Curtailment ─────────────────────────────────────────────────────────────

export type CurtailmentStatus =
  | "CONFIRMED"
  | "SUSPECTED"
  | "NOT_DETECTED"
  | "INSUFFICIENT_DATA";

// ─── Scenario types ───────────────────────────────────────────────────────────

export type ScenarioType =
  | "clear_sky"
  | "moving_cloud"
  | "sudden_cloud_ramp"
  | "inverter_outage"
  | "grid_curtailment"
  | "scada_stuck"
  | "sensor_drift"
  | "wind_ramp_down"
  | "turbine_outage"
  | "high_turbulence";

// ─── Solar records ────────────────────────────────────────────────────────────

export interface PlantRecord {
  timestamp: string;
  plant_id: string;
  plant_name: string;
  district: string;
  capacity_mw: number;
  technology: "solar" | "wind";
  lat: number;
  lon: number;
  actual_mw: number;
  possible_power_mw: number;
  forecast_p10_mw: number;
  forecast_p50_mw: number;
  forecast_p90_mw: number;
  scheduled_mw: number;
  deviation_mw: number;
  deviation_pct: number;
  ramp_rate_mw_per_15min: number;
  irradiance_wm2: number;
  poa_irradiance_wm2: number;
  module_temperature_c: number;
  ambient_temperature_c: number;
  wind_speed_ms: number;
  cloud_cover_pct: number;
  inverter_availability_pct: number;
  turbine_availability_pct: number;
  grid_availability_pct: number;
  local_limit_mw: number;
  curtailment_flag: boolean;
  curtailment_status: CurtailmentStatus;
  outage_flag: boolean;
  scada_quality_score: number;
  data_quality_flag: ScadaQualityFlag;
  forecast_confidence: number;
  ramp_risk: "LOW" | "MEDIUM" | "HIGH";
  deviation_risk: "LOW" | "MEDIUM" | "HIGH";
  root_cause: string;
}

export interface BlockRecord {
  timestamp: string;
  park_id: string;
  segment_id: string;
  block_id: string;
  capacity_mw: number;
  actual_mw: number;
  dc_power_mw: number;
  ac_power_mw: number;
  expected_mw: number;
  possible_power_mw: number;
  forecast_p10_mw: number;
  forecast_p50_mw: number;
  forecast_p90_mw: number;
  scheduled_mw: number;
  deviation_mw: number;
  poa_irradiance_wm2: number;
  ghi_wm2: number;
  module_temperature_c: number;
  ambient_temperature_c: number;
  inverter_available: number;
  inverter_total: number;
  inverter_availability_pct: number;
  control_setpoint_mw: number;
  local_limit_mw: number;
  possible_power_with_no_limit_mw: number;
  curtailment_flag: boolean;
  curtailment_status: CurtailmentStatus;
  grid_outage_flag: boolean;
  breaker_status: "CLOSED" | "OPEN" | "FAULT";
  transformer_status: "NORMAL" | "OVERLOAD" | "FAULT";
  alarm_count: number;
  scada_quality_flag: ScadaQualityFlag;
  underperformance_score: number;
  likely_cause: string;
}

// ─── Wind records ─────────────────────────────────────────────────────────────

export interface WindFarmRecord {
  timestamp: string;
  cluster_id: string;
  farm_id: string;
  farm_name: string;
  capacity_mw: number;
  actual_mw: number;
  possible_power_mw: number;
  forecast_p10_mw: number;
  forecast_p50_mw: number;
  forecast_p90_mw: number;
  scheduled_mw: number;
  deviation_mw: number;
  hub_wind_speed_ms: number;
  wind_direction_deg: number;
  air_density_kg_m3: number;
  turbulence_intensity: number;
  wake_loss_pct: number;
  turbine_available: number;
  turbine_total: number;
  turbine_availability_pct: number;
  local_limit_mw: number;
  curtailment_flag: boolean;
  curtailment_status: CurtailmentStatus;
  scada_quality_flag: ScadaQualityFlag;
  ramp_risk: "LOW" | "MEDIUM" | "HIGH";
  likely_cause: string;
}

// ─── Forecast record (multi-horizon) ─────────────────────────────────────────

export type ForecastHorizon = "5min" | "2hour" | "40hour" | "8day";

export interface ForecastPoint {
  offset_min: number;
  p10: number;
  p50: number;
  p90: number;
  scheduled: number;
  actual?: number;
}

export interface HorizonForecast {
  horizon: ForecastHorizon;
  asset_id: string;
  issue_time: string;
  model_id: string;
  confidence: number;
  nMAE_pct: number;
  coverage_pct: number;
  uncertainty_reason: string[];
  points: ForecastPoint[];
}

// ─── Alert record ─────────────────────────────────────────────────────────────

export type AlertSeverity = "CRITICAL" | "WARNING" | "INFO";
export type AlertType =
  | "CLOUD_RAMP_WARNING"
  | "WIND_RAMP_WARNING"
  | "HIGH_DEVIATION_RISK"
  | "CURTAILMENT_CONFIRMED"
  | "CURTAILMENT_SUSPECTED"
  | "INVERTER_UNDERPERFORMANCE"
  | "TURBINE_AVAILABILITY_ISSUE"
  | "SCADA_STALE_SIGNAL"
  | "SCADA_MISSING_DATA"
  | "LOCAL_LIMIT_ACTIVE"
  | "FORECAST_CONFIDENCE_DEGRADED"
  | "SENSOR_MISMATCH"
  | "TRANSFORMER_BREAKER_ISSUE";

export interface AlertRecord {
  id: string;
  time: string;
  severity: AlertSeverity;
  plant: string;
  technology: "solar" | "wind";
  segment?: string;
  block?: string;
  alert_type: AlertType;
  likely_cause: string;
  impact_mw: number;
  confidence: number;
  recommended_action: string;
  status: "ACTIVE" | "ACKNOWLEDGED" | "RESOLVED";
  curtailment_status?: CurtailmentStatus;
}

// ─── Evaluation record ────────────────────────────────────────────────────────

export interface EvaluationRecord {
  model_id: string;
  model_name: string;
  asset_type: "solar" | "wind" | "portfolio";
  horizon: ForecastHorizon;
  nMAE_pct: number;
  rmse_mw: number;
  bias_mw: number;
  coverage_pct: number;
  ramp_hit_rate: number;
  curtailment_precision: number;
  forecast_skill_vs_persistence: number;
}

// ─── Model registry ───────────────────────────────────────────────────────────

export interface ModelRegistryEntry {
  model_id: string;
  model_name: string;
  asset_type: "solar" | "wind";
  horizon: ForecastHorizon;
  requires_met_data: boolean;
  requires_nwp: boolean;
  requires_availability: boolean;
  requires_local_limit: boolean;
  requires_advanced_sensor: boolean;
  status: "CHAMPION" | "CHALLENGER" | "EXPERIMENTAL" | "RETIRED";
  last_trained: string;
  last_evaluated: string;
  nMAE: number;
  champion_flag: boolean;
}

// ─── Data readiness ───────────────────────────────────────────────────────────

export type DataTier = "Tier 0" | "Tier 1" | "Tier 2" | "Tier 3" | "Tier 4";

export interface ReadinessField {
  field: string;
  available: boolean;
  quality: ScadaQualityFlag;
  impact: string;
}

export interface PlantReadiness {
  plant_id: string;
  plant_name: string;
  tier: DataTier;
  readiness_score: number;
  fields: ReadinessField[];
  enabled_forecasts: ForecastHorizon[];
  disabled_forecasts: ForecastHorizon[];
  missing_fields: string[];
  recommended_actions: string[];
}

// ─── Onboarding ───────────────────────────────────────────────────────────────

export interface OnboardingProject {
  id: string;
  plant_name: string;
  technology: "solar" | "wind" | "hybrid";
  capacity_mw: number;
  location: string;
  data_tier: DataTier;
  readiness_score: number;
  recommended_models: string[];
  missing_fields: string[];
  data_contract_lines: string[];
  forecast_objective: string;
}

import { 
  SOLAR_PAVAGADA_MASTER, 
  WND_GADAG_MASTER, 
  UNIT_MASTER_PAVAGADA, 
  UNIT_MASTER_GADAG, 
  SENSOR_INVENTORY 
} from "./asset_metadata";

/**
 * Robust Data Pack for SuryaGrid AI Simulation
 * Consolidates metadata, validation metrics, and scenario replay samples.
 */

export const ASSET_MASTER = [
  SOLAR_PAVAGADA_MASTER,
  WND_GADAG_MASTER,
];

export const UNIT_MASTER = {
  SOL_PAVAGADA: UNIT_MASTER_PAVAGADA,
  WND_GADAG: UNIT_MASTER_GADAG,
};

export const SENSORS = SENSOR_INVENTORY;

export const VALIDATION_LAB_DATA: Record<string, any> = {
  SOL_PAVAGADA: {
    metrics: { nmae: "3.2%", rmse: "90.5 MW", bias: "6.0 MW", coverage: "89.0%", ramp_hit: "81.8%" },
    reliability: [
      { prob: 0, obs: 0 }, { prob: 0.1, obs: 0.08 }, { prob: 0.2, obs: 0.18 }, 
      { prob: 0.3, obs: 0.32 }, { prob: 0.4, obs: 0.42 }, { prob: 0.5, obs: 0.48 }, 
      { prob: 0.6, obs: 0.58 }, { prob: 0.7, obs: 0.72 }, { prob: 0.8, obs: 0.85 }, 
      { prob: 0.9, obs: 0.92 }, { prob: 1.0, obs: 1.0 }
    ],
    rank: [
      { rank: 1, count: 45 }, { rank: 2, count: 42 }, { rank: 3, count: 44 }, { rank: 4, count: 48 },
      { rank: 5, count: 41 }, { rank: 6, count: 43 }, { rank: 7, count: 46 }, { rank: 8, count: 44 }
    ]
  },
  WND_GADAG: {
    metrics: { nmae: "4.0%", rmse: "23.2 MW", bias: "0.8 MW", coverage: "88.5%", ramp_hit: "81.2%" },
    reliability: [
      { prob: 0, obs: 0 }, { prob: 0.1, obs: 0.12 }, { prob: 0.2, obs: 0.22 }, 
      { prob: 0.3, obs: 0.28 }, { prob: 0.4, obs: 0.38 }, { prob: 0.5, obs: 0.52 }, 
      { prob: 0.6, obs: 0.65 }, { prob: 0.7, obs: 0.68 }, { prob: 0.8, obs: 0.78 }, 
      { prob: 0.9, obs: 0.88 }, { prob: 1.0, obs: 1.0 }
    ],
    rank: [
      { rank: 1, count: 38 }, { rank: 2, count: 52 }, { rank: 3, count: 41 }, { rank: 4, count: 44 },
      { rank: 5, count: 49 }, { rank: 6, count: 42 }, { rank: 7, count: 45 }, { rank: 8, count: 40 }
    ]
  }
};

export const LIVE_REPLAY_SAMPLES = [
  { scenario: "moving_cloud", plant: "SOL_PAVAGADA", time: "15:00", actual: 820.5, forecast: 810.2, comment: "Satellite detect approach of cloud band from NW." },
  { scenario: "moving_cloud", plant: "SOL_PAVAGADA", time: "15:10", actual: 815.2, forecast: 780.5, comment: "Agent predicts onset of ramp-down in T+25m." },
  { scenario: "moving_cloud", plant: "SOL_PAVAGADA", time: "15:20", actual: 750.4, forecast: 710.0, comment: "Ramp detected. Model confidence in S-curve recovery: 92%." },
  { scenario: "moving_cloud", plant: "SOL_PAVAGADA", time: "15:35", actual: 520.1, forecast: 515.5, comment: "Nadir reached. Preparing for sigmoid recovery." },
  { scenario: "moving_cloud", plant: "SOL_PAVAGADA", time: "15:55", actual: 680.2, forecast: 690.4, comment: "Cloud clearance confirmed by sky-imager. Ramping up." },
  { scenario: "moving_cloud", plant: "SOL_PAVAGADA", time: "16:15", actual: 840.5, forecast: 835.0, comment: "Plant returned to clear-sky profile. Accuracy Hit." },

  { scenario: "wind_ramp_down", plant: "WND_GADAG", time: "14:40", actual: 145.2, forecast: 140.5, comment: "Met mast #2 reports turbulence increase at 80m." },
  { scenario: "wind_ramp_down", plant: "WND_GADAG", time: "14:55", actual: 142.1, forecast: 120.2, comment: "Sudden pressure drop detected. Predicted ramp: -25 MW/min." },
  { scenario: "wind_ramp_down", plant: "WND_GADAG", time: "15:10", actual: 95.5, forecast: 92.4, comment: "Ramp in progress. Cut-out speed protection active on SE cluster." },
  { scenario: "wind_ramp_down", plant: "WND_GADAG", time: "15:30", actual: 82.4, forecast: 84.1, comment: "Wind stabilized at 4.2m/s. Monitoring for re-start." },

  { scenario: "grid_curtailment", plant: "SOL_PAVAGADA", time: "12:30", actual: 940.5, forecast: 945.0, possible: 945.0, limit: 1000.0, comment: "Nominal operation. Possible power matches actual." },
  { scenario: "grid_curtailment", plant: "SOL_PAVAGADA", time: "12:45", actual: 720.0, forecast: 720.0, possible: 955.2, limit: 720.0, comment: "SLDC limit 720MW received. Clipping active. Possible power tracking weather." },
  { scenario: "grid_curtailment", plant: "SOL_PAVAGADA", time: "13:30", actual: 720.0, forecast: 720.0, possible: 962.1, limit: 720.0, comment: "Extended curtailment window. Lost generation opportunity: 242 MWh." },

  { scenario: "inverter_outage", plant: "SOL_PAVAGADA", time: "14:55", actual: 845.2, forecast: 850.1, comment: "CB-S3-B2 thermal alert received." },
  { scenario: "inverter_outage", plant: "SOL_PAVAGADA", time: "15:00", actual: 795.2, forecast: 850.5, comment: "Step drop in MW. Unit PAV_S3_B02 offline. Data quality: GOOD." },
];

export const HISTORICAL_CATALOG = [
  { id: "EV-2025-0105", type: "Solar Sigmoid Ramp Up", duration: "115m", loss: "320 MW", result: "HIT", plant: "SOL_PAVAGADA" },
  { id: "EV-2025-0207", type: "Wind Sigmoid Ramp Down", duration: "45m", loss: "58 MW", result: "HIT", plant: "WND_GADAG" },
  { id: "EV-2025-0514", type: "Grid Curtailment Plateau", duration: "4h", loss: "240 MW", result: "HIT", plant: "SOL_PAVAGADA" },
  { id: "EV-2025-0818", type: "SCADA Stale Signal", duration: "1h", loss: "N/A", result: "DETECTED", plant: "SOL_PAVAGADA" },
  { id: "EV-2025-0922", type: "Equipment Derating", duration: "2h", loss: "42 MW", result: "HIT", plant: "WND_GADAG" },
  { id: "EV-0915", plant: "WND_GADAG", type: "Sudden Wind Drop", duration: "45m", loss: "180 MW", result: "HIT" },
  { id: "EV-1002", plant: "SOL_PAVAGADA", type: "Inverter Group Trip", duration: "24h", loss: "50 MW", result: "MISSED" },
];

export const TRAINING_SUMMARY: any[] = [
  { plant: "SOL_PAVAGADA", horizon: "5min", nmae: "3.2%", rmse: "90.5 MW", bias: "6.0 MW", coverage: "89.0%", ramp_hit: "81.8%" },
  { plant: "SOL_PAVAGADA", horizon: "15min", nmae: "4.1%", rmse: "116.0 MW", bias: "1.4 MW", coverage: "88.4%", ramp_hit: "81.1%" },
  { plant: "SOL_PAVAGADA", horizon: "2hour", nmae: "6.8%", rmse: "192.4 MW", bias: "5.6 MW", coverage: "86.7%", ramp_hit: "79.2%" },
  { plant: "SOL_PAVAGADA", horizon: "day_ahead_40hour", nmae: "9.8%", rmse: "277.2 MW", bias: "9.6 MW", coverage: "84.7%", ramp_hit: "77.1%" },
  { plant: "WND_GADAG", horizon: "5min", nmae: "4.0%", rmse: "23.2 MW", bias: "0.8 MW", coverage: "88.5%", ramp_hit: "81.2%" },
  { plant: "WND_GADAG", horizon: "15min", nmae: "4.9%", rmse: "28.4 MW", bias: "1.9 MW", coverage: "87.9%", ramp_hit: "80.6%" },
  { plant: "WND_GADAG", horizon: "2hour", nmae: "7.6%", rmse: "44.1 MW", bias: "-0.2 MW", coverage: "86.1%", ramp_hit: "78.7%" },
  { plant: "WND_GADAG", horizon: "day_ahead_40hour", nmae: "10.6%", rmse: "61.4 MW", bias: "-0.4 MW", coverage: "84.2%", ramp_hit: "76.6%" },
];

export const RAMP_EVALUATION: any[] = [
  { scenario: "moving_cloud", plant: "SOL_PAVAGADA", type: "Cloud Ramp-Up", root: "Weather", offset: 35, amplitude: "320 MW", error: "-0.2 MW", confidence: "86%" },
  { scenario: "solar_ramp_down", plant: "SOL_PAVAGADA", type: "Cloud Ramp-Down", root: "Weather", offset: 25, amplitude: "320 MW", error: "-1.1 MW", confidence: "86%" },
  { scenario: "grid_curtailment", plant: "SOL_PAVAGADA", type: "Grid Plateau", root: "Grid", offset: 15, amplitude: "720 MW", error: "25.5 MW", confidence: "92%" },
  { scenario: "wind_ramp_down", plant: "WND_GADAG", type: "Wind Ramp-Down", root: "Weather", offset: 25, amplitude: "58 MW", error: "4.1 MW", confidence: "86%" },
];

export const ANOMALY_LOG: any[] = [
  { time: "15:20:00", plant: "SOL_PAVAGADA", unit: "PAV_S3_B01", type: "Cloud Ramp-Up", root: "Weather", action: "Prepare reserve" },
  { time: "15:20:00", plant: "SOL_PAVAGADA", unit: "PAV_S3_B02", type: "Cloud Ramp-Up", root: "Weather", action: "Prepare reserve" },
  { time: "12:45:00", plant: "SOL_PAVAGADA", unit: "PAV_S1_B01", type: "Grid Plateau", root: "Grid", action: "Check limit" },
  { time: "14:55:00", plant: "WND_GADAG", unit: "WND_G1_T01", type: "Wind Drop", root: "Weather", action: "Revise schedule" },
];

export const ONLINE_LEARNING_HORIZON_CONFIG: Record<string, any> = {
  "5min": {
    "business_name": "Real-time nowcast / control-room forecast",
    "model_family": "persistence + ramp-rate correction + SCADA quality gate",
    "learning_window": "last 30 minutes",
    "primary_online_metrics": [
      "rolling_nmae_pct",
      "ramp_hit_rate_so_far_pct",
      "lead_time_minutes",
      "phase_error_minutes",
      "scada_quality"
    ],
    "what_learning_means": "The model updates short-term ramp sensitivity and SCADA trust using the newest measurements.",
    "refresh_rule": "If rolling nMAE > 6% OR SCADA quality becomes STALE, reduce confidence and refresh short-term weights.",
    "ui_focus": "Show immediate event learning and whether the next few minutes are safe."
  },
  "15min": {
    "business_name": "Intra-hour dispatch correction",
    "model_family": "persistence + physical blend + residual correction",
    "learning_window": "last 60 minutes",
    "primary_online_metrics": [
      "rolling_nmae_pct",
      "rolling_coverage_pct",
      "ramp_hit_rate_so_far_pct",
      "band_width_mw"
    ],
    "what_learning_means": "The model updates intra-hour residual correction and event probability threshold.",
    "refresh_rule": "If coverage < 80% AND nMAE > 7%, widen interval and update residual correction.",
    "ui_focus": "Show if the current dispatch block needs correction."
  },
  "2hour": {
    "business_name": "Intraday forecast / reserve planning",
    "model_family": "physical weather-to-power + Gaussian residual",
    "learning_window": "last 4 operating hours",
    "primary_online_metrics": [
      "rolling_nmae_pct",
      "rolling_coverage_pct",
      "rolling_bias_mw",
      "band_width_mw"
    ],
    "what_learning_means": "The model learns whether today's weather-to-power residuals are shifted or more volatile than expected.",
    "refresh_rule": "If bias persists for 4 hours OR coverage falls below 75%, recommend residual-weight refresh.",
    "ui_focus": "Show whether reserve/schedule correction is required later today."
  },
  "40hour": {
    "business_name": "Day-ahead probabilistic forecast",
    "model_family": "NWP ensemble weather-to-power + calibration",
    "learning_window": "latest day-ahead issue + realized intraday evidence",
    "primary_online_metrics": [
      "rolling_bias_mw",
      "rolling_coverage_pct",
      "band_width_mw",
      "model_action_code"
    ],
    "what_learning_means": "The model checks if the day-ahead ensemble was biased or under/over-dispersed as actuals arrive.",
    "refresh_rule": "If reliability drift is high or ensemble spread is too narrow, recalibrate day-ahead quantiles overnight.",
    "ui_focus": "Show whether tomorrow's probabilistic schedule needs recalibration."
  },
  "8day": {
    "business_name": "Medium-range planning outlook",
    "model_family": "ensemble scenario + analog days + climatology band",
    "learning_window": "daily realization vs weekly scenario band",
    "primary_online_metrics": [
      "rolling_nmae_pct",
      "rolling_coverage_pct",
      "rolling_bias_mw",
      "model_action_code"
    ],
    "what_learning_means": "The model learns whether the selected weekly weather regime and analog set are still valid.",
    "refresh_rule": "If realized regime diverges from expected regime for 2 consecutive days, refresh analog/regime mapping.",
    "ui_focus": "Show weekly planning risk, not exact 5-minute accuracy."
  }
};

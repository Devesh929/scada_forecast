export interface ProbabilisticInput {
  base_forecast_p50: number;
  mode: "historical_residual" | "gaussian_residual" | "ensemble";
  asset_type: "SOLAR" | "WIND";
  horizon_minutes: number;
  event_active: boolean;
  poor_scada: boolean;
  ensemble_scenarios?: number[];
}

export function generateProbabilisticForecast(input: ProbabilisticInput) {
  let p10 = 0;
  let p90 = 0;

  if (input.mode === "ensemble" && input.ensemble_scenarios && input.ensemble_scenarios.length > 0) {
    const sorted = [...input.ensemble_scenarios].sort((a, b) => a - b);
    const p10_idx = Math.floor(sorted.length * 0.1);
    const p90_idx = Math.floor(sorted.length * 0.9);
    p10 = sorted[p10_idx];
    p90 = sorted[p90_idx];
  } else if (input.mode === "historical_residual") {
    // Mode 1: Historical residual quantiles
    // Using simple mock lookup for residuals
    const base_err = input.asset_type === "SOLAR" ? 0.05 : 0.08;
    const error_pct = input.horizon_minutes > 120 ? base_err * 2 : base_err;
    p10 = input.base_forecast_p50 * (1 - error_pct * 1.5);
    p90 = input.base_forecast_p50 * (1 + error_pct * 1.5);
  } else {
    // Mode 2: Gaussian residual
    let std_err = input.base_forecast_p50 * 0.1;
    if (input.event_active) std_err *= 1.5;
    if (input.poor_scada) std_err *= 1.3;
    
    // P10 = P50 + mean_error - 1.28 * std_error
    // Assuming mean_error = 0 for simplicity
    p10 = input.base_forecast_p50 - 1.28 * std_err;
    p90 = input.base_forecast_p50 + 1.28 * std_err;
  }

  return {
    p10: Math.max(0, p10),
    p50: Math.max(0, input.base_forecast_p50),
    p90: Math.max(0, p90)
  };
}

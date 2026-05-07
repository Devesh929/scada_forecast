import { ForecastEvaluation, ForecastOutput, ScadaMeasurement } from "../data/schemas";

export function evaluateForecasts(
  forecasts: ForecastOutput[],
  actuals: ScadaMeasurement[]
): ForecastEvaluation[] {
  const evals: ForecastEvaluation[] = [];

  // Create a map of actuals by timestamp and asset_id
  const actualMap = new Map<string, number>();
  for (const a of actuals) {
    actualMap.set(`${a.asset_id}_${a.timestamp}`, a.actual_mw);
  }

  for (const f of forecasts) {
    const actual = actualMap.get(`${f.asset_id}_${f.valid_time}`);
    if (actual !== undefined) {
      const error = actual - f.forecast_p50_mw;
      evals.push({
        forecast_issue_time: f.issue_time,
        valid_time: f.valid_time,
        asset_id: f.asset_id,
        horizon_minutes: f.horizon_minutes,
        model_id: f.model_id,
        forecast_p50_mw: f.forecast_p50_mw,
        actual_mw: actual,
        error_mw: error,
        abs_error_mw: Math.abs(error),
        squared_error: error * error,
        inside_p10_p90: actual >= f.forecast_p10_mw && actual <= f.forecast_p90_mw
      });
    }
  }

  return evals;
}

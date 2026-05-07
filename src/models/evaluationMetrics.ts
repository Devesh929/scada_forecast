import { ForecastEvaluation } from "../data/schemas";

export function calculateMetrics(evals: ForecastEvaluation[]) {
  if (evals.length === 0) return null;

  let sum_error = 0;
  let sum_abs_error = 0;
  let sum_squared_error = 0;
  let sum_actual = 0;
  let inside_p10_p90_count = 0;

  for (const e of evals) {
    sum_error += e.error_mw;
    sum_abs_error += e.abs_error_mw;
    sum_squared_error += e.squared_error;
    sum_actual += e.actual_mw;
    if (e.inside_p10_p90) inside_p10_p90_count++;
  }

  const n = evals.length;
  const mae = sum_abs_error / n;
  const bias = sum_error / n;
  const rmse = Math.sqrt(sum_squared_error / n);
  const nMae = sum_actual > 0 ? mae / (sum_actual / n) : 0;
  const coverage = inside_p10_p90_count / n;

  return {
    mae,
    bias,
    rmse,
    nMAE_pct: nMae * 100,
    coverage_pct: coverage * 100
  };
}

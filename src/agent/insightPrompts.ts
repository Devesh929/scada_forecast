import { ForecastOutput, ScadaMeasurement } from "../data/schemas";

export function buildDeviationPrompt(
  assetId: string, 
  forecast: ForecastOutput, 
  actual: ScadaMeasurement, 
  eventActive: boolean
) {
  return `Analyze the deviation for asset ${assetId}.
Forecast P50: ${forecast.forecast_p50_mw} MW
Actual: ${actual.actual_mw} MW
Local Limit: ${actual.local_limit_mw ?? 'None'}
Curtailment Flag: ${actual.curtailment_flag}
SCADA Quality: ${actual.quality_flag}
Known Event Active: ${eventActive}

Provide a 2-sentence operator recommendation explaining why the deviation occurred. Keep it grounded and professional without marketing language.`;
}

export function buildModelCardPrompt(modelId: string, nMAE: number, horizon: number) {
  return `Generate a short model card explanation for forecasting model ${modelId}.
Horizon: ${horizon} minutes.
Historical nMAE: ${nMAE.toFixed(1)}%.
Explain the general mechanism and limitations of such a model in 2-3 sentences.`;
}

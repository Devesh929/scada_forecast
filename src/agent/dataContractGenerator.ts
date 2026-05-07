export function generateDataContract(plantName: string, fields: string[]) {
  return `DATA CONTRACT FOR ${plantName.toUpperCase()}
========================================

Required Fields (15-min frequency, max 5m latency):
- TIMESTAMP (ISO-8601 UTC)
- ACTUAL_MW (Numeric)

Optional Advanced Fields (improves tier and explainability):
- LOCAL_LIMIT_MW (Numeric, for curtailment detection)
- INVERTER_AVAIL_PCT / TURBINE_AVAIL_PCT (Numeric 0-100)
- POA_IRRADIANCE / HUB_WIND_SPEED (Numeric)

Forecast Output Delivery:
- Format: JSON REST API
- Horizon: 5m, 2h, 40h
- Fields: p10_mw, p50_mw, p90_mw, issue_time, valid_time

Quality Rules:
- Values must not exceed plant capacity.
- Missing values will be imputed via persistence up to 2 hours.
`;
}

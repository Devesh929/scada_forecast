export interface ReadinessScore {
  score: number;
  tier: number;
  detected_type: "SOLAR" | "WIND" | "UNKNOWN";
  available_fields: string[];
  missing_fields: string[];
  enabled_modes: string[];
  disabled_modes: string[];
  recommended_metrics: string[];
}

export function evaluateSchemaReadiness(schemaColumns: string[]): ReadinessScore {
  const fields = schemaColumns.map(s => s.toLowerCase());
  const hasSolar = fields.some(f => f.includes('poa') || f.includes('ghi') || f.includes('irradiance'));
  const hasWind = fields.some(f => f.includes('wind_speed') || f.includes('nacelle'));

  const type = hasWind ? "WIND" : hasSolar ? "SOLAR" : "UNKNOWN";

  const criticalFields = ['actual_mw', 'timestamp'];
  const advancedFields = ['local_limit_mw', 'curtailment_flag', 'control_setpoint_mw'];
  
  let score = 50; // base score for having actuals
  let tier = 1;

  const available: string[] = [];
  const missing: string[] = [];
  
  // check critical
  for (const c of criticalFields) {
    if (fields.some(f => f.includes(c))) available.push(c);
    else missing.push(c);
  }

  // check advanced
  for (const a of advancedFields) {
    if (fields.some(f => f.includes(a))) {
      available.push(a);
      score += 15;
    } else {
      missing.push(a);
    }
  }

  if (score > 80) tier = 3;
  else if (score > 60) tier = 2;

  return {
    score: Math.min(100, score),
    tier,
    detected_type: type,
    available_fields: available,
    missing_fields: missing,
    enabled_modes: [
      "5-min persistence forecast",
      tier >= 2 ? "2-hour physical + residual forecast" : "",
      "day-ahead forecast (requires NWP)"
    ].filter(Boolean),
    disabled_modes: [
      missing.includes("curtailment_flag") ? "confirmed curtailment detection" : "",
      type === "SOLAR" && !fields.some(f=>f.includes('sky_camera')) ? "sky-camera nowcast" : ""
    ].filter(Boolean),
    recommended_metrics: ["nMAE", "RMSE", "bias", "P10-P90 coverage", "ramp hit rate"]
  };
}

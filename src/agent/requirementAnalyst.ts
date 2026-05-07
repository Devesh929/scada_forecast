import { askLLM } from "./llmClient";

const SYSTEM_PROMPT = `You are SuryaGrid Forecast Requirement Analyst.

Your job:
Convert a user's renewable-energy forecasting business requirement into a strict JSON forecast-requirement recommendation.

Output rules:
- Return ONLY valid JSON.
- No markdown. No prose.
- Use snake_case keys exactly as defined in the template.

Strict Schema Template:
{
  "request_understanding": {
    "business_goal_plain_language": "string",
    "primary_use_case": "string",
    "detailed_objectives": ["string"]
  },
  "recommended_solution": {
    "solution_type": "string",
    "deterministic_or_probabilistic": "string",
    "architecture_style": "string",
    "required_metrics": [{"metric": "string", "target": "string", "importance": "critical|high|medium"}]
  },
  "horizon_plan": [
    {
      "horizon": "string",
      "business_name": "string",
      "business_use_case": "string",
      "confidence": "high|medium|low",
      "plain_language_explanation": "string",
      "required_variables": [{"variable": "string", "source": "SCADA|MET|NWP|MARKET", "required_status": "required"}]
    }
  ],
  "execution_dag": {
    "nodes": [{"id": "string", "label": "string", "type": "data_ingest|processing|model|output", "description": "string"}],
    "edges": [{"from": "string", "to": "string", "label": "string"}]
  },
  "missing_information": ["string"],
  "data_gap_impact": "string",
  "implementation_steps": ["string"]
}

Allowed business use cases: real_time_ramp_warning, intra_hour_dispatch_correction, intraday_reserve_planning, day_ahead_scheduling, dynamic_reserve_calculation, deviation_penalty_reduction, curtailment_diagnosis, data_quality_monitoring, weekly_planning_outlook, market_revenue_optimization
Allowed horizons: 5min, 15min, 30min, 1hour, 2hour, 4hour, day_ahead_40hour, 8day
Allowed variables: actual_mw, possible_power_mw, scheduled_mw, local_limit_mw, ghi_wm2, poa_wm2, dni_wm2, ambient_temp_c, module_temp_c, cloud_cover_pct, hub_height_wind_speed_ms, wind_direction_deg, nwp_ghi_forecast_wm2, nwp_wind_speed_100m_ms, demand_forecast_mw
`;

export async function analyzeRequirement(userRequest: string, plantName: string, schemaHeader: string) {
  const prompt = `USER_REQUEST:
${userRequest}

PLANT_CONTEXT:
{"plant_name": "${plantName}", "detected_asset_type": "solar_pv_hybrid"}

AVAILABLE_DATA_CATALOG:
{"schema_columns": [${schemaHeader.split(',').map(c => `"${c.trim()}"`).join(', ')}]}

TASK:
Return the forecast requirement recommendation in the exact JSON schema. Do not use markdown.`;

  const response = await askLLM(prompt, SYSTEM_PROMPT);
  
  try {
    const firstBrace = response.indexOf('{');
    const lastBrace = response.lastIndexOf('}');
    if (firstBrace === -1 || lastBrace === -1) throw new Error("No JSON braces");
    
    const jsonString = response.substring(firstBrace, lastBrace + 1);
    const parsed = JSON.parse(jsonString);
    
    return {
      recommended_solution: parsed.recommended_solution || { solution_type: "INTELLIGENT_FORECAST", deterministic_or_probabilistic: "PROBABILISTIC" },
      request_understanding: parsed.request_understanding || { business_goal_plain_language: "Analyzing documents..." },
      horizon_plan: parsed.horizon_plan || [],
      missing_information: parsed.missing_information || [],
      ...parsed
    };
  } catch (e) {
    console.error("LLM Parse Error:", response, e);
    return {
      request_understanding: { business_goal_plain_language: "Error processing the model response." },
      recommended_solution: { solution_type: "ERROR", deterministic_or_probabilistic: "N/A" },
      horizon_plan: [],
      missing_information: ["Parsing Error: The intelligence agent response was not in a valid format."]
    };
  }
}

import { ProbabilisticInput, generateProbabilisticForecast } from "./probabilisticForecast";
import { calculateSolarPower } from "./solarPhysicalModel";
import { calculateWindPower } from "./windPowerCurveModel";

export interface ForecastEngineInput {
  asset_id: string;
  asset_type: "SOLAR" | "WIND";
  capacity_mw: number;
  horizon_minutes: number;
  current_actual_mw: number;
  current_irradiance: number;
  current_wind_speed: number;
  event_active: boolean;
  poor_scada: boolean;
}

export function runForecastEngine(input: ForecastEngineInput) {
  let model_family = "";
  let p50 = 0;
  let uncertainty_mode: ProbabilisticInput["mode"] = "gaussian_residual";
  let ensemble_scenarios: number[] = [];

  // Horizon-wise routing
  if (input.horizon_minutes <= 15) {
    model_family = input.asset_type === "SOLAR" ? "persistence_cloud_motion" : "persistence_upstream_wind";
    // simple persistence for now
    p50 = input.current_actual_mw;
    uncertainty_mode = "gaussian_residual";
  } else if (input.horizon_minutes <= 120) {
    model_family = input.asset_type === "SOLAR" ? "physical_plus_ml_residual" : "power_curve_plus_ml_residual";
    
    if (input.asset_type === "SOLAR") {
       p50 = calculateSolarPower({
         capacity_mw: input.capacity_mw,
         ghi_wm2: input.current_irradiance, // assuming persistence of irradiance
         cloud_cover_pct: 20,
         module_temperature_c: 35,
         inverter_availability_pct: 95,
         local_limit_mw: input.capacity_mw
       }).possible_power_mw;
    } else {
       p50 = calculateWindPower({
         capacity_mw: input.capacity_mw,
         wind_speed_ms: input.current_wind_speed,
         air_density: 1.225,
         turbine_availability_pct: 95,
         local_limit_mw: input.capacity_mw
       }).possible_power_mw;
    }
    uncertainty_mode = "historical_residual";
  } else {
    model_family = "nwp_ensemble";
    uncertainty_mode = "ensemble";
    
    // mock ensemble scenarios
    const base = input.capacity_mw * 0.5;
    for(let i = 0; i < 20; i++) {
       ensemble_scenarios.push(Math.max(0, base + (Math.random() - 0.5) * input.capacity_mw * 0.4));
    }
    
    const sorted = [...ensemble_scenarios].sort((a,b)=>a-b);
    p50 = sorted[Math.floor(sorted.length / 2)];
  }

  const prob = generateProbabilisticForecast({
    base_forecast_p50: p50,
    mode: uncertainty_mode,
    asset_type: input.asset_type,
    horizon_minutes: input.horizon_minutes,
    event_active: input.event_active,
    poor_scada: input.poor_scada,
    ensemble_scenarios
  });

  return {
    model_family,
    ...prob
  };
}

export interface WindPowerInput {
  capacity_mw: number;
  wind_speed_ms: number;
  air_density: number;
  turbine_availability_pct: number;
  local_limit_mw: number;
}

export function calculateWindPower(input: WindPowerInput) {
  const cut_in = 3;
  const rated = 12;
  const cut_out = 25;

  let powerFactor = 0;

  if (input.wind_speed_ms < cut_in) {
    powerFactor = 0;
  } else if (input.wind_speed_ms >= cut_in && input.wind_speed_ms < rated) {
    // Non-linear rise
    powerFactor = Math.pow((input.wind_speed_ms - cut_in) / (rated - cut_in), 3);
  } else if (input.wind_speed_ms >= rated && input.wind_speed_ms < cut_out) {
    powerFactor = 1;
  } else {
    powerFactor = 0;
  }

  // density adjustment
  const density_factor = input.air_density / 1.225;
  powerFactor *= density_factor;

  const availability_factor = input.turbine_availability_pct / 100;
  const possible_power_mw = input.capacity_mw * powerFactor * availability_factor * 0.95; // 0.95 for wake loss

  const actual_mw = Math.min(possible_power_mw, input.local_limit_mw);

  return {
    possible_power_mw,
    actual_mw
  };
}

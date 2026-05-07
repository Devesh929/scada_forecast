export interface SolarPowerInput {
  capacity_mw: number;
  ghi_wm2: number;
  cloud_cover_pct: number;
  module_temperature_c: number;
  inverter_availability_pct: number;
  local_limit_mw: number;
}

export function calculateSolarPower(input: SolarPowerInput) {
  // clear_sky_factor = diurnal solar curve (simplified via GHI here)
  const clear_sky_factor = input.ghi_wm2 / 1000;
  
  // cloud_factor = 1 - cloud_cover_pct * coefficient
  const cloud_factor = Math.max(0.1, 1 - (input.cloud_cover_pct / 100) * 0.7);
  
  // temperature_factor = 1 - max(0, module_temperature_c - 25) * temperature_coefficient
  const temp_derate_c = Math.max(0, input.module_temperature_c - 25);
  const temperature_factor = 1 - (temp_derate_c * 0.004);
  
  // availability_factor = inverter_available_count / inverter_total_count
  const availability_factor = input.inverter_availability_pct / 100;
  
  // possible_power_mw = capacity_mw * clear_sky_factor * cloud_factor * temperature_factor * availability_factor
  const possible_power_mw = input.capacity_mw * clear_sky_factor * cloud_factor * temperature_factor * availability_factor;
  
  // export_power_mw = min(possible_power_mw, local_limit_mw, control_setpoint_mw, available_capacity_mw)
  const actual_mw = Math.min(possible_power_mw, input.local_limit_mw);

  return {
    possible_power_mw,
    actual_mw
  };
}

import { DataGenOptions, MASTER_ASSETS } from "./syntheticConfig";
import { ScadaMeasurement, MetObservation, NWPForecast, AvailabilitySchedule, EventLabel } from "./schemas";
import { generateSolarEvents, generateWindEvents } from "../simulation/eventLibrary";
import { calculateSolarPower } from "../models/solarPhysicalModel";
import { calculateWindPower } from "../models/windPowerCurveModel";

export class SyntheticDatasetGenerator {
  options: DataGenOptions;
  
  constructor(options: DataGenOptions) {
    this.options = options;
  }

  generate() {
    const start = new Date(this.options.startDate).getTime();
    const end = new Date(this.options.endDate).getTime();
    
    // We will generate the datasets iteratively. 
    // To prevent browser freeze in 'full' mode, we could chunk this.
    // For 'sample' mode, we can just generate a few days.
    
    const scadaMeasurements: ScadaMeasurement[] = [];
    const metObservations: MetObservation[] = [];
    const nwpForecasts: NWPForecast[] = [];
    const events: EventLabel[] = [];

    // Simple deterministic random
    let seed = 42;
    const rnd = () => {
      const x = Math.sin(seed++) * 10000;
      return x - Math.floor(x);
    };

    // Calculate how many steps
    const solarIntervalMs = this.options.intervalMinutesSolar * 60 * 1000;
    
    // For browser demo, cap max rows
    let rowCount = 0;
    
    for (let time = start; time <= end; time += solarIntervalMs) {
      if (this.options.mode === "sample" && rowCount > this.options.maxRowsForBrowser) {
        break;
      }
      
      const date = new Date(time);
      const timeStr = date.toISOString();
      const hour = date.getUTCHours();
      const dayOfYear = Math.floor((time - new Date(date.getUTCFullYear(), 0, 0).getTime()) / 1000 / 60 / 60 / 24);

      for (const asset of MASTER_ASSETS) {
        if (this.options.mode === "sample" && rowCount > this.options.maxRowsForBrowser) {
          break;
        }

        // Generate events occasionally
        let activeEvent: EventLabel | null = null;
        if (rnd() < 0.05) { // 5% chance of an event starting
           if (asset.type.includes("SOLAR")) {
             const ev = generateSolarEvents(asset.asset_id, timeStr);
             if (ev) { events.push(ev); activeEvent = ev; }
           } else {
             const ev = generateWindEvents(asset.asset_id, timeStr);
             if (ev) { events.push(ev); activeEvent = ev; }
           }
        }

        if (asset.type.includes("SOLAR")) {
          // Met Obs
          const isDaytime = hour >= 6 && hour <= 18;
          let ghi = 0;
          let cloud_cover = rnd() * 20; // 0-20% base
          let temp = 20 + rnd() * 15;

          if (isDaytime) {
             const peakDist = Math.abs(12 - hour);
             ghi = Math.max(0, 1000 * Math.pow(Math.cos((peakDist / 6) * (Math.PI / 2)), 1.5));
          }

          if (activeEvent?.event_type === "moving_cloud_band" || activeEvent?.event_type === "sudden_cloud_ramp_down") {
            cloud_cover = 80 + rnd() * 20;
          }

          const met: MetObservation = {
            timestamp: timeStr,
            asset_id: asset.asset_id,
            ghi_wm2: ghi,
            poa_irradiance_wm2: ghi * 1.1, // simplified tilt
            module_temperature_c: temp + (ghi / 1000) * 10,
            ambient_temperature_c: temp,
            cloud_cover_pct: cloud_cover
          };
          metObservations.push(met);

          // Scada
          const inverterAvail = activeEvent?.event_type === "inverter_outage" ? 0.8 : 1.0;
          let localLimit = asset.capacity_mw;
          let curtailmentFlag = false;

          if (activeEvent?.event_type === "local_grid_curtailment") {
             localLimit = asset.capacity_mw * 0.5;
          }

          const powerOut = calculateSolarPower({
            capacity_mw: asset.capacity_mw,
            ghi_wm2: ghi,
            cloud_cover_pct: cloud_cover,
            module_temperature_c: met.module_temperature_c!,
            inverter_availability_pct: inverterAvail * 100,
            local_limit_mw: localLimit
          });

          if (powerOut.possible_power_mw > localLimit) {
            curtailmentFlag = true;
          }

          let quality: "GOOD"|"STALE"|"MISSING"|"NOISY" = "GOOD";
          if (activeEvent?.event_type === "SCADA_stale_signal") quality = "STALE";

          scadaMeasurements.push({
            timestamp: timeStr,
            asset_id: asset.asset_id,
            actual_mw: powerOut.actual_mw,
            local_limit_mw: localLimit,
            control_setpoint_mw: asset.capacity_mw,
            curtailment_flag: curtailmentFlag,
            quality_flag: quality
          });

        } else if (asset.type.includes("WIND")) {
          // Met Obs
          const baseWind = 5 + 3 * Math.sin((dayOfYear / 365) * Math.PI * 2) + 2 * Math.sin((hour / 24) * Math.PI * 2);
          let windSpeed = Math.max(0, baseWind + (rnd() * 4 - 2));
          
          if (activeEvent?.event_type === "wind_ramp_down" || activeEvent?.event_type === "low_wind_lull") {
             windSpeed = Math.max(0, windSpeed - 5);
          } else if (activeEvent?.event_type === "wind_ramp_up") {
             windSpeed += 6;
          }

          const met: MetObservation = {
            timestamp: timeStr,
            asset_id: asset.asset_id,
            wind_speed_ms: windSpeed,
            wind_direction_deg: rnd() * 360,
            air_density: 1.225
          };
          metObservations.push(met);

          const turbineAvail = activeEvent?.event_type === "turbine_outage" ? 0.7 : 0.98;
          let localLimit = asset.capacity_mw;
          let curtailmentFlag = false;

          if (activeEvent?.event_type === "local_grid_curtailment") {
             localLimit = asset.capacity_mw * 0.5;
          }

          const powerOut = calculateWindPower({
            capacity_mw: asset.capacity_mw,
            wind_speed_ms: windSpeed,
            air_density: 1.225,
            turbine_availability_pct: turbineAvail * 100,
            local_limit_mw: localLimit
          });

          if (powerOut.possible_power_mw > localLimit) {
            curtailmentFlag = true;
          }

          scadaMeasurements.push({
            timestamp: timeStr,
            asset_id: asset.asset_id,
            actual_mw: powerOut.actual_mw,
            local_limit_mw: localLimit,
            control_setpoint_mw: asset.capacity_mw,
            curtailment_flag: curtailmentFlag,
            quality_flag: "GOOD"
          });
        }
        
        rowCount++;
      }
    }

    return {
      asset_master: MASTER_ASSETS,
      scada_measurements: scadaMeasurements,
      met_observations: metObservations,
      nwp_forecasts: nwpForecasts,
      event_labels: events
    };
  }
}

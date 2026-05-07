import type {
  Plant,
  PlantRecord,
  BlockRecord,
  WindFarmRecord,
  AlertRecord,
  ScenarioType,
  ForecastHorizon,
  HorizonForecast,
  ScadaQualityFlag,
  CurtailmentStatus,
  ForecastPoint
} from "./types";
import { calculateSolarPower } from "../models/solarPhysicalModel";
import { calculateWindPower } from "../models/windPowerCurveModel";
import { runForecastEngine } from "../models/forecastEngine";
import { ASSET_MASTER, LIVE_REPLAY_SAMPLES } from "./data";

// Seeded random number generator
let seed = 12345;
export function random() {
  const x = Math.sin(seed++) * 10000;
  return x - Math.floor(x);
}

// ─── Constants & Assets ────────────────────────────────────────────────────────

export const PLANTS: Plant[] = ASSET_MASTER.map(a => ({
  id: a.id,
  name: a.name,
  district: a.district,
  capacity_mw: a.capacity_mw,
  type: a.type as any,
  technology: a.type.toLowerCase().includes("solar") ? "solar" : "wind",
  lat: a.id === "SOL_PAVAGADA" ? 14.1 : 15.3,
  lon: a.id === "SOL_PAVAGADA" ? 77.3 : 75.5,
  hierarchy: a.id === "SOL_PAVAGADA" ? { segments: 8, blocks_per_segment: 5, block_capacity_mw: 50 } : undefined,
  wind_config: a.id === "WND_GADAG" ? { farms: 2, turbines_per_farm: 60, turbine_mw: 3.5, hub_height_m: 90, cut_in_ms: 3, rated_ms: 11, cut_out_ms: 25 } : undefined,
  brief: {
    sensors: a.sensors,
    scada_fields: a.scada_tags,
    met_fields: a.met_tags,
    nwp_fields: a.nwp_tags,
    business_objective: a.business_objective,
    enabled_horizons: ["5-min", "15-min", "2-hour", "40-hour"],
    readiness_score: a.readiness_score,
    historical_period: a.historical_period
  }
}));

// ─── Simulation Engine ─────────────────────────────────────────────────────────

export class SimulationEngine {
  timeMinutes: number;
  scenario: ScenarioType;
  cloudIntensity: number;
  inverterOutageSeverity: number;
  curtailmentActive: boolean;
  scadaFailureActive: boolean;

  constructor() {
    this.timeMinutes = 13 * 60; // Starts at 13:00
    this.scenario = "clear_sky";
    this.cloudIntensity = 0;
    this.inverterOutageSeverity = 0;
    this.curtailmentActive = false;
    this.scadaFailureActive = false;
  }

  setScenario(s: ScenarioType) {
    this.scenario = s;
  }

  tick() {
    this.timeMinutes += 5; // 5 min increment
    if (this.timeMinutes > 18 * 60) {
      this.timeMinutes = 13 * 60; // loop back to 13:00
    }
  }

  getTimeString(offsetMin = 0) {
    let t = this.timeMinutes + offsetMin;
    const hrs = Math.floor(t / 60) % 24;
    const mins = (t % 60);
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  }

  sigmoid(x: number, k: number, center: number) {
    return 1 / (1 + Math.exp(-k * (x - center)));
  }

  getSolarCurveFactor(offsetMin = 0) {
    const t = this.timeMinutes + offsetMin;
    const sunrise = 6 * 60;
    const sunset = 18 * 60 + 30;
    if (t < sunrise || t > sunset) return 0;
    
    const peak = 12 * 60 + 15;
    const range = sunset - sunrise;
    const dist = Math.abs(t - peak);
    let factor = Math.max(0, Math.pow(Math.cos((dist / (range / 2)) * (Math.PI / 2)), 1.25));

    // Sigmoid Ramps
    if (this.scenario === "moving_cloud") {
      // Cloud Ramp Down: center 16:00 (960), k=0.11
      const drop = 0.6 * this.sigmoid(t, 0.11, 960);
      // Cloud Ramp Up: center 17:25 (1045), k=0.09
      const recovery = 0.5 * this.sigmoid(t, 0.09, 1045);
      factor = factor * (1 - drop + recovery);
    }

    return Math.max(0, factor);
  }

  getWindCurveFactor(offsetMin = 0) {
    const t = this.timeMinutes + offsetMin;
    let base = 0.5 + 0.3 * Math.sin(t / (24 * 60) * Math.PI * 2);
    
    if (this.scenario === "wind_ramp_down") {
      // Wind Ramp Down: center 930 (15:30), k=0.07
      const drop = 0.4 * this.sigmoid(t, 0.07, 930);
      base = base * (1 - drop);
    }

    return Math.max(0.1, Math.min(1, base + (random() * 0.1 - 0.05)));
  }

  // ─── Generation Logic ─────────────────────────────────────────────────────────

  generateStateData() {
    const plants: PlantRecord[] = [];
    const blocks: BlockRecord[] = [];
    const farms: WindFarmRecord[] = [];
    const alerts: AlertRecord[] = [];
    const forecasts: HorizonForecast[] = [];

    let stateTotalActual = 0;
    let stateTotalCapacity = 0;
    let stateTotalForecast = 0;

    const solarFactor = this.getSolarCurveFactor();
    const windFactor = this.getWindCurveFactor();

    for (const plant of PLANTS) {
      stateTotalCapacity += plant.capacity_mw;
      
      let plantActual = 0;
      let plantPossible = 0;
      let plantForecast = 0;
      let plantStatus = "NORMAL";
      let plantComment = "";

      // Check for live replay sample match
      const currentTimeStr = this.getTimeString();
      const replaySample = LIVE_REPLAY_SAMPLES.find(s => 
        s.scenario === this.scenario && 
        s.plant === plant.id && 
        s.time === currentTimeStr
      );
      
      // Solar Simulation
      if (plant.technology === "solar") {
        if (plant.hierarchy) {
          for (let s = 1; s <= plant.hierarchy.segments; s++) {
            for (let b = 1; b <= plant.hierarchy.blocks_per_segment; b++) {
              const blockId = `B${((s-1)*plant.hierarchy.blocks_per_segment + b).toString().padStart(2, '0')}`;
              const bCap = plant.hierarchy.block_capacity_mw;
              
              let clearSky = bCap * solarFactor;
              let cloudCover = this.cloudIntensity;
              let tempC = 25 + (solarFactor * 15);
              let invAvail = 100;
              let localLimit = bCap;
              let scadaQuality: ScadaQualityFlag = "GOOD";
              let likelyCause = "";
              let alertType: any = null;

              // Scenarios
              if (this.scenario === "moving_cloud") {
                const cloudPos = ((this.timeMinutes - (8*60)) / 60) * 8; 
                if (Math.abs(s - cloudPos) < 2) {
                  cloudCover = 80;
                  likelyCause = "Weather: Cloud Band";
                }
              } else if (this.scenario === "inverter_outage" && s === 3 && b === 2) {
                invAvail = 100 - this.inverterOutageSeverity;
                likelyCause = "Equipment: Inverter Group Fault";
                alertType = "INVERTER_UNDERPERFORMANCE";
              } else if (this.scenario === "grid_curtailment" && this.curtailmentActive && s >= 5) {
                localLimit = bCap * 0.4;
                likelyCause = "Grid: Local Substation Limit";
                alertType = "LOCAL_LIMIT_ACTIVE";
              } else if (this.scenario === "scada_stuck" && this.scadaFailureActive && s === 1 && b === 1) {
                scadaQuality = "STALE";
                alertType = "SCADA_STALE_SIGNAL";
                likelyCause = "Telemetry: Gateway Offline";
              }

              const availFactor = invAvail / 100;

              const powerOut = calculateSolarPower({
                capacity_mw: bCap,
                ghi_wm2: clearSky > 0 ? 1000 : 0, // simplified mapping
                cloud_cover_pct: cloudCover,
                module_temperature_c: tempC,
                inverter_availability_pct: invAvail,
                local_limit_mw: localLimit
              });

              let actualMw = powerOut.actual_mw;
              const possiblePower = powerOut.possible_power_mw;
              
              if (scadaQuality === "STALE") actualMw = bCap * 0.5; // Stale value
              actualMw = Math.max(0, actualMw + (random() * 0.5 - 0.25));

              const expectedMw = possiblePower;

              const forecastObj = runForecastEngine({
                asset_id: blockId,
                asset_type: "SOLAR",
                capacity_mw: bCap,
                horizon_minutes: 15,
                current_actual_mw: actualMw,
                current_irradiance: clearSky > 0 ? 800 : 0,
                current_wind_speed: 0,
                event_active: alertType !== null,
                poor_scada: scadaQuality !== "GOOD"
              });

              const forecastP50 = replaySample ? replaySample.p50 : forecastObj.p50;
              const forecastP10 = replaySample ? replaySample.p10 : forecastP50 * 0.9;
              const forecastP90 = replaySample ? replaySample.p90 : forecastP50 * 1.1;
              
              let curtailmentStatus: CurtailmentStatus = "NOT_DETECTED";
              if (localLimit < possiblePower) curtailmentStatus = "CONFIRMED";

              let blockActual = replaySample ? (replaySample.actual / plant.capacity_mw) * bCap : actualMw;

              plantActual += blockActual;
              plantPossible += possiblePower;
              plantForecast += forecastP50;

              blocks.push({
                timestamp: this.getTimeString(),
                park_id: plant.id,
                segment_id: `S${s}`,
                block_id: blockId,
                capacity_mw: bCap,
                actual_mw: actualMw,
                dc_power_mw: actualMw * 1.05,
                ac_power_mw: actualMw,
                expected_mw: expectedMw,
                possible_power_mw: possiblePower,
                forecast_p10_mw: forecastP50 * 0.9,
                forecast_p50_mw: forecastP50,
                forecast_p90_mw: forecastP50 * 1.1,
                scheduled_mw: clearSky * 0.95,
                deviation_mw: actualMw - (clearSky * 0.95),
                poa_irradiance_wm2: Math.max(0, (actualMw / bCap) * 1000 * (1/availFactor)),
                ghi_wm2: Math.max(0, (clearSky / bCap) * 1000),
                module_temperature_c: tempC,
                ambient_temperature_c: tempC - 10,
                inverter_available: Math.floor(100 * availFactor),
                inverter_total: 100,
                inverter_availability_pct: invAvail,
                control_setpoint_mw: bCap,
                local_limit_mw: localLimit,
                possible_power_with_no_limit_mw: possiblePower,
                curtailment_flag: localLimit < possiblePower,
                curtailment_status: curtailmentStatus,
                grid_outage_flag: false,
                breaker_status: "CLOSED",
                transformer_status: "NORMAL",
                alarm_count: invAvail < 100 ? 5 : 0,
                scada_quality_flag: scadaQuality,
                underperformance_score: expectedMw > 0 ? ((expectedMw - actualMw) / expectedMw) * 100 : 0,
                likely_cause: likelyCause
              });

              if (alertType) {
                alerts.push({
                  id: `ALT-${this.timeMinutes}-${s}-${b}`,
                  time: this.getTimeString(),
                  severity: alertType === "LOCAL_LIMIT_ACTIVE" ? "WARNING" : "CRITICAL",
                  plant: plant.id,
                  technology: "solar",
                  segment: `S${s}`,
                  block: blockId,
                  alert_type: alertType,
                  likely_cause: likelyCause,
                  impact_mw: Math.max(0, expectedMw - actualMw),
                  confidence: 95,
                  recommended_action: "Investigate and adjust schedule",
                  status: "ACTIVE",
                  curtailment_status: curtailmentStatus
                });
              }
            }
          }
        } else {
          // Simplified Solar Cluster
          const possible = plant.capacity_mw * solarFactor * (1 - this.cloudIntensity * 0.006);
          plantPossible = possible;
          plantActual = Math.max(0, possible + (random() * 5 - 2.5));
          plantForecast = possible;
        }
      } 
      
      // Wind Simulation
      else if (plant.technology === "wind" && plant.wind_config) {
        for (let f = 1; f <= plant.wind_config.farms; f++) {
          const wConf = plant.wind_config;
          const farmCap = wConf.turbines_per_farm * wConf.turbine_mw;
          
          let windSpeed = 5 + windFactor * 8 + (random() * 2 - 1); // 4 to 14 m/s
          let turbineAvail = 100;
          let likelyCause = "";
          let alertType: any = null;

          if (this.scenario === "wind_ramp_down") {
            windSpeed = Math.max(wConf.cut_in_ms - 1, windSpeed - 6);
            likelyCause = "Weather: Sudden Wind Drop";
            alertType = "WIND_RAMP_WARNING";
          } else if (this.scenario === "turbine_outage" && f === 1) {
            turbineAvail = 70;
            likelyCause = "Equipment: Turbine Maintenance";
            alertType = "TURBINE_AVAILABILITY_ISSUE";
          }

          const powerOut = calculateWindPower({
            capacity_mw: farmCap,
            wind_speed_ms: windSpeed,
            air_density: 1.225,
            turbine_availability_pct: turbineAvail,
            local_limit_mw: farmCap // no local limit applied here normally, unless scenario
          });

          const possiblePower = powerOut.possible_power_mw;
          let actualMw = powerOut.actual_mw;
          actualMw += (random() * 2 - 1); // Noise
          actualMw = Math.max(0, actualMw);

          const forecastObj = runForecastEngine({
            asset_id: `F${f}`,
            asset_type: "WIND",
            capacity_mw: farmCap,
            horizon_minutes: 15,
            current_actual_mw: actualMw,
            current_irradiance: 0,
            current_wind_speed: windSpeed,
            event_active: alertType !== null,
            poor_scada: false
          });

          const forecastP50 = replaySample ? replaySample.p50 : forecastObj.p50;
          const forecastP10 = replaySample ? replaySample.p10 : forecastP50 * 0.8;
          const forecastP90 = replaySample ? replaySample.p90 : forecastP50 * 1.2;

          let farmActual = replaySample ? (replaySample.actual / plant.capacity_mw) * farmCap : actualMw;

          plantActual += farmActual;
          plantPossible += possiblePower;
          plantForecast += forecastP50;

          farms.push({
            timestamp: this.getTimeString(),
            cluster_id: plant.id,
            farm_id: `F${f}`,
            farm_name: `${plant.name} Farm ${f}`,
            capacity_mw: farmCap,
            actual_mw: farmActual,
            possible_power_mw: possiblePower,
            forecast_p10_mw: forecastP10,
            forecast_p50_mw: forecastP50,
            forecast_p90_mw: forecastP90,
            scheduled_mw: possiblePower * 0.9,
            deviation_mw: actualMw - (possiblePower * 0.9),
            hub_wind_speed_ms: windSpeed,
            wind_direction_deg: 270 + (random() * 20 - 10),
            air_density_kg_m3: 1.15,
            turbulence_intensity: 0.1 + random() * 0.05,
            wake_loss_pct: 5,
            turbine_available: Math.floor(wConf.turbines_per_farm * (turbineAvail/100)),
            turbine_total: wConf.turbines_per_farm,
            turbine_availability_pct: turbineAvail,
            local_limit_mw: farmCap,
            curtailment_flag: false,
            curtailment_status: "NOT_DETECTED",
            scada_quality_flag: "GOOD",
            ramp_risk: alertType ? "HIGH" : "LOW",
            likely_cause: likelyCause
          });

          if (alertType) {
            alerts.push({
              id: `ALT-W-${this.timeMinutes}-${f}`,
              time: this.getTimeString(),
              severity: "WARNING",
              plant: plant.id,
              technology: "wind",
              segment: `F${f}`,
              alert_type: alertType,
              likely_cause: likelyCause,
              impact_mw: Math.max(0, farmCap * 0.5),
              confidence: 85,
              recommended_action: "Monitor turbine health",
              status: "ACTIVE"
            });
          }
        }
      }

      stateTotalActual += plantActual;
      stateTotalForecast += plantForecast;

      const deviation = plantActual - plantForecast;
      
      plants.push({
        timestamp: this.getTimeString(),
        plant_id: plant.id,
        plant_name: plant.name,
        district: plant.district,
        capacity_mw: plant.capacity_mw,
        technology: plant.technology,
        lat: plant.lat,
        lon: plant.lon,
        actual_mw: plantActual,
        possible_power_mw: plantPossible,
        forecast_p10_mw: plantForecast * 0.85,
        forecast_p50_mw: plantForecast,
        forecast_p90_mw: plantForecast * 1.15,
        scheduled_mw: plantForecast * 0.95,
        deviation_mw: deviation,
        deviation_pct: plantForecast > 0 ? (deviation / plantForecast) * 100 : 0,
        ramp_rate_mw_per_15min: (random() - 0.5) * 10,
        irradiance_wm2: plant.technology === 'solar' ? Math.max(0, (plantActual / plant.capacity_mw) * 1000) : 0,
        poa_irradiance_wm2: plant.technology === 'solar' ? Math.max(0, (plantActual / plant.capacity_mw) * 1000) : 0,
        module_temperature_c: 25 + solarFactor * 20,
        ambient_temperature_c: 25 + solarFactor * 10,
        wind_speed_ms: plant.technology === 'wind' ? 8 : 2,
        cloud_cover_pct: this.cloudIntensity,
        inverter_availability_pct: 99,
        turbine_availability_pct: 99,
        grid_availability_pct: 100,
        local_limit_mw: plant.capacity_mw,
        curtailment_flag: false,
        curtailment_status: "NOT_DETECTED",
        outage_flag: false,
        scada_quality_score: 98,
        data_quality_flag: "GOOD",
        forecast_confidence: 85 + random() * 10,
        ramp_risk: "LOW",
        deviation_risk: Math.abs(deviation) > plant.capacity_mw * 0.1 ? "HIGH" : "LOW",
        root_cause: ""
      });

      // Generate Multi-Horizon Forecasts for each plant
      forecasts.push(this.generateForecast(plant, "5min"));
      forecasts.push(this.generateForecast(plant, "2hour"));
      forecasts.push(this.generateForecast(plant, "40hour"));
    }

    return { 
      plants, 
      blocks, 
      farms, 
      alerts, 
      forecasts,
      stateTotalActual, 
      stateTotalForecast, 
      stateTotalCapacity 
    };
  }

  generateForecast(plant: Plant, horizon: ForecastHorizon): HorizonForecast {
    const points: ForecastPoint[] = [];
    const pointsCount = horizon === "5min" ? 12 : horizon === "2hour" ? 8 : 12; // Just sample points
    const intervalMin = horizon === "5min" ? 5 : horizon === "2hour" ? 15 : 60*4; // 5m, 15m, 4h

    let uncertaintyBase = horizon === "5min" ? 0.02 : horizon === "2hour" ? 0.08 : 0.15;

    for (let i = 0; i < pointsCount; i++) {
      const offsetMin = i * intervalMin;
      let factor = plant.technology === "solar" ? this.getSolarCurveFactor(offsetMin) : this.getWindCurveFactor(offsetMin);
      const p50_base = plant.capacity_mw * factor;
      
      const forecastObj = runForecastEngine({
        asset_id: plant.id,
        asset_type: plant.technology === "solar" ? "SOLAR" : "WIND",
        capacity_mw: plant.capacity_mw,
        horizon_minutes: intervalMin === 5 ? 5 : intervalMin === 15 ? 120 : 2400, // Approx
        current_actual_mw: p50_base,
        current_irradiance: plant.technology === "solar" ? 800 * factor : 0,
        current_wind_speed: plant.technology === "wind" ? 8 * factor : 0,
        event_active: false,
        poor_scada: false
      });

      points.push({
        offset_min: offsetMin,
        p50: forecastObj.p50,
        p10: forecastObj.p10,
        p90: forecastObj.p90,
        scheduled: p50_base * 0.95,
        actual: i === 0 ? forecastObj.p50 * (0.9 + random()*0.2) : undefined
      });
    }

    return {
      horizon,
      asset_id: plant.id,
      issue_time: this.getTimeString(),
      model_id: plant.technology === "solar" ? "PV_PHYSICAL_LGBM" : "WIND_POWER_CURVE_XGB",
      confidence: horizon === "5min" ? 95 : horizon === "2hour" ? 85 : 70,
      nMAE_pct: horizon === "5min" ? 3 : horizon === "2hour" ? 7 : 12,
      coverage_pct: 82,
      uncertainty_reason: ["Weather Volatility", "SCADA Latency"],
      points
    };
  }
}

export const engine = new SimulationEngine();

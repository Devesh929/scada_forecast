/**
 * Static Asset Metadata for SuryaGrid Plants
 * Aligned with Simulation Engine expectations
 */

export const SOLAR_PAVAGADA_MASTER = {
  id: "SOL_PAVAGADA",
  name: "Pavagada Solar Park",
  district: "Tumkur, Karnataka",
  type: "Solar PV",
  capacity_mw: 2050,
  sensors: [
    "Pyranometer (Active)",
    "Sky Imager (Active)",
    "Module Temp Sensor (Active)",
    "Ambient Temp Sensor (Active)",
    "Back-of-Module (Active)"
  ],
  scada_tags: ["Inv_Power", "Inv_Status", "CB_Status", "DC_Volt"],
  met_tags: ["GHI", "DNI", "AmbTemp", "ModTemp", "WindSpeed"],
  nwp_tags: ["NCMRWF_GHI", "ECMWF_GHI", "GFS_GHI", "WRF_GHI"],
  business_objective: "Minimize deviation penalties and optimize grid dispatch.",
  readiness_score: "94%",
  historical_period: "5 Years"
};

export const WND_GADAG_MASTER = {
  id: "WND_GADAG",
  name: "Gadag Wind Farm",
  district: "Gadag, Karnataka",
  type: "Wind",
  capacity_mw: 300,
  sensors: [
    "Met Mast Anemometer (Active)",
    "Nacelle Anemometer (Active)",
    "Lidar Upstream (Active)",
    "Yaw Position Sensor (Active)",
    "Pressure Transducer (Active)"
  ],
  scada_tags: ["Turb_Power", "Turb_Status", "Pitch_Angle", "RPM"],
  met_tags: ["WindSpeed_80m", "WindDir_80m", "Pressure", "Humidity"],
  nwp_tags: ["NCMRWF_WS", "ECMWF_WS", "GFS_WS", "WRF_WS"],
  business_objective: "Optimize turbine uptime and forecast ramp-down events.",
  readiness_score: "91%",
  historical_period: "3 Years"
};

export const UNIT_MASTER_PAVAGADA = Array.from({ length: 40 }, (_, i) => ({
  id: `PAV_S${Math.floor(i/10)+1}_B${(i%10)+1 < 10 ? '0' : ''}${(i%10)+1}`,
  status: "ONLINE",
  mw: 51.25
}));

export const UNIT_MASTER_GADAG = Array.from({ length: 150 }, (_, i) => ({
  id: `WND_G${Math.floor(i/30)+1}_T${(i%30)+1 < 10 ? '0' : ''}${(i%30)+1}`,
  status: "ONLINE",
  mw: 2.0
}));

export const SENSOR_INVENTORY = [
  { id: "MET_01", type: "Pyranometer", location: "Block A", status: "HEALTHY" },
  { id: "MET_02", type: "Anemometer", location: "Main Mast", status: "HEALTHY" },
  { id: "MET_03", type: "Hygrometer", location: "Substation", status: "HEALTHY" },
];

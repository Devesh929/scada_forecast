import { AssetMaster } from "./schemas";

export const MASTER_ASSETS: AssetMaster[] = [
  // Solar Assets
  {
    asset_id: "PAV_SOLAR",
    asset_name: "Pavagada Solar Park",
    type: "SOLAR_PLANT",
    district: "Tumakuru",
    capacity_mw: 2000,
    latitude: 14.28,
    longitude: 77.41,
    hierarchy: { segments: 8, blocks_per_segment: 5, block_capacity_mw: 50, inverters_per_block: 10 }
  },
  {
    asset_id: "KAL_SOLAR",
    asset_name: "Kalaburagi Solar Cluster",
    type: "SOLAR_CLUSTER",
    district: "Kalaburagi",
    capacity_mw: 450,
    latitude: 17.32,
    longitude: 76.83
  },
  {
    asset_id: "GAD_SOLAR",
    asset_name: "Gadag Solar Cluster",
    type: "SOLAR_CLUSTER",
    district: "Gadag",
    capacity_mw: 300,
    latitude: 15.43,
    longitude: 75.63
  },
  {
    asset_id: "DHA_SOLAR",
    asset_name: "Dharwad Solar Cluster",
    type: "SOLAR_CLUSTER",
    district: "Dharwad",
    capacity_mw: 250,
    latitude: 15.45,
    longitude: 75.00
  },
  {
    asset_id: "RAI_SOLAR",
    asset_name: "Raichur Solar Cluster",
    type: "SOLAR_CLUSTER",
    district: "Raichur",
    capacity_mw: 350,
    latitude: 16.20,
    longitude: 77.36
  },
  {
    asset_id: "BAL_SOLAR",
    asset_name: "Ballari Solar Cluster",
    type: "SOLAR_CLUSTER",
    district: "Ballari",
    capacity_mw: 400,
    latitude: 15.13,
    longitude: 76.92
  },

  // Wind Assets
  {
    asset_id: "GAD_WIND",
    asset_name: "Gadag Wind Cluster",
    type: "WIND_CLUSTER",
    district: "Gadag",
    capacity_mw: 360,
    latitude: 15.42,
    longitude: 75.64,
    hierarchy: { farms: 2, turbines_per_farm: 60, turbine_capacity_mw: 3.0, hub_height_m: 90, power_curve_id: "PC_3.0_90" }
  },
  {
    asset_id: "CHI_WIND",
    asset_name: "Chitradurga Wind Cluster",
    type: "WIND_CLUSTER",
    district: "Chitradurga",
    capacity_mw: 420,
    latitude: 14.22,
    longitude: 76.39,
    hierarchy: { farms: 3, turbines_per_farm: 40, turbine_capacity_mw: 3.5, hub_height_m: 100, power_curve_id: "PC_3.5_100" }
  },
  {
    asset_id: "BAL_WIND",
    asset_name: "Ballari Wind Cluster",
    type: "WIND_CLUSTER",
    district: "Ballari",
    capacity_mw: 200,
    latitude: 15.15,
    longitude: 76.90,
    hierarchy: { farms: 1, turbines_per_farm: 100, turbine_capacity_mw: 2.0, hub_height_m: 80, power_curve_id: "PC_2.0_80" }
  },
  {
    asset_id: "DAV_WIND",
    asset_name: "Davanagere Wind Cluster",
    type: "WIND_CLUSTER",
    district: "Davanagere",
    capacity_mw: 250,
    latitude: 14.46,
    longitude: 75.92,
    hierarchy: { farms: 2, turbines_per_farm: 41, turbine_capacity_mw: 3.0, hub_height_m: 90, power_curve_id: "PC_3.0_90" } // ~250MW
  },
  {
    asset_id: "BAG_WIND",
    asset_name: "Bagalkot Wind Cluster",
    type: "WIND_CLUSTER",
    district: "Bagalkot",
    capacity_mw: 180,
    latitude: 16.18,
    longitude: 75.69,
    hierarchy: { farms: 1, turbines_per_farm: 60, turbine_capacity_mw: 3.0, hub_height_m: 90, power_curve_id: "PC_3.0_90" }
  }
];

export interface DataGenOptions {
  startDate: string;
  endDate: string;
  intervalMinutesSolar: number;
  intervalMinutesWind: number;
  mode: "sample" | "full";
  maxRowsForBrowser: number;
}

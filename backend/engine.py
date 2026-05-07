import pandas as pd
import numpy as np
from datetime import datetime, timedelta
class SimulationEngine:
    def __init__(self):
        self.current_time = datetime(2025, 1, 5, 13, 0)
        self.excel_data = None
        self.history = []
        self.plants = [
            {"plant_id": "SOL_PAVAGADA", "plant_name": "Pavagada Solar", "technology": "solar", "capacity_mw": 1000, "lat": 14.28, "lon": 77.44},
            {"plant_id": "WND_GADAG", "plant_name": "Gadag Wind", "technology": "wind", "capacity_mw": 300, "lat": 15.42, "lon": 75.62}
        ]
        self.load_default_logic()
    def load_default_logic(self):
        self.state = {
            "time": self.current_time.strftime("%H:%M"),
            "plants": [],
            "alerts": []
        }
        for p in self.plants:
            self.state["plants"].append({
                **p,
                "actual_mw": 0.0,
                "forecast_mw": 0.0,
                "deviation_mw": 0.0,
                "status": "NORMAL"
            })
    def load_excel(self, file_path):
        try:
            self.excel_data = pd.read_excel(file_path)
        except Exception as e:
            print(f"Excel Error: {e}")
    def advance(self):
        self.current_time += timedelta(minutes=5)
        self.state["time"] = self.current_time.strftime("%H:%M")
        for p in self.state["plants"]:
            base = 0.7 * p["capacity_mw"]
            noise = np.random.normal(0, 5)
            p["actual_mw"] = max(0, base + noise)
            p["forecast_mw"] = base
            p["deviation_mw"] = p["actual_mw"] - p["forecast_mw"]
        return self.state
    def get_current_state(self):
        return self.state
    def get_dictionary(self):
        return {
            "groups": [
                {
                    "group_id": "power",
                    "group_name": "Power Metrics",
                    "fields": [
                        {"field_name": "actual_mw", "label": "Actual MW", "unit": "MW"},
                        {"field_name": "forecast_mw", "label": "Forecast MW", "unit": "MW"}
                    ]
                }
            ]
        }
    def get_historical(self, plant_id):
        return [
            {"id": "EV-001", "type": "Ramp Event", "duration": "30m", "loss": "50MW", "result": "HIT"}
        ]
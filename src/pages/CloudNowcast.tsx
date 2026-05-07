import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CloudRain, Sun, Wind, Activity } from "lucide-react";
import { SimulationState } from "../App";

export default function CloudNowcast({ simState }: { simState: SimulationState }) {
  // Simple mock data for nowcast
  const cloudMotionVector = "SE to NW at 12 m/s";
  const sunObstructionProb = "78%";
  const timeToOcclusion = "14 mins";
  const predictedDrop = "-240 MW";

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="pt-6 flex flex-col items-center justify-center">
            <Wind className="h-8 w-8 text-blue-400 mb-2" />
            <h3 className="text-sm text-slate-400">Cloud Motion</h3>
            <p className="text-xl font-bold text-slate-200">{cloudMotionVector}</p>
          </CardContent>
        </Card>
        
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="pt-6 flex flex-col items-center justify-center">
            <CloudRain className="h-8 w-8 text-slate-400 mb-2" />
            <h3 className="text-sm text-slate-400">Obstruction Probability</h3>
            <p className="text-xl font-bold text-slate-200">{sunObstructionProb}</p>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="pt-6 flex flex-col items-center justify-center">
            <Activity className="h-8 w-8 text-amber-400 mb-2" />
            <h3 className="text-sm text-slate-400">Time to Occlusion</h3>
            <p className="text-xl font-bold text-slate-200">{timeToOcclusion}</p>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="pt-6 flex flex-col items-center justify-center">
            <Sun className="h-8 w-8 text-emerald-400 mb-2" />
            <h3 className="text-sm text-slate-400">Predicted MW Drop</h3>
            <p className="text-xl font-bold text-red-400">{predictedDrop}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-slate-900 border-slate-800 h-96 flex items-center justify-center">
         <div className="text-center">
            <CloudRain className="h-16 w-16 text-slate-700 mx-auto mb-4" />
            <p className="text-slate-400">Synthetic Sky-Camera Panel</p>
            <p className="text-sm text-slate-500 mt-2">Weather-only forecast vs Sky-camera enhanced forecast overlay would go here.</p>
         </div>
      </Card>
    </div>
  );
}

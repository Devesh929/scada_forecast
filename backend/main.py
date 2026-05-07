from fastapi import FastAPI, UploadDict, File, Query
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
import json
import os
from pydantic import BaseModel
from typing import List, Optional
import uvicorn
from engine import SimulationEngine
from llm import LocalLLM
app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
engine = SimulationEngine()
llm = LocalLLM()
class RequirementRequest(BaseModel):
    user_request: str
    plant_name: str
    data_schema: str
@app.get("/api/state")
async def get_state():
    return engine.get_current_state()
@app.post("/api/tick")
async def tick():
    return engine.advance()
@app.post("/api/analyze")
async def analyze(req: RequirementRequest):
    return await llm.analyze(req.user_request, req.plant_name, req.data_schema)
@app.get("/api/dictionary")
async def get_dictionary():
    return engine.get_dictionary()
@app.get("/api/historical")
async def get_historical(plant_id: str = Query(...)):
    return engine.get_historical(plant_id)
@app.post("/api/upload-excel")
async def upload_excel(file: bytes = File(...)):
    with open("temp_telemetry.xlsx", "wb") as f:
        f.write(file)
    engine.load_excel("temp_telemetry.xlsx")
    return {"status": "success", "message": "Excel loaded into simulation engine"}
if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
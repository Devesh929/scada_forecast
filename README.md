# SuryaGrid AI Cohesive Workbench

The SuryaGrid AI Cohesive Workbench is a professional-grade, agentic renewable forecasting platform. It unifies high-fidelity physics-based simulation with story-driven onboarding and LLM-assisted operational intelligence.

## Features

1.  **Agentic Onboarding**: Intelligent assessment of SCADA schemas, readiness scoring, and automated data contract generation.
2.  **Physics-Based Simulation**: Real-time generation modeling for Solar (Irradiance/Temperature/Inverters) and Wind (Power Curves/Turbine groups).
3.  **Horizon-Aware Forecasting**: Probabilistic P10/P50/P90 forecasts for 5m, 15m, 2h, and 40h horizons.
4.  **Operational Insights**: Integrated LLM engine (Llama/Groq) for explaining deviations, curtailments, and sensor drifts in plain language.
5.  **Story-Driven UX**: A narrative workflow that takes operators from asset registration to live control-room simulation.

## Project Structure

- `src/App.tsx`: The main cohesive platform shell.
- `src/simulation/`: Core simulation engine and state management.
- `src/models/`: Physics and forecasting models.
- `src/agent/`: Onboarding agent logic and LLM client.
- `src/styles.css`: Premium dark-themed industrial aesthetic.

## Installation

1.  Extract the ZIP folder.
2.  Open a terminal in the project directory.
3.  Install dependencies:
    ```bash
    npm install
    ```

## Configuration

To enable LLM-powered operational insights, create a `.env` file in the root directory:
```env
VITE_GROQ_API_KEY=your_groq_api_key_here
```
*If no key is provided, the system will use a deterministic fallback assistant.*

## Running the Application

Start the development server:
```bash
npm run dev
```

The application will be available at `http://localhost:5173`.

---
Built by Antigravity AI for ABB SuryaGrid Initiative.

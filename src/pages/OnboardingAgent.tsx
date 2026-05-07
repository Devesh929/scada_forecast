import React, { useState } from "react";
import { Upload, MessageSquare, Bot, FileJson, CheckCircle2, AlertCircle, Download } from "lucide-react";
import { OnboardingAgent as AgentObj } from "../agent/onboardingAgent";

const agent = new AgentObj();

export default function OnboardingAgent() {
  const [step, setStep] = useState(1);
  const [inputVal, setInputVal] = useState("timestamp, actual_mw, local_limit_mw, poa_irradiance, module_temp, inverter_availability");
  const [analysis, setAnalysis] = useState<any>(null);

  const simulateOnboarding = () => {
    setStep(2);
    setTimeout(() => {
      const res = agent.processSchemaUpload("New Plant", inputVal);
      setAnalysis(res);
      setStep(3);
    }, 1000);
  };

  const downloadContract = () => {
    if (!analysis) return;
    const blob = new Blob([analysis.contract], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('href', url);
    a.setAttribute('download', 'data_contract.txt');
    a.click();
  };

  return (
    <div className="max-w-6xl mx-auto h-[calc(100vh-8rem)] flex gap-6">
      {/* Chat Area */}
      <div className="w-1/2 flex flex-col bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-slate-800 bg-slate-800/50 flex items-center gap-3">
          <Bot className="text-blue-400" />
          <h2 className="font-semibold">Plant Onboarding Agent</h2>
        </div>
        
        <div className="flex-1 p-6 overflow-y-auto space-y-6">
          <div className="flex gap-4">
            <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center shrink-0">
              <Bot size={18} className="text-blue-400" />
            </div>
            <div className="bg-slate-800 rounded-lg rounded-tl-none p-4 text-sm text-slate-200">
              Hello! I am the SuryaGrid Onboarding Agent. Please provide the plant metadata and upload a sample of your SCADA schema (comma separated headers). I will score the data readiness and design a forecasting pipeline for you.
            </div>
          </div>

          {step >= 2 && (
            <div className="flex gap-4 flex-row-reverse">
              <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
                <span className="text-emerald-400 text-xs font-bold">ME</span>
              </div>
              <div className="bg-slate-700 rounded-lg rounded-tr-none p-4 text-sm text-slate-100">
                Schema: <span className="text-emerald-400 font-mono">{inputVal}</span>
              </div>
            </div>
          )}

          {step >= 3 && analysis && (
            <div className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center shrink-0">
                <Bot size={18} className="text-blue-400" />
              </div>
              <div className="bg-slate-800 rounded-lg rounded-tl-none p-4 text-sm text-slate-200 space-y-3">
                <p>{analysis.summary}</p>
                <p>I have designed a multi-horizon forecast pipeline for this plant. You can review the details in the panel and download the Data Contract.</p>
                <button onClick={downloadContract} className="mt-2 flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-medium">
                  <Download size={14} /> Download Data Contract
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-slate-800 bg-slate-900">
          <div className="flex gap-2">
            <input 
              type="text" 
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              placeholder="e.g. timestamp, actual_mw, local_limit_mw..." 
              className="flex-1 bg-slate-800 border border-slate-700 rounded-md px-3 text-sm focus:outline-none focus:border-blue-500"
              disabled={step > 1}
            />
            <button 
              onClick={simulateOnboarding}
              disabled={step > 1 || !inputVal}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-md text-sm font-medium disabled:opacity-50"
            >
              Analyze
            </button>
          </div>
        </div>
      </div>

      {/* Output Area */}
      <div className="w-1/2 flex flex-col gap-6">
        {step < 3 || !analysis ? (
          <div className="flex-1 border-2 border-dashed border-slate-800 rounded-xl flex items-center justify-center text-slate-500">
            Awaiting input and schema analysis...
          </div>
        ) : (
          <>
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <CheckCircle2 className="text-emerald-400" size={18} />
                Data Readiness Score: {analysis.readiness.score} / 100
              </h3>
              <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                <div>
                  <span className="text-slate-400 block mb-1">Available Fields</span>
                  <div className="space-y-1 text-emerald-400 font-mono text-xs">
                    {analysis.readiness.available_fields.map((f: string, i: number) => <div key={i}>{f.toUpperCase()}</div>)}
                  </div>
                </div>
                <div>
                  <span className="text-slate-400 block mb-1">Missing / Gap</span>
                  <div className="space-y-1 text-amber-400 font-mono text-xs">
                    {analysis.readiness.missing_fields.map((f: string, i: number) => <div key={i}>{f.toUpperCase()}</div>)}
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex-1 overflow-auto">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <FileJson className="text-blue-400" size={18} />
                Recommended Pipeline (Tier {analysis.readiness.tier})
              </h3>
              
              <div className="space-y-4">
                {analysis.readiness.enabled_modes.map((mode: string, i: number) => (
                  <div key={i} className="p-3 bg-slate-800 rounded-lg">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-medium text-sm">{mode}</span>
                      <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded">Enabled</span>
                    </div>
                  </div>
                ))}
                {analysis.readiness.disabled_modes.map((mode: string, i: number) => (
                  <div key={`disabled-${i}`} className="p-3 bg-slate-800 rounded-lg">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-medium text-sm text-slate-500">{mode}</span>
                      <span className="text-xs bg-slate-700 text-slate-400 px-2 py-0.5 rounded">Disabled</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

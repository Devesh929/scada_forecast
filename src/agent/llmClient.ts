export async function askLLM(prompt: string): Promise<string> {
  const apiKey = import.meta.env.VITE_GROQ_API_KEY;
  
  if (!apiKey || apiKey === "YOUR_API_KEY_HERE") {
    // Fallback deterministic explanations
    if (prompt.includes("uncertainty")) {
      return "Confidence decreased because SCADA latency increased and weather volatility is high. Ensemble weather spread indicates widening uncertainty bands.";
    }
    if (prompt.includes("curtailment")) {
      return "Curtailment suspected because actual export is clipped below the calculated physical possible power, despite normal availability and irradiance.";
    }
    return "LLM Analysis (Mock): The current forecast indicates a downward ramp due to expected cloud cover. Local limits are not currently active.";
  }

  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "llama3-8b-8192",
        messages: [
          { role: "system", content: "You are SuryaGrid AI, an expert renewable energy forecasting and grid operations assistant. Provide short, professional answers without generic AI buzzwords." },
          { role: "user", content: prompt }
        ],
        temperature: 0.3
      })
    });
    
    if (!res.ok) throw new Error("API Error");
    const data = await res.json();
    return data.choices[0].message.content;
  } catch (err) {
    return "Error generating LLM insight. Falling back to deterministic analysis.";
  }
}

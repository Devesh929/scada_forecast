import requests
import json
class LocalLLM:
    def __init__(self, endpoint="http://localhost:11434/api/generate"):
        self.endpoint = endpoint
        self.model = "llama3"
    async def analyze(self, user_request, plant_name, data_schema):
        prompt = f
        payload = {
            "model": self.model,
            "prompt": prompt,
            "stream": False,
            "format": "json"
        }
        try:
            response = requests.post(self.endpoint, json=payload)
            result = response.json()
            return json.loads(result["response"])
        except Exception as e:
            return {
                "error": str(e),
                "message": "Local LLM unreachable. Ensure Ollama is running."
            }
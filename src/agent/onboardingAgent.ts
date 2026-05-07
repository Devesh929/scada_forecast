import { evaluateSchemaReadiness } from "./readinessRules";
import { generateDataContract } from "./dataContractGenerator";

export class OnboardingAgent {
  processSchemaUpload(plantName: string, rawCsvHeader: string) {
    const columns = rawCsvHeader.split(",").map(c => c.trim());
    const readiness = evaluateSchemaReadiness(columns);
    const contract = generateDataContract(plantName, readiness.available_fields);

    return {
      readiness,
      contract,
      summary: `Analyzed schema for ${plantName}. Detected ${readiness.detected_type} asset. Readiness Tier: ${readiness.tier}. Score: ${readiness.score}/100.`
    };
  }
}

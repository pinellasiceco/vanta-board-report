import logger from '../utils/logger.js';

export async function generateAllNarratives(data, kris, priorData, claudeClient) {
  logger.info('Generating board narratives with Claude...');

  const priorScore = priorData?.postureScore ?? null;
  const priorQuarter = priorData ? `Q${priorData.quarter} ${priorData.year}` : null;

  const [executiveSummary, programProgress] = await Promise.all([
    claudeClient.generateExecutiveSummary(data, data._score, priorScore, priorQuarter),
    claudeClient.generateProgramProgress(data, priorData),
  ]);

  const SEVERITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };
  const topRisks = [...data.risks.open]
    .sort((a, b) => (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9))
    .slice(0, 5);

  const riskNarratives = await Promise.all(
    topRisks.map(async risk => ({
      riskId: risk.id,
      narrative: await claudeClient.generateRiskNarrative(risk),
    }))
  );

  const kriEntries = Object.entries(kris);
  const kriExplanationResults = await Promise.all(
    kriEntries.map(([key, kri]) =>
      claudeClient.generateKRIExplanation(kri).then(text => [key, text])
    )
  );
  const kriExplanations = Object.fromEntries(kriExplanationResults);

  const decisionsNeeded = await claudeClient.generateDecisionsNeeded(data, data._score);

  logger.info('All narratives generated');

  return {
    executiveSummary,
    riskNarratives,
    decisionsNeeded,
    kriExplanations,
    programProgress,
  };
}

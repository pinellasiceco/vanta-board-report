#!/usr/bin/env node
import 'dotenv/config';
import { Command } from 'commander';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import logger from './src/utils/logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPORTS_DIR = join(__dirname, 'data/reports');

function currentQuarter() {
  const month = new Date().getMonth() + 1;
  return `Q${Math.ceil(month / 3)}`;
}

async function runGeneration(options, stepCallback) {
  const useMock = options.mock ?? process.env.USE_MOCK_DATA === 'true';
  const quarter = options.quarter || process.env.REPORT_QUARTER || currentQuarter();
  const year = parseInt(options.year || process.env.REPORT_YEAR || new Date().getFullYear());
  const companyName = options.companyName || process.env.COMPANY_NAME || 'Your Company';

  const step = (name, status) => {
    logger.info(`${status === 'done' ? '✓' : status === 'active' ? '→' : '!'} ${name}`);
    stepCallback?.(name, status);
  };

  // Step 1: Connect
  step('Connecting to Vanta API', 'active');
  let client;
  if (useMock) {
    const { MockVantaClient } = await import('./src/api/mockVantaClient.js');
    client = new MockVantaClient();
    logger.info('Using mock Vanta data');
  } else {
    const { VantaClient } = await import('./src/api/vantaClient.js');
    client = new VantaClient();
    const test = await client.testConnection();
    if (!test.success) throw new Error(`Vanta connection failed: ${test.error}`);
    logger.info(`Connected to Vanta: ${test.companyName}`);
  }
  step('Connecting to Vanta API', 'done');

  // Step 2: Collect
  step('Collecting compliance data', 'active');
  const { collectAll } = await import('./src/data/collector.js');
  const data = await collectAll(client);
  step('Collecting compliance data', 'done');

  // Step 3: Score
  step('Calculating posture score', 'active');
  const { calculatePostureScore, calculateKRIs } = await import('./src/data/scorer.js');
  const stateManager = (await import('./src/state/stateManager.js')).default;
  const priorData = await stateManager.getPriorPeriod(quarter, year);
  const score = calculatePostureScore(data);
  const kris = calculateKRIs(data, priorData);
  data._score = score;
  logger.info(`Posture score: ${score}/100`);
  step('Calculating posture score', 'done');

  // Step 4: Narratives
  step('Generating board narratives with Claude', 'active');
  const claudeClient = (await import('./src/api/claudeClient.js')).default;
  const { generateAllNarratives } = await import('./src/narrative/narrativeGenerator.js');
  const narratives = await generateAllNarratives(data, kris, priorData, claudeClient);
  step('Generating board narratives with Claude', 'done');

  // Step 5: PDF
  step('Building PDF report', 'active');
  const { populateTemplate } = await import('./src/report/htmlTemplate.js');
  const { generatePDF } = await import('./src/report/pdfGenerator.js');

  const priorScore = priorData?.postureScore ?? null;
  const priorQuarter = priorData ? `${priorData.quarter} ${priorData.year}` : null;

  const populatedHtml = await populateTemplate(data, narratives, kris, score, {
    companyName,
    quarter,
    year,
    priorScore,
    priorQuarter,
    controlsFixed: data.controls.passing,
  });

  const timestamp = new Date().toISOString().slice(0, 10);
  const pdfName = `board-report-${quarter}-${year}-${timestamp}.pdf`;
  const pptxName = `board-report-${quarter}-${year}-${timestamp}.pptx`;
  const pdfPath = join(REPORTS_DIR, pdfName);
  const pptxPath = join(REPORTS_DIR, pptxName);

  await generatePDF(populatedHtml, pdfPath);
  step('Building PDF report', 'done');

  // Step 6: PPTX
  step('Building PowerPoint presentation', 'active');
  const { generatePPTX } = await import('./src/report/pptxGenerator.js');
  await generatePPTX(data, narratives, kris, score, pptxPath, {
    companyName, quarter, year, priorScore,
  });
  step('Building PowerPoint presentation', 'done');

  // Step 7: Save state
  await stateManager.saveCurrentPeriod(quarter, year, data, score, kris);
  step('Reports ready for download', 'done');

  const { stat } = await import('fs/promises');
  const pdfStat = await stat(pdfPath);
  const pptxStat = await stat(pptxPath);

  const snapshot = {
    score,
    controlsPassing: data.controls.passing,
    controlsTotal: data.controls.total,
    highRisks: (data.risks.bySeverity.critical || 0) + (data.risks.bySeverity.high || 0),
    personnelRate: data.personnel.complianceRate,
  };

  return [
    { name: pdfName, path: pdfPath, size: pdfStat.size, snapshot },
    { name: pptxName, path: pptxPath, size: pptxStat.size },
  ];
}

const program = new Command();
program.name('vanta-board-report').version('1.0.0');

program
  .command('generate')
  .description('Generate a board compliance report')
  .option('--quarter <Q1-Q4>', 'Report quarter')
  .option('--year <YYYY>', 'Report year')
  .option('--mock', 'Use mock data')
  .option('--no-dashboard', 'Skip dashboard, CLI only')
  .option('--output <path>', 'Output directory', REPORTS_DIR)
  .option('--company <name>', 'Company name')
  .action(async (opts) => {
    const useDashboard = opts.dashboard !== false;

    if (useDashboard) {
      const port = parseInt(process.env.DASHBOARD_PORT || '3001');
      const { createDashboardServer } = await import('./src/dashboard/server.js');
      const dashboard = createDashboardServer(async (cfg, stepCb) =>
        runGeneration({ ...opts, mock: cfg.useMock ?? opts.mock, companyName: cfg.companyName }, stepCb)
      );
      await dashboard.start(port);
      try {
        const open = (await import('open')).default;
        await open(`http://localhost:${port}`);
      } catch {}
      logger.info(`Dashboard open at http://localhost:${port}`);
      logger.info('Press Ctrl+C to stop');
    } else {
      logger.info('Running in CLI-only mode...');
      const files = await runGeneration({ ...opts, companyName: opts.company });
      logger.info('\n📄 Reports generated:');
      for (const f of files) logger.info(`  ${f.path} (${(f.size / 1024).toFixed(0)} KB)`);
    }
  });

program
  .command('test-connection')
  .description('Test Vanta and Claude API credentials')
  .option('--mock', 'Test with mock client')
  .action(async (opts) => {
    const useMock = opts.mock || process.env.USE_MOCK_DATA === 'true';
    if (useMock) {
      const { MockVantaClient } = await import('./src/api/mockVantaClient.js');
      const client = new MockVantaClient();
      const result = await client.testConnection();
      logger.info(`Vanta (mock): ${result.companyName} ✓`);
    } else {
      const { VantaClient } = await import('./src/api/vantaClient.js');
      const client = new VantaClient();
      const result = await client.testConnection();
      logger.info(result.success ? `Vanta: ${result.companyName} ✓` : `Vanta: FAILED — ${result.error}`);
    }

    if (process.env.ANTHROPIC_API_KEY) {
      logger.info(`Claude API key: configured ✓ (model: claude-sonnet-4-6)`);
    } else {
      logger.warn(`Claude API key: NOT SET — narratives will use fallback text`);
    }
  });

program
  .command('history')
  .description('Show quarterly compliance history')
  .action(async () => {
    const stateManager = (await import('./src/state/stateManager.js')).default;
    const history = await stateManager.listHistory();
    if (!history.length) {
      logger.info('No history yet. Run "generate" to create your first report.');
      return;
    }
    logger.info('\nQuarterly Compliance History:');
    logger.info('─'.repeat(60));
    for (const h of history) {
      logger.info(`${h.quarter} ${h.year}  Score: ${h.postureScore}/100  Controls: ${h.controls?.passing}/${h.controls?.total}  High Risks: ${h.risks?.high}`);
    }
  });

program.parse();

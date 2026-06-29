#!/usr/bin/env node
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { mkdir } from 'fs/promises';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkgRoot = join(__dirname, '..');

dotenv.config({ path: join(process.cwd(), '.env') });
dotenv.config({ path: join(pkgRoot, '.env') });

import { program } from 'commander';
import logger from './utils/logger.js';
import { collectAll } from './data/collector.js';
import { calculatePostureScore, calculateKRIs } from './data/scorer.js';
import { generateAllNarratives } from './narrative/narrativeGenerator.js';
import { populateTemplate } from './report/htmlTemplate.js';
import { generatePDF } from './report/pdfGenerator.js';
import { generatePPTX } from './report/pptxGenerator.js';
import stateManager from './state/stateManager.js';
import { createDashboardServer } from './dashboard/server.js';
import open from 'open';

const REPORTS_DIR = join(process.cwd(), 'vanta-reports');

async function ensureOutputDir() {
  await mkdir(REPORTS_DIR, { recursive: true });
  return REPORTS_DIR;
}

async function runGeneration(options = {}, onStep = () => {}) {
  const useMock = options.mock || options.useMock || !process.env.VANTA_CLIENT_ID;
  const quarter = options.quarter || `Q${Math.ceil((new Date().getMonth() + 1) / 3)}`;
  const year = String(options.year || new Date().getFullYear());
  const companyName = options.companyName || process.env.COMPANY_NAME || 'Your Company';

  logger.info(`Starting report generation — ${quarter} ${year} (${useMock ? 'mock' : 'live'} data)`);

  onStep('Connecting to Vanta API', 'running');
  const clientModule = useMock
    ? await import('./api/mockVantaClient.js')
    : await import('./api/vantaClient.js');
  const client = clientModule.default;
  onStep('Connecting to Vanta API', 'complete');

  onStep('Collecting compliance data', 'running');
  const data = await collectAll(client);
  onStep('Collecting compliance data', 'complete');

  onStep('Calculating posture score', 'running');
  const score = calculatePostureScore(data);
  const priorData = await stateManager.getPriorPeriod(quarter, year);
  const kris = calculateKRIs(data, priorData);
  onStep('Calculating posture score', 'complete');

  const config = {
    companyName,
    quarter,
    year,
    priorScore: priorData?.postureScore ?? null,
    priorQuarter: priorData ? `${priorData.quarter} ${priorData.year}` : null,
    controlsFixed: priorData ? data.controls.passing - (priorData.controls?.passing || 0) : 0,
  };

  onStep('Generating board narratives with Claude', 'running');
  const claudeClient = (await import('./api/claudeClient.js')).default;
  const narratives = await generateAllNarratives(data, kris, priorData, claudeClient);
  onStep('Generating board narratives with Claude', 'complete');

  const populatedHtml = await populateTemplate(data, narratives, kris, score, config);
  const outputDir = await ensureOutputDir();
  const timestamp = new Date().toISOString().slice(0, 10);
  const baseName = `${companyName.replace(/\s+/g, '-')}-${quarter}-${year}-${timestamp}`;
  const pdfPath = join(outputDir, `${baseName}.pdf`);
  const pptxPath = join(outputDir, `${baseName}.pptx`);

  onStep('Building PDF report', 'running');
  await generatePDF(populatedHtml, pdfPath);
  onStep('Building PDF report', 'complete');

  onStep('Building PowerPoint presentation', 'running');
  await generatePPTX(data, narratives, kris, score, pptxPath, config);
  onStep('Building PowerPoint presentation', 'complete');

  await stateManager.saveCurrentPeriod(quarter, year, data, score, kris);

  onStep('Reports ready for download', 'complete');

  logger.info(`\n✅ Reports saved to: ${outputDir}`);
  logger.info(`   PDF:  ${pdfPath}`);
  logger.info(`   PPTX: ${pptxPath}`);

  if (options.open) await open(pdfPath);

  return { pdfPath, pptxPath, score };
}

program
  .name('vanta-board-report')
  .description('Generate board-ready compliance reports from Vanta')
  .version('1.0.0');

program
  .command('generate')
  .description('Generate PDF and PPTX board report')
  .option('--mock', 'Use mock data instead of live Vanta API')
  .option('--quarter <q>', 'Report quarter (e.g. Q2)')
  .option('--year <y>', 'Report year (e.g. 2026)')
  .option('--open', 'Open PDF after generation')
  .option('--dashboard', 'Launch web dashboard')
  .action(async (opts) => {
    try {
      if (opts.dashboard) {
        const dashboard = createDashboardServer(
          (genOpts, onStep) => runGeneration({ ...opts, ...genOpts }, onStep)
        );
        const PORT = parseInt(process.env.PORT || '3000');
        const server = await dashboard.start(PORT);
        const port = server.address().port;
        const url = `http://localhost:${port}`;
        logger.info(`Dashboard running at ${url}`);
        await open(url);
      } else {
        await runGeneration(opts);
      }
    } catch (err) {
      logger.error(`Generation failed: ${err.message}`);
      process.exit(1);
    }
  });

program
  .command('test-connection')
  .description('Test Vanta API connection')
  .action(async () => {
    try {
      const { VantaClient } = await import('./api/vantaClient.js');
      const client = new VantaClient();
      const result = await client.testConnection();
      logger.info(`Connection successful: ${result.companyName}`);
    } catch (err) {
      logger.error(`Connection failed: ${err.message}`);
      process.exit(1);
    }
  });

program
  .command('history')
  .description('View prior quarter scores')
  .action(async () => {
    const history = await stateManager.listHistory();
    if (!history.length) {
      console.log('No history yet. Run generate first.');
    } else {
      history.forEach(h => console.log(`${h.period}: score ${h.postureScore}`));
    }
  });

program.parse();

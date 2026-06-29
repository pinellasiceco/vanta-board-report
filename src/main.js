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

async function ensureOutputDir() {
  const dir = join(process.cwd(), 'vanta-reports');
  await mkdir(dir, { recursive: true });
  return dir;
}

async function runGeneration(options = {}) {
  const useMock = options.mock || options.useMock || !process.env.VANTA_CLIENT_ID;
  const quarter = options.quarter || `Q${Math.ceil((new Date().getMonth() + 1) / 3)}`;
  const year = String(options.year || new Date().getFullYear());
  const companyName = options.companyName || process.env.COMPANY_NAME || 'Your Company';

  logger.info(`Starting report generation — ${quarter} ${year} (${useMock ? 'mock' : 'live'} data)`);

  const clientModule = useMock
    ? await import('./api/mockVantaClient.js')
    : await import('./api/vantaClient.js');
  const client = clientModule.default;

  const data = await collectAll(client);
  const score = calculatePostureScore(data);

  const priorData = await stateManager.getPriorPeriod(quarter, year);
  const kris = calculateKRIs(data, priorData);

  const config = {
    companyName,
    quarter,
    year,
    priorScore: priorData?.postureScore ?? null,
    priorQuarter: priorData ? `${priorData.quarter} ${priorData.year}` : null,
    controlsFixed: priorData ? data.controls.passing - (priorData.controls?.passing || 0) : 0,
  };

  const claudeClient = (await import('./api/claudeClient.js')).default;
  const narratives = await generateAllNarratives(data, kris, priorData, claudeClient);

  const populatedHtml = await populateTemplate(data, narratives, kris, score, config);

  const outputDir = await ensureOutputDir();
  const timestamp = new Date().toISOString().slice(0, 10);
  const baseName = `${companyName.replace(/\s+/g, '-')}-${quarter}-${year}-${timestamp}`;

  const pdfPath = join(outputDir, `${baseName}.pdf`);
  const pptxPath = join(outputDir, `${baseName}.pptx`);

  await generatePDF(populatedHtml, pdfPath);
  await generatePPTX(data, narratives, kris, score, pptxPath, config);

  await stateManager.saveCurrentPeriod(quarter, year, data, score, kris);

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
        const dashboard = createDashboardServer(() => runGeneration(opts));
        const PORT = parseInt(process.env.PORT || '3000');
        const server = await dashboard.start(PORT);
        const port = server.address().port;
        const url = `http://localhost:${port}`;
        logger.info(`Dashboard running at ${url}`);
        await open(url);
        // Keep process alive
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

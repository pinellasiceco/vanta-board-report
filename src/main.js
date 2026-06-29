import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createRequire } from 'module';

// Resolve the package root whether running via npx or directly
const __dirname = dirname(fileURLToPath(import.meta.url));
const pkgRoot = join(__dirname, '..');

// Load .env from cwd (user's project) first, then fall back to package root
import dotenv from 'dotenv';
dotenv.config({ path: join(process.cwd(), '.env') });
dotenv.config({ path: join(pkgRoot, '.env') });

import { program } from 'commander';
import logger from './utils/logger.js';
import { collectVantaData } from './data/collector.js';
import { calculatePostureScore } from './data/scorer.js';
import { generateNarratives } from './narrative/narrativeGenerator.js';
import { buildKRIs } from './data/transformer.js';
import { populateTemplate } from './report/htmlTemplate.js';
import { generatePDF } from './report/pdfGenerator.js';
import { generatePPTX } from './report/pptxGenerator.js';
import { loadState, saveState } from './state/stateManager.js';
import { createDashboardServer } from './dashboard/server.js';
import { mkdir } from 'fs/promises';
import { join as pathJoin } from 'path';
import open from 'open';

async function ensureOutputDir() {
  const dir = pathJoin(process.cwd(), 'vanta-reports');
  await mkdir(dir, { recursive: true });
  return dir;
}

async function runGeneration(options = {}) {
  const useMock = options.mock || !process.env.VANTA_CLIENT_ID;
  const quarter = options.quarter || `Q${Math.ceil((new Date().getMonth() + 1) / 3)}`;
  const year = options.year || new Date().getFullYear();
  const companyName = process.env.COMPANY_NAME || 'Your Company';

  logger.info(`Starting report generation — ${quarter} ${year} (${useMock ? 'mock' : 'live'} data)`);

  const { collectData } = useMock
    ? await import('./api/mockVantaClient.js')
    : await import('./api/vantaClient.js');

  const rawData = await collectData();
  const data = await collectVantaData(rawData);
  const score = calculatePostureScore(data);
  const state = await loadState();

  const config = {
    companyName,
    quarter,
    year,
    priorScore: state.lastScore ?? null,
    priorQuarter: state.lastQuarter ?? null,
    controlsFixed: state.controlsFixed ?? 0,
  };

  const narratives = await generateNarratives(data, score, config);
  const kris = buildKRIs(data);
  const populatedHtml = await populateTemplate(data, narratives, kris, score, config);

  const outputDir = await ensureOutputDir();
  const timestamp = new Date().toISOString().slice(0, 10);
  const baseName = `${companyName.replace(/\s+/g, '-')}-${quarter}-${year}-${timestamp}`;

  const pdfPath = pathJoin(outputDir, `${baseName}.pdf`);
  const pptxPath = pathJoin(outputDir, `${baseName}.pptx`);

  await generatePDF(populatedHtml, pdfPath);
  await generatePPTX(data, narratives, kris, score, pptxPath, config);

  await saveState({ lastScore: score, lastQuarter: `${quarter} ${year}`, controlsFixed: data.controls.passing });

  logger.info(`\n✅ Reports saved to: ${outputDir}`);
  logger.info(`   PDF:  ${pdfPath}`);
  logger.info(`   PPTX: ${pptxPath}`);

  if (options.open) {
    await open(pdfPath);
  }

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
    if (opts.dashboard) {
      const server = await createDashboardServer(() => runGeneration(opts));
      const url = `http://localhost:${server.port}`;
      logger.info(`Dashboard running at ${url}`);
      await open(url);
    } else {
      await runGeneration(opts);
    }
  });

program
  .command('test-connection')
  .description('Test Vanta API connection')
  .action(async () => {
    const { testConnection } = await import('./api/vantaClient.js');
    await testConnection();
  });

program
  .command('history')
  .description('View prior quarter scores')
  .action(async () => {
    const state = await loadState();
    console.log(JSON.stringify(state, null, 2));
  });

program.parse();

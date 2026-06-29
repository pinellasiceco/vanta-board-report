import express from 'express';
import { fileURLToPath } from 'url';
import { join, dirname } from 'path';
import { readdir, stat } from 'fs/promises';
import { createReadStream } from 'fs';
import logger from '../utils/logger.js';
import stateManager from '../state/stateManager.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPORTS_DIR = join(process.cwd(), 'vanta-reports');

export function createDashboardServer(generatorFn) {
  const app = express();
  app.use(express.json());
  app.use(express.static(join(__dirname, 'public')));

  const clients = new Set();
  let currentStatus = { stage: 'idle', steps: [], error: null };

  function broadcast(event, data) {
    const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const res of clients) res.write(msg);
  }

  // UI expects statuses: 'pending', 'active', 'done', 'error'
  function updateStep(step, status) {
    const uiStatus = status === 'running' ? 'active' : status === 'complete' ? 'done' : status;
    const existing = currentStatus.steps.find(s => s.step === step);
    if (existing) {
      existing.status = uiStatus;
    } else {
      currentStatus.steps.push({ step, status: uiStatus });
    }
    broadcast('progress', currentStatus);
  }

  app.get('/api/status', (req, res) => {
    res.json(currentStatus);
  });

  app.get('/api/events', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();
    clients.add(res);
    req.on('close', () => clients.delete(res));
    res.write(`event: connected\ndata: {}\n\n`);
  });

  app.post('/api/generate', async (req, res) => {
    const { quarter, year, companyName, useMock } = req.body;
    const jobId = Date.now().toString();
    res.json({ jobId });

    const stepLabels = [
      'Connecting to Vanta API',
      'Collecting compliance data',
      'Calculating posture score',
      'Generating board narratives with Claude',
      'Building PDF report',
      'Building PowerPoint presentation',
      'Reports ready for download',
    ];

    currentStatus = {
      stage: 'running',
      steps: stepLabels.map(s => ({ step: s, status: 'pending' })),
      error: null,
      jobId,
      files: null,
    };
    broadcast('progress', currentStatus);

    try {
      await generatorFn(
        { quarter, year, companyName, useMock },
        (step, status) => updateStep(step, status)
      );

      // Load actual files from disk for download list
      let files = [];
      try {
        const allFiles = await readdir(REPORTS_DIR);
        files = await Promise.all(
          allFiles
            .filter(f => f.endsWith('.pdf') || f.endsWith('.pptx'))
            .map(async f => {
              const s = await stat(join(REPORTS_DIR, f));
              return { name: f, size: s.size, created: s.birthtime };
            })
        );
        files.sort((a, b) => new Date(b.created) - new Date(a.created));
        files = files.slice(0, 4); // most recent 2 runs
      } catch { /* ignore */ }

      currentStatus.stage = 'complete';
      currentStatus.files = files;
      broadcast('complete', { files });
    } catch (err) {
      logger.error(`Generation failed: ${err.message}`);
      currentStatus.stage = 'error';
      currentStatus.error = err.message;
      broadcast('error', { message: err.message });
    }
  });

  app.get('/api/reports', async (req, res) => {
    try {
      const files = await readdir(REPORTS_DIR);
      const reportFiles = files.filter(f => f.endsWith('.pdf') || f.endsWith('.pptx'));
      const reports = await Promise.all(
        reportFiles.map(async f => {
          const s = await stat(join(REPORTS_DIR, f));
          return { name: f, size: s.size, created: s.birthtime };
        })
      );
      res.json(reports.sort((a, b) => new Date(b.created) - new Date(a.created)));
    } catch {
      res.json([]);
    }
  });

  app.get('/api/history', async (req, res) => {
    try {
      const history = await stateManager.listHistory();
      res.json(history);
    } catch {
      res.json([]);
    }
  });

  app.get('/api/download/:filename', (req, res) => {
    const filename = req.params.filename.replace(/\.\./g, '');
    const filePath = join(REPORTS_DIR, filename);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    createReadStream(filePath).pipe(res);
  });

  app.post('/api/test-connection', async (req, res) => {
    const { useMock } = req.body;
    if (useMock) {
      const { MockVantaClient } = await import('../api/mockVantaClient.js');
      const client = new MockVantaClient();
      const result = await client.testConnection();
      return res.json({ ...result, mode: 'mock' });
    }
    try {
      const { VantaClient } = await import('../api/vantaClient.js');
      const client = new VantaClient();
      const result = await client.testConnection();
      res.json({ ...result, mode: 'live' });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  return {
    app,
    start(port) {
      return new Promise(resolve => {
        const server = app.listen(port, () => {
          logger.info(`Dashboard listening on port ${port}`);
          resolve(server);
        });
      });
    },
    updateStep,
    broadcast,
  };
}

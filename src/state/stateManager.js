import { readFile, writeFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { join, dirname } from 'path';
import logger from '../utils/logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const HISTORY_PATH = join(__dirname, '../../data/history/compliance-history.json');

function priorQuarterKey(quarter, year) {
  const q = parseInt(quarter.replace('Q', ''));
  if (q === 1) return `${year - 1}-Q4`;
  return `${year}-Q${q - 1}`;
}

class StateManager {
  constructor() {
    this._state = null;
  }

  async load() {
    if (this._state) return this._state;
    try {
      const raw = await readFile(HISTORY_PATH, 'utf-8');
      this._state = JSON.parse(raw);
    } catch {
      this._state = {};
    }
    return this._state;
  }

  async save() {
    await writeFile(HISTORY_PATH, JSON.stringify(this._state, null, 2));
  }

  async saveCurrentPeriod(quarter, year, data, score, kris) {
    await this.load();
    const key = `${year}-${quarter}`;
    this._state[key] = {
      savedAt: new Date().toISOString(),
      quarter,
      year,
      postureScore: score,
      kris,
      controls: {
        passing: data.controls.passing,
        total: data.controls.total,
      },
      risks: {
        high: (data.risks.bySeverity.critical || 0) + (data.risks.bySeverity.high || 0),
        medium: data.risks.bySeverity.medium || 0,
        low: data.risks.bySeverity.low || 0,
        total: data.risks.open.length,
      },
      personnel: {
        compliant: data.personnel.compliant,
        total: data.personnel.total,
      },
      vendors: {
        high: data.vendors.byRiskTier.high || 0,
        medium: data.vendors.byRiskTier.medium || 0,
        low: data.vendors.byRiskTier.low || 0,
      },
      policies: {
        accepted: data.policies.fullyAccepted,
        total: data.policies.total,
      },
    };
    await this.save();
    logger.info(`State saved for ${quarter} ${year}`);
  }

  async getPriorPeriod(quarter, year) {
    await this.load();
    const key = priorQuarterKey(quarter, year);
    return this._state[key] || null;
  }

  async listHistory() {
    await this.load();
    return Object.entries(this._state)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([key, val]) => ({ period: key, ...val }));
  }
}

export default new StateManager();

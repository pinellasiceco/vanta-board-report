import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { join, dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MOCK_DATA_PATH = join(__dirname, '../../data/mock/vantaMockData.json');

const delay = (ms) => new Promise(r => setTimeout(r, ms));

export class MockVantaClient {
  constructor() {
    this._data = null;
  }

  async _load() {
    if (!this._data) {
      const raw = await readFile(MOCK_DATA_PATH, 'utf-8');
      this._data = JSON.parse(raw);
    }
    return this._data;
  }

  async _call(fn) {
    await delay(100);
    const data = await this._load();
    return fn(data);
  }

  async testConnection() {
    await delay(100);
    const data = await this._load();
    return { success: true, companyName: data.organization.name };
  }

  async getCompanyInfo() {
    return this._call(d => d.organization);
  }

  async getFrameworks() {
    return this._call(d => d.frameworks);
  }

  async getControls(frameworkId) {
    return this._call(d =>
      frameworkId ? d.controls.filter(c => c.frameworkId === frameworkId) : d.controls
    );
  }

  async getAllControls() {
    return this._call(d => d.controls);
  }

  async getTests() {
    return this._call(d => d.tests);
  }

  async getRisks() {
    return this._call(d => d.risks);
  }

  async getVendors() {
    return this._call(d => d.vendors);
  }

  async getPersonnel() {
    return this._call(d => d.personnel);
  }

  async getPolicies() {
    return this._call(d => d.policies);
  }

  async getVulnerabilities() {
    return this._call(d => d.vulnerabilities);
  }
}

export default new MockVantaClient();

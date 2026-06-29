import axios from 'axios';
import { managementLimiter } from '../utils/rateLimiter.js';
import { withRetry } from '../utils/retry.js';
import logger from '../utils/logger.js';

export class VantaClient {
  constructor() {
    this.baseUrl = process.env.VANTA_BASE_URL || 'https://api.vanta.com';
    this.clientId = process.env.VANTA_CLIENT_ID;
    this.clientSecret = process.env.VANTA_CLIENT_SECRET;
    this._token = null;
    this._tokenExpiresAt = 0;
  }

  async _getToken() {
    const now = Date.now();
    if (this._token && now < this._tokenExpiresAt - 60000) return this._token;

    logger.debug('Refreshing Vanta OAuth token');
    const res = await axios.post(`${this.baseUrl}/oauth/token`, {
      grant_type: 'client_credentials',
      client_id: this.clientId,
      client_secret: this.clientSecret,
      scope: 'vanta-api.all:read',
    });
    this._token = res.data.access_token;
    this._tokenExpiresAt = now + (res.data.expires_in || 3600) * 1000;
    return this._token;
  }

  async _get(path, params = {}) {
    return managementLimiter.schedule(() =>
      withRetry(async () => {
        const token = await this._getToken();
        const res = await axios.get(`${this.baseUrl}${path}`, {
          headers: { Authorization: `Bearer ${token}` },
          params,
        });
        return res.data;
      }, { label: `GET ${path}` })
    );
  }

  async _paginate(path, params = {}) {
    const results = [];
    let pageToken = undefined;
    do {
      const data = await this._get(path, { ...params, pageSize: 100, ...(pageToken ? { pageToken } : {}) });
      const items = data.data?.results || data.results || data.data || [];
      results.push(...items);
      pageToken = data.data?.nextPageToken || data.nextPageToken || null;
    } while (pageToken);
    return results;
  }

  async testConnection() {
    try {
      const data = await this._get('/v1/organization');
      return { success: true, companyName: data.data?.name || data.name };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  async getCompanyInfo() {
    const data = await this._get('/v1/organization');
    return data.data || data;
  }

  async getFrameworks() {
    return this._paginate('/v1/frameworks');
  }

  async getControls(frameworkId) {
    return this._paginate('/v1/controls', frameworkId ? { frameworkId } : {});
  }

  async getAllControls() {
    return this._paginate('/v1/controls');
  }

  async getTests() {
    return this._paginate('/v1/tests');
  }

  async getRisks() {
    return this._paginate('/v1/risks');
  }

  async getVendors() {
    return this._paginate('/v1/vendors');
  }

  async getPersonnel() {
    return this._paginate('/v1/personnel');
  }

  async getPolicies() {
    return this._paginate('/v1/policies');
  }

  async getVulnerabilities() {
    return this._paginate('/v1/vulnerabilities');
  }
}

export default new VantaClient();

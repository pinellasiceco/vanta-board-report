import logger from './logger.js';

export async function withRetry(fn, { retries = 4, baseDelay = 1000, label = 'operation' } = {}) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const isRetryable = err.response?.status === 429 || (err.response?.status >= 500);
      if (!isRetryable || attempt === retries) throw err;
      const delay = baseDelay * Math.pow(2, attempt);
      logger.warn(`${label} failed (attempt ${attempt + 1}/${retries + 1}), retrying in ${delay}ms — ${err.message}`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw lastError;
}

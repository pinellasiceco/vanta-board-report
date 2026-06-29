import Bottleneck from 'bottleneck';

// 45 req/min max to stay under Vanta's 50 req/min management limit
export const managementLimiter = new Bottleneck({
  reservoir: 45,
  reservoirRefreshAmount: 45,
  reservoirRefreshInterval: 60 * 1000,
  maxConcurrent: 3,
});

export const integrationLimiter = new Bottleneck({
  reservoir: 18,
  reservoirRefreshAmount: 18,
  reservoirRefreshInterval: 60 * 1000,
  maxConcurrent: 2,
});

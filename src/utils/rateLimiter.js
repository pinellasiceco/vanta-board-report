import Bottleneck from 'bottleneck';

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

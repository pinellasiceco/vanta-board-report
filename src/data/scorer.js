export function calculatePostureScore(data) {
  const controlScore = data.controls.total > 0
    ? (data.controls.passing / data.controls.total) * 40
    : 0;

  let riskScore = 20;
  const highRisks = (data.risks.bySeverity.critical || 0) + (data.risks.bySeverity.high || 0);
  riskScore -= Math.min(20, highRisks * 8);
  riskScore -= Math.min(12, (data.risks.bySeverity.medium || 0) * 3);
  riskScore -= Math.min(4, (data.risks.bySeverity.low || 0) * 1);
  riskScore = Math.max(0, riskScore);

  const personnelScore = data.personnel.total > 0
    ? (data.personnel.compliant / data.personnel.total) * 20
    : 20;

  const policyScore = data.policies.total > 0
    ? (data.policies.fullyAccepted / data.policies.total) * 10
    : 10;

  let vendorScore = 10;
  vendorScore -= Math.min(10, (data.vendors.byRiskTier.high || 0) * 3);
  vendorScore = Math.max(0, vendorScore);

  const total = controlScore + riskScore + personnelScore + policyScore + vendorScore;
  return Math.round(total * 10) / 10;
}

export function calculateScoreBreakdown(data) {
  const controlScore = data.controls.total > 0
    ? (data.controls.passing / data.controls.total) * 40
    : 0;

  let riskScore = 20;
  const highRisks = (data.risks.bySeverity.critical || 0) + (data.risks.bySeverity.high || 0);
  riskScore -= Math.min(20, highRisks * 8);
  riskScore -= Math.min(12, (data.risks.bySeverity.medium || 0) * 3);
  riskScore -= Math.min(4, (data.risks.bySeverity.low || 0) * 1);
  riskScore = Math.max(0, riskScore);

  const personnelScore = data.personnel.total > 0
    ? (data.personnel.compliant / data.personnel.total) * 20
    : 20;

  const policyScore = data.policies.total > 0
    ? (data.policies.fullyAccepted / data.policies.total) * 10
    : 10;

  let vendorScore = 10;
  vendorScore -= Math.min(10, (data.vendors.byRiskTier.high || 0) * 3);
  vendorScore = Math.max(0, vendorScore);

  return {
    controls: { score: Math.round(controlScore * 10) / 10, max: 40, label: 'Controls Passing Rate' },
    risks: { score: Math.round(riskScore * 10) / 10, max: 20, label: 'Risk Exposure' },
    personnel: { score: Math.round(personnelScore * 10) / 10, max: 20, label: 'Personnel Compliance' },
    policies: { score: Math.round(policyScore * 10) / 10, max: 10, label: 'Policy Acceptance' },
    vendors: { score: Math.round(vendorScore * 10) / 10, max: 10, label: 'Vendor Risk' },
  };
}

export function calculateTrend(current, prior, higherIsBetter = true) {
  if (prior === null || prior === undefined) return 'same';
  if (current > prior) return higherIsBetter ? 'up' : 'down';
  if (current < prior) return higherIsBetter ? 'down' : 'up';
  return 'same';
}

export function calculateKRIs(data, priorData) {
  const controlsRate = data.controls.total > 0
    ? Math.round((data.controls.passing / data.controls.total) * 1000) / 10
    : 0;
  const priorControlsRate = priorData?.controls
    ? Math.round((priorData.controls.passing / priorData.controls.total) * 1000) / 10
    : null;

  const openHighRisks = (data.risks.bySeverity.critical || 0) + (data.risks.bySeverity.high || 0);
  const priorHighRisks = priorData
    ? (priorData.risks?.high || 0) + (priorData.risks?.critical || 0)
    : null;

  const vendorHigh = data.vendors.byRiskTier.high || 0;
  const priorVendorHigh = priorData?.vendors?.high ?? null;

  const personnelRate = data.personnel.complianceRate;
  const priorPersonnelRate = priorData?.personnel
    ? Math.round((priorData.personnel.compliant / priorData.personnel.total) * 1000) / 10
    : null;

  const policyRate = data.policies.acceptanceRate;
  const priorPolicyRate = priorData?.policies
    ? Math.round((priorData.policies.accepted / priorData.policies.total) * 1000) / 10
    : null;

  return {
    controlsPassingRate: {
      value: controlsRate,
      label: 'Controls Passing Rate',
      unit: '%',
      trend: calculateTrend(controlsRate, priorControlsRate, true),
      priorValue: priorControlsRate,
      benchmark: 'Industry avg: 89%',
    },
    openHighRisks: {
      value: openHighRisks,
      label: 'Open High-Severity Risks',
      unit: ' risks',
      trend: calculateTrend(openHighRisks, priorHighRisks, false),
      priorValue: priorHighRisks,
      benchmark: 'Target: 0',
    },
    vendorHighRisk: {
      value: vendorHigh,
      label: 'High-Risk Vendors',
      unit: ' vendors',
      trend: calculateTrend(vendorHigh, priorVendorHigh, false),
      priorValue: priorVendorHigh,
      benchmark: 'Target: 0',
    },
    personnelCompliance: {
      value: personnelRate,
      label: 'Personnel Compliance Rate',
      unit: '%',
      trend: calculateTrend(personnelRate, priorPersonnelRate, true),
      priorValue: priorPersonnelRate,
      benchmark: 'Target: 100%',
    },
    policyAcceptance: {
      value: policyRate,
      label: 'Policy Acceptance Rate',
      unit: '%',
      trend: calculateTrend(policyRate, priorPolicyRate, true),
      priorValue: priorPolicyRate,
      benchmark: 'Target: 100%',
    },
  };
}

import logger from '../utils/logger.js';

export async function collectAll(client) {
  logger.info('Collecting data from Vanta...');

  const [company, frameworks, controls, tests, risks, vendors, personnel, policies, vulnerabilities] =
    await Promise.all([
      client.getCompanyInfo(),
      client.getFrameworks(),
      client.getAllControls(),
      client.getTests(),
      client.getRisks(),
      client.getVendors(),
      client.getPersonnel(),
      client.getPolicies(),
      client.getVulnerabilities(),
    ]);

  logger.info('Data collection complete');

  const passingControls = controls.filter(c => c.status === 'passing');
  const failingControls = controls.filter(c => c.status === 'failing');
  const needsAttentionControls = controls.filter(c => c.status === 'needs_attention');

  const byFramework = {};
  for (const fw of frameworks) {
    const fwControls = controls.filter(c => c.frameworkId === fw.id);
    byFramework[fw.id] = {
      name: fw.name,
      total: fwControls.length,
      passing: fwControls.filter(c => c.status === 'passing').length,
      failing: fwControls.filter(c => c.status === 'failing').length,
    };
  }

  const passingTests = tests.filter(t => t.status === 'passing');
  const failingTests = tests.filter(t => t.status === 'failing');
  const needsAttentionTests = tests.filter(t => t.status === 'needs_attention');

  const openRisks = risks.filter(r => r.status === 'open');
  const risksBySeverity = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const r of openRisks) risksBySeverity[r.severity] = (risksBySeverity[r.severity] || 0) + 1;

  const vendorsByTier = { high: 0, medium: 0, low: 0 };
  for (const v of vendors) vendorsByTier[v.riskTier] = (vendorsByTier[v.riskTier] || 0) + 1;
  const highRiskVendors = vendors.filter(v => v.riskTier === 'high');

  const compliantPersonnel = personnel.filter(p => p.complianceStatus === 'compliant');
  const nonCompliantPersonnel = personnel.filter(p => p.complianceStatus !== 'compliant');

  const fullyAccepted = policies.filter(p => p.acceptanceRate === 100);
  const pendingPolicies = policies.filter(p => p.acceptanceRate < 100);

  const openVulns = vulnerabilities.filter(v => v.status === 'open');
  const vulnsBySeverity = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const v of openVulns) vulnsBySeverity[v.severity] = (vulnsBySeverity[v.severity] || 0) + 1;

  return {
    collectedAt: new Date().toISOString(),
    company,
    frameworks,
    controls: {
      total: controls.length,
      passing: passingControls.length,
      failing: failingControls.length,
      needsAttention: needsAttentionControls.length,
      byFramework,
      failingList: failingControls,
    },
    tests: {
      total: tests.length,
      passing: passingTests.length,
      failing: failingTests.length,
      needsAttention: needsAttentionTests.length,
      failingList: failingTests,
    },
    risks: {
      total: risks.length,
      open: openRisks,
      bySeverity: risksBySeverity,
    },
    vendors: {
      total: vendors.length,
      byRiskTier: vendorsByTier,
      highRiskVendors,
      all: vendors,
    },
    personnel: {
      total: personnel.length,
      compliant: compliantPersonnel.length,
      nonCompliant: nonCompliantPersonnel.length,
      complianceRate: personnel.length > 0
        ? Math.round((compliantPersonnel.length / personnel.length) * 1000) / 10
        : 0,
      nonCompliantList: nonCompliantPersonnel,
    },
    policies: {
      total: policies.length,
      fullyAccepted: fullyAccepted.length,
      pending: pendingPolicies.length,
      acceptanceRate: policies.length > 0
        ? Math.round((fullyAccepted.length / policies.length) * 1000) / 10
        : 0,
      pendingList: pendingPolicies,
    },
    vulnerabilities: {
      total: vulnerabilities.length,
      bySeverity: vulnsBySeverity,
      open: openVulns,
    },
  };
}

const SEVERITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };

export function formatRisksForBoard(risks) {
  return [...risks.open]
    .sort((a, b) => (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9))
    .slice(0, 5)
    .map(r => ({
      ...r,
      severityLabel: r.severity.charAt(0).toUpperCase() + r.severity.slice(1),
      ownerDisplay: r.owner?.replace('@', ' at ').replace(/acmesaas\.com|acme\.com/, 'internal') || 'Security Team',
    }));
}

export function formatVendorsForBoard(vendors) {
  return vendors.highRiskVendors.map(v => ({
    name: v.name,
    category: v.category,
    issue: v.hasSoc2 === false ? 'Missing current SOC 2 report' : 'High-risk classification',
    notes: v.notes || '',
  }));
}

export function formatFrameworkStatus(frameworks, controls) {
  return frameworks.map(fw => {
    const fwControls = controls.byFramework[fw.id] || {};
    const passing = fwControls.passing ?? fw.controlsPassing ?? 0;
    const total = fwControls.total ?? fw.controlsTotal ?? 0;
    const rate = total > 0 ? Math.round((passing / total) * 10) / 10 * 10 : 0;
    const status = rate >= 90 ? 'PASSING' : rate >= 70 ? 'NEEDS ATTENTION' : 'AT RISK';
    return {
      id: fw.id,
      name: fw.name,
      shortName: fw.shortName || fw.name,
      passing,
      total,
      rate: Math.round(rate * 10) / 10,
      status,
      nextAuditDate: fw.nextAuditDate || null,
      certificationDate: fw.certificationDate || null,
    };
  });
}

export function generateProgramProgress(data, priorData) {
  const items = [];

  if (priorData) {
    const controlsDelta = data.controls.passing - (priorData.controls?.passing || 0);
    if (controlsDelta > 0) items.push(`${controlsDelta} additional compliance controls remediated`);
    const vendorDelta = (priorData.vendors?.high || 0) - (data.vendors.byRiskTier.high || 0);
    if (vendorDelta > 0) items.push(`${vendorDelta} high-risk vendor classifications resolved`);
  }

  const pendingPolicy = data.policies.pendingList?.[0];
  if (pendingPolicy) {
    items.push(`"${pendingPolicy.name}" published and distributed to all ${data.personnel.total} employees`);
  }

  items.push(`${data.tests.passing} of ${data.tests.total} automated security tests passing`);

  if (data.personnel.compliant > 0) {
    items.push(`${data.personnel.compliant} of ${data.personnel.total} employees meeting all compliance requirements (${data.personnel.complianceRate}%)`);
  }

  return items;
}

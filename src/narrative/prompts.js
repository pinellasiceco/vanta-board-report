const SYSTEM_CISO = `You are a CISO writing a board report for non-technical directors. Write in plain business English. No jargon or acronyms. Focus on risk and business impact. Be direct and concise. Never say "N/A" or "no data" — rephrase constructively.`;

export function PROMPT_EXECUTIVE_SUMMARY({ data, score, priorScore, priorQuarter }) {
  const trend = priorScore !== null ? `${score > priorScore ? 'up' : 'down'} from ${priorScore} last quarter` : 'establishing baseline this quarter';
  const controlsRate = data.controls.total > 0
    ? Math.round((data.controls.passing / data.controls.total) * 1000) / 10
    : 0;
  const highRisks = (data.risks.bySeverity.critical || 0) + (data.risks.bySeverity.high || 0);

  return {
    system: SYSTEM_CISO,
    user: `Write a 3-sentence executive summary for a board report based on this compliance data:\n- Overall posture score: ${score}/100 (${trend})\n- Controls passing: ${data.controls.passing}/${data.controls.total} (${controlsRate}%)\n- High-severity risks: ${highRisks} open\n- Active frameworks: ${data.frameworks.length} (${data.frameworks.map(f => f.name || f.shortName).join(', ')})\n- Personnel compliance: ${data.personnel.complianceRate}%\n\nThe summary should answer: Are we more or less secure than last quarter, and what is the most important thing the board needs to know? Keep it to 3 sentences, board-ready.`,
  };
}

export function PROMPT_RISK_NARRATIVE(risk) {
  return {
    system: SYSTEM_CISO,
    user: `Translate this technical risk into 2 sentences a board member can understand. Focus on business impact and what we are doing about it. Do not repeat the risk title.\nRisk: ${risk.title}\nTechnical description: ${risk.description}\nBusiness impact: ${risk.businessImpact}\nCurrent mitigation status: ${risk.mitigationStatus}\nSeverity: ${risk.severity}`,
  };
}

export function PROMPT_DECISIONS_NEEDED({ data, score }) {
  const highRisks = data.risks.open
    .filter(r => r.severity === 'high' || r.severity === 'critical')
    .map(r => `- ${r.title}: ${r.businessImpact}`)
    .join('\n');

  const gaps = data.controls.failingList
    ?.slice(0, 3)
    .map(c => `- ${c.name}: ${c.failureReason || 'remediation in progress'}`)
    .join('\n') || 'No critical control gaps';

  const audits = data.frameworks
    .filter(f => f.nextAuditDate)
    .map(f => `${f.name}: ${f.nextAuditDate}`)
    .join(', ') || 'Audit dates to be confirmed';

  return {
    system: SYSTEM_CISO,
    user: `Based on this compliance data, write 2-3 specific asks for the board. Each ask should have a clear business rationale. Format as a numbered list with a bold action followed by a one-sentence rationale.\n\nOpen high-severity risks requiring resources:\n${highRisks || 'None at this time'}\n\nCompliance gaps requiring attention:\n${gaps}\n\nUpcoming audit timeline: ${audits}\n\nOverall posture score: ${score}/100`,
  };
}

export function PROMPT_KRI_EXPLANATION(kri) {
  return {
    system: SYSTEM_CISO,
    user: `Write one sentence explaining why this security metric matters to the business. Focus on business consequence, not technical detail.\nMetric: ${kri.label}\nCurrent value: ${kri.value}${kri.unit}\nTrend: ${kri.trend}\nContext: ${kri.benchmark}`,
  };
}

export function PROMPT_PROGRAM_PROGRESS({ data, priorData }) {
  const accomplishments = [];
  if (priorData) {
    const delta = data.controls.passing - (priorData.controls?.passing || 0);
    if (delta > 0) accomplishments.push(`${delta} compliance controls remediated`);
  }
  accomplishments.push(`${data.vendors.total} vendors under active monitoring`);
  accomplishments.push(`${data.personnel.compliant}/${data.personnel.total} employees compliant`);
  accomplishments.push(`${data.tests.passing}/${data.tests.total} automated tests passing`);
  if (data.vulnerabilities.bySeverity.critical === 0) {
    accomplishments.push('No critical unmitigated vulnerabilities in production');
  }

  return {
    system: SYSTEM_CISO,
    user: `Write 3-4 sentences summarizing security program progress this quarter in business terms. Focus on what improved and why it matters to the business. Avoid bullet points — write flowing prose.\n\nProgress data:\n${accomplishments.join('\n')}\n\nOpen risks: ${data.risks.open.length} (${(data.risks.bySeverity.high || 0) + (data.risks.bySeverity.critical || 0)} high/critical)\nFrameworks active: ${data.frameworks.map(f => f.name).join(', ')}`,
  };
}

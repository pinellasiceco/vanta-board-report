import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { join, dirname } from 'path';
import { formatRisksForBoard, formatFrameworkStatus, formatVendorsForBoard } from '../data/transformer.js';
import { calculateScoreBreakdown } from '../data/scorer.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATE_PATH = join(__dirname, '../../templates/report.html');

function esc(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function scoreColor(score) {
  if (score >= 80) return 'green';
  if (score >= 60) return 'amber';
  return 'red';
}

function trendArrow(trend) {
  if (trend === 'up') return '↑';
  if (trend === 'down') return '↓';
  return '→';
}

function trendCssClass(trend) {
  if (trend === 'up') return 'trend-up';
  if (trend === 'down') return 'trend-down';
  return 'trend-same';
}

function kriTrendCssClass(kri) {
  if (kri.trend === 'same') return 'trend-same';
  if (kri.trend === 'up') return 'trend-up-good';
  return 'trend-down-bad';
}

function buildFrameworkCards(frameworks, controls) {
  const fwStatus = formatFrameworkStatus(frameworks, controls);
  return fwStatus.map(fw => {
    const fillClass = fw.rate >= 90 ? 'green' : fw.rate >= 70 ? 'amber' : 'red';
    const statusBadgeClass = fw.status === 'PASSING' ? 'passing' : fw.status === 'NEEDS ATTENTION' ? 'attention' : 'at-risk';
    return `
    <div class="framework-card">
      <div class="framework-header">
        <span class="badge badge-framework">${esc(fw.name)}</span>
        <span class="badge badge-${statusBadgeClass}">${esc(fw.status)}</span>
      </div>
      <div class="progress-bar-container">
        <div class="progress-bar-label">
          <span>${esc(fw.passing)} of ${esc(fw.total)} controls passing</span>
          <span>${esc(fw.rate)}%</span>
        </div>
        <div class="progress-bar-track">
          <div class="progress-bar-fill ${fillClass}" style="width:${fw.rate}%"></div>
        </div>
      </div>
      ${fw.nextAuditDate ? `<div class="framework-stats">Next audit: <strong>${esc(fw.nextAuditDate)}</strong>${fw.certificationDate ? ` &nbsp;·&nbsp; Certified: <strong>${esc(fw.certificationDate)}</strong>` : ''}</div>` : ''}
    </div>`;
  }).join('\n');
}

function buildAuditCallouts(frameworks) {
  const withAudits = frameworks.filter(f => f.nextAuditDate);
  if (!withAudits.length) return '';
  return withAudits.map(fw => `
  <div class="audit-callout">
    <span class="audit-icon">📅</span>
    <span class="audit-text">Next <strong>${esc(fw.name || fw.shortName)}</strong> audit: <strong>${esc(fw.nextAuditDate)}</strong>${fw.auditFirm ? ` &nbsp;·&nbsp; Auditor: ${esc(fw.auditFirm)}` : ''}</span>
  </div>`).join('\n');
}

function buildKriCard(kri, explanation) {
  const trend = trendArrow(kri.trend);
  const cssClass = kriTrendCssClass(kri);
  const priorText = kri.priorValue !== null && kri.priorValue !== undefined
    ? `${trend} from ${kri.priorValue}${kri.unit} prior quarter`
    : 'Establishing baseline';
  return `
  <div class="kri-card">
    <div class="kri-value-row">
      <span class="kri-value">${esc(kri.value)}</span>
      <span class="kri-unit">${esc(kri.unit)}</span>
      <span class="kri-trend ${cssClass}">${trend}</span>
    </div>
    <div class="kri-label">${esc(kri.label)}</div>
    <div class="kri-prior">${esc(priorText)}</div>
    <div class="kri-benchmark">${esc(kri.benchmark)}</div>
    <div class="kri-explanation">${esc(explanation || '')}</div>
  </div>`;
}

function buildRiskRows(risks, narratives) {
  const narrativeMap = {};
  for (const n of (narratives || [])) narrativeMap[n.riskId] = n.narrative;

  return risks.map(r => {
    const severityClass = r.severity === 'critical' ? 'critical' : r.severity === 'high' ? 'high' : r.severity === 'medium' ? 'medium' : 'low';
    const narrative = narrativeMap[r.id] || '';
    return `
    <tr>
      <td>
        <div class="risk-title">${esc(r.title)}</div>
        ${narrative ? `<div class="risk-narrative">${esc(narrative)}</div>` : ''}
      </td>
      <td><span class="badge badge-${severityClass}">${esc(r.severityLabel || r.severity)}</span></td>
      <td style="font-size:8.5pt;line-height:1.4">${esc(r.businessImpact)}</td>
      <td style="font-size:8.5pt;line-height:1.4">${esc(r.mitigationStatus)}</td>
      <td class="risk-owner">${esc(r.ownerDisplay || r.owner || '—')}</td>
    </tr>`;
  }).join('\n');
}

function buildCertBadges(frameworks) {
  return frameworks.map(f => `<span class="cert-badge">${esc(f.name || f.shortName)}</span>`).join('');
}

function getNextQuarter(quarter) {
  const q = parseInt(quarter.replace('Q', ''));
  return `Q${q >= 4 ? 1 : q + 1}`;
}

function buildAttentionItems(data, score) {
  const items = [];
  const highRisks = (data.risks.bySeverity.critical || 0) + (data.risks.bySeverity.high || 0);

  if (highRisks > 0) {
    items.push({
      icon: '⚠️',
      title: `${highRisks} High-Severity Risk${highRisks > 1 ? 's' : ''} Open`,
      status: data.risks.open.filter(r => r.severity === 'high' || r.severity === 'critical').map(r => r.title).slice(0, 2).join(' · ') || 'See risk register for details',
    });
  }

  const nonCompliant = data.personnel.nonCompliant;
  if (nonCompliant > 0) {
    items.push({
      icon: '👤',
      title: `${nonCompliant} Employee${nonCompliant > 1 ? 's' : ''} Not Fully Compliant`,
      status: `${data.personnel.complianceRate}% of staff meeting all compliance requirements — ${data.personnel.total - nonCompliant} compliant`,
    });
  }

  const failingControls = data.controls.failing;
  if (failingControls > 0) {
    items.push({
      icon: '🔧',
      title: `${failingControls} Control${failingControls > 1 ? 's' : ''} Require${failingControls === 1 ? 's' : ''} Remediation`,
      status: data.controls.failingList?.slice(0, 2).map(c => c.name).join(' · ') || 'Remediation in progress',
    });
  }

  if (items.length < 3) {
    items.push({
      icon: '✅',
      title: `${data.frameworks.length} Active Compliance Certifications`,
      status: data.frameworks.map(f => f.name).join(' · '),
    });
  }

  return items.slice(0, 3);
}

export async function populateTemplate(data, narratives, kris, score, config = {}) {
  const html = await readFile(TEMPLATE_PATH, 'utf-8');

  const breakdown = calculateScoreBreakdown(data);
  const topRisks = formatRisksForBoard(data.risks);
  const attentionItems = buildAttentionItems(data, score);

  const controlsRate = data.controls.total > 0
    ? Math.round((data.controls.passing / data.controls.total) * 1000) / 10
    : 0;

  const overallScoreTrend = config.priorScore !== null && config.priorScore !== undefined
    ? (score > config.priorScore ? 'up' : score < config.priorScore ? 'down' : 'same')
    : 'same';

  const trendDescription = config.priorScore !== null && config.priorScore !== undefined
    ? `${trendArrow(overallScoreTrend)} ${Math.abs(score - config.priorScore).toFixed(1)} pts from ${config.priorScore} in ${config.priorQuarter || 'prior quarter'}`
    : 'Establishing baseline';

  const kriKeys = ['controlsPassingRate', 'openHighRisks', 'vendorHighRisk', 'personnelCompliance', 'policyAcceptance'];
  const kriCards = kriKeys.map((k, i) => buildKriCard(kris[k], narratives.kriExplanations?.[k]));

  const personnelRate = data.personnel.complianceRate;
  const personnelBarClass = personnelRate >= 90 ? 'green' : personnelRate >= 75 ? 'amber' : 'red';

  const reportDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  const highRisks = (data.risks.bySeverity.critical || 0) + (data.risks.bySeverity.high || 0);

  const decisionsHtml = (narratives.decisionsNeeded || '')
    .replace(/^(\d+)\.\s+\*\*(.+?)\*\*/gm, '<li><strong>$2</strong>')
    .replace(/^\d+\.\s+/gm, '<li>');

  const decisionsWrapped = narratives.decisionsNeeded?.includes('<li>')
    ? `<ol>${decisionsHtml}</ol>`
    : narratives.decisionsNeeded || '';

  const replacements = {
    '{{COMPANY_NAME}}': esc(config.companyName || data.company?.name || 'Your Company'),
    '{{REPORT_QUARTER}}': esc(config.quarter || 'Q3'),
    '{{REPORT_YEAR}}': esc(String(config.year || new Date().getFullYear())),
    '{{REPORT_DATE}}': esc(reportDate),
    '{{POSTURE_SCORE}}': esc(String(score)),
    '{{SCORE_COLOR_CLASS}}': scoreColor(score),
    '{{TREND_ARROW}}': trendArrow(overallScoreTrend),
    '{{TREND_CSS_CLASS}}': trendCssClass(overallScoreTrend),
    '{{TREND_DESCRIPTION}}': esc(trendDescription),
    '{{EXECUTIVE_SUMMARY}}': esc(narratives.executiveSummary || ''),
    '{{ATTENTION_1_ICON}}': esc(attentionItems[0]?.icon || '⚠️'),
    '{{ATTENTION_1_TITLE}}': esc(attentionItems[0]?.title || ''),
    '{{ATTENTION_1_STATUS}}': esc(attentionItems[0]?.status || ''),
    '{{ATTENTION_2_ICON}}': esc(attentionItems[1]?.icon || '👤'),
    '{{ATTENTION_2_TITLE}}': esc(attentionItems[1]?.title || ''),
    '{{ATTENTION_2_STATUS}}': esc(attentionItems[1]?.status || ''),
    '{{ATTENTION_3_ICON}}': esc(attentionItems[2]?.icon || '✅'),
    '{{ATTENTION_3_TITLE}}': esc(attentionItems[2]?.title || ''),
    '{{ATTENTION_3_STATUS}}': esc(attentionItems[2]?.status || ''),
    '{{BREAKDOWN_CONTROLS_SCORE}}': esc(String(breakdown.controls.score)),
    '{{BREAKDOWN_RISKS_SCORE}}': esc(String(breakdown.risks.score)),
    '{{BREAKDOWN_PERSONNEL_SCORE}}': esc(String(breakdown.personnel.score)),
    '{{BREAKDOWN_POLICIES_SCORE}}': esc(String(breakdown.policies.score)),
    '{{BREAKDOWN_VENDORS_SCORE}}': esc(String(breakdown.vendors.score)),
    '{{FRAMEWORK_COUNT}}': esc(String(data.frameworks.length)),
    '{{FRAMEWORK_CARDS}}': buildFrameworkCards(data.frameworks, data.controls),
    '{{CONTROLS_PASSING_TOTAL}}': esc(String(data.controls.passing)),
    '{{CONTROLS_TOTAL}}': esc(String(data.controls.total)),
    '{{CONTROLS_PASSING_RATE}}': esc(String(controlsRate)),
    '{{TESTS_PASSING}}': esc(String(data.tests.passing)),
    '{{TESTS_TOTAL}}': esc(String(data.tests.total)),
    '{{AUDIT_CALLOUTS}}': buildAuditCallouts(data.frameworks),
    '{{KRI_CARD_1}}': kriCards[0] || '',
    '{{KRI_CARD_2}}': kriCards[1] || '',
    '{{KRI_CARD_3}}': kriCards[2] || '',
    '{{KRI_CARD_4}}': kriCards[3] || '',
    '{{KRI_CARD_5}}': kriCards[4] || '',
    '{{HIGH_RISKS}}': esc(String(highRisks)),
    '{{MEDIUM_RISKS}}': esc(String(data.risks.bySeverity.medium || 0)),
    '{{LOW_RISKS}}': esc(String(data.risks.bySeverity.low || 0)),
    '{{RISK_ROWS}}': buildRiskRows(topRisks, narratives.riskNarratives),
    '{{RISK_SUMMARY_SENTENCE}}': esc(`${data.risks.open.length} open risks tracked — ${highRisks} high or critical severity requiring prioritized remediation before the next compliance review.`),
    '{{PROGRAM_PROGRESS_NARRATIVE}}': esc(narratives.programProgress || ''),
    '{{CONTROLS_FIXED}}': esc(String(config.controlsFixed || data.controls.passing)),
    '{{VENDORS_REVIEWED}}': esc(String(data.vendors.total - (data.vendors.byRiskTier.high || 0))),
    '{{POLICIES_ACTIVE}}': esc(String(data.policies.total)),
    '{{PERSONNEL_COMPLIANT}}': esc(String(data.personnel.compliant)),
    '{{VENDOR_TOTAL}}': esc(String(data.vendors.total)),
    '{{VENDOR_HIGH}}': esc(String(data.vendors.byRiskTier.high || 0)),
    '{{VENDOR_MEDIUM}}': esc(String(data.vendors.byRiskTier.medium || 0)),
    '{{VENDOR_LOW}}': esc(String(data.vendors.byRiskTier.low || 0)),
    '{{HIGH_RISK_VENDOR_NAMES}}': data.vendors.highRiskVendors.map(v => `<span>${esc(v.name)}</span>`).join(''),
    '{{PERSONNEL_TOTAL}}': esc(String(data.personnel.total)),
    '{{PERSONNEL_COMPLIANCE_RATE}}': esc(String(data.personnel.complianceRate)),
    '{{PERSONNEL_NON_COMPLIANT}}': esc(String(data.personnel.nonCompliant)),
    '{{PERSONNEL_BAR_CLASS}}': personnelBarClass,
    '{{DECISIONS_NEEDED_NARRATIVE}}': narratives.decisionsNeeded || '',
    '{{NEXT_QUARTER}}': esc(getNextQuarter(config.quarter || 'Q3')),
    '{{FRAMEWORK_CERT_BADGES}}': buildCertBadges(data.frameworks),
    '{{FRAMEWORK_LIST}}': esc(data.frameworks.map(f => f.name).join(', ')),
  };

  let result = html;
  for (const [placeholder, value] of Object.entries(replacements)) {
    result = result.split(placeholder).join(value);
  }

  return result;
}

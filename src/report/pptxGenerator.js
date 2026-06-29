import PptxGenJS from 'pptxgenjs';
import { formatRisksForBoard, formatFrameworkStatus } from '../data/transformer.js';
import { calculateScoreBreakdown } from '../data/scorer.js';
import logger from '../utils/logger.js';

const NAVY = '0F4C81';
const TEAL = '00A67E';
const WHITE = 'FFFFFF';
const LIGHT_GRAY = 'F8F9FA';
const TEXT = '1A1A2E';
const MUTED = '6B7280';
const RED = 'EF4444';
const AMBER = 'F59E0B';
const GREEN = '10B981';
const BORDER = 'E5E7EB';

function scoreColor(score) {
  if (score >= 80) return GREEN;
  if (score >= 60) return AMBER;
  return RED;
}

function trendArrow(trend) {
  if (trend === 'up') return '↑';
  if (trend === 'down') return '↓';
  return '→';
}

function addPageHeader(slide, companyName, pageTitle, quarter, year) {
  slide.addShape('rect', { x: 0, y: 0, w: 10, h: 0.85, fill: { color: NAVY } });
  slide.addText(companyName, {
    x: 0.25, y: 0.05, w: 6, h: 0.35,
    color: WHITE, fontSize: 14, bold: true, fontFace: 'Calibri',
  });
  slide.addText(pageTitle, {
    x: 0.25, y: 0.42, w: 6, h: 0.3,
    color: 'CCDDEE', fontSize: 11, fontFace: 'Calibri',
  });
  const qLabel = `${quarter} ${year}`;
  slide.addText(qLabel, {
    x: 7.8, y: 0.08, w: 2, h: 0.28,
    color: WHITE, fontSize: 10, bold: true, align: 'right', fontFace: 'Calibri',
  });
  slide.addText('CONFIDENTIAL', {
    x: 7.8, y: 0.42, w: 2, h: 0.25,
    color: 'AABBCC', fontSize: 8, align: 'right', fontFace: 'Calibri',
  });
}

function addFooter(slide, companyName, quarter, year, pageNum) {
  slide.addShape('line', {
    x: 0.25, y: 7.1, w: 9.5, h: 0,
    line: { color: BORDER, width: 0.5 },
  });
  slide.addText(`${companyName} — CONFIDENTIAL`, {
    x: 0.25, y: 7.15, w: 3.5, h: 0.25,
    color: MUTED, fontSize: 7.5, fontFace: 'Calibri',
  });
  slide.addText(`Page ${pageNum} of 6`, {
    x: 4, y: 7.15, w: 2, h: 0.25,
    color: MUTED, fontSize: 7.5, align: 'center', fontFace: 'Calibri',
  });
  slide.addText(`${quarter} ${year}`, {
    x: 6.5, y: 7.15, w: 3.25, h: 0.25,
    color: MUTED, fontSize: 7.5, align: 'right', fontFace: 'Calibri',
  });
}

export async function generatePPTX(data, narratives, kris, score, outputPath, config = {}) {
  logger.info('Building PowerPoint presentation...');

  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE';
  pptx.author = 'Vanta Board Report Generator';
  pptx.subject = `${config.quarter} ${config.year} Security Report`;
  pptx.title = `${config.companyName} Board Cybersecurity Report`;

  const company = config.companyName || data.company?.name || 'Your Company';
  const quarter = config.quarter || 'Q3';
  const year = String(config.year || new Date().getFullYear());
  const breakdown = calculateScoreBreakdown(data);

  // ─── SLIDE 1: Executive Risk Summary ───
  {
    const slide = pptx.addSlide();
    addPageHeader(slide, company, 'Board Cybersecurity & Compliance Report', quarter, year);

    const color = scoreColor(score);
    const scoreX = 0.3;
    const scoreY = 1.0;

    slide.addShape('ellipse', {
      x: scoreX, y: scoreY, w: 2.2, h: 2.2,
      fill: { color: color, transparency: 85 },
      line: { color, width: 3 },
    });
    slide.addText(String(score), {
      x: scoreX, y: scoreY + 0.45, w: 2.2, h: 1,
      color, fontSize: 48, bold: true, align: 'center', fontFace: 'Calibri',
    });
    slide.addText('/ 100', {
      x: scoreX, y: scoreY + 1.5, w: 2.2, h: 0.35,
      color: MUTED, fontSize: 11, align: 'center', fontFace: 'Calibri',
    });

    const priorScore = config.priorScore;
    const trendText = priorScore !== null && priorScore !== undefined
      ? `${trendArrow(score > priorScore ? 'up' : score < priorScore ? 'down' : 'same')} ${Math.abs(score - priorScore).toFixed(1)} pts from ${priorScore} last quarter`
      : 'Establishing baseline this quarter';

    slide.addText('Security Posture Score', {
      x: 2.8, y: 1.0, w: 7, h: 0.4,
      color: NAVY, fontSize: 16, bold: true, fontFace: 'Calibri',
    });
    slide.addText(trendText, {
      x: 2.8, y: 1.45, w: 7, h: 0.35,
      color: MUTED, fontSize: 11, fontFace: 'Calibri',
    });

    slide.addText(narratives.executiveSummary || '', {
      x: 2.8, y: 1.9, w: 7, h: 1.2,
      color: TEXT, fontSize: 11, fontFace: 'Calibri', wrap: true,
    });

    const highRisks = (data.risks.bySeverity.critical || 0) + (data.risks.bySeverity.high || 0);
    const attnItems = [
      { icon: '⚠', text: `${highRisks} High-Severity Risks Open`, sub: 'See risk register for details' },
      { icon: '👤', text: `Personnel Compliance: ${data.personnel.complianceRate}%`, sub: `${data.personnel.nonCompliant} employees with open items` },
      { icon: '✅', text: `${data.frameworks.length} Active Certifications`, sub: data.frameworks.map(f => f.name).join(' · ') },
    ];

    attnItems.forEach((item, i) => {
      const y = 3.25 + i * 0.72;
      slide.addShape('rect', { x: 2.8, y, w: 7, h: 0.6, fill: { color: LIGHT_GRAY }, line: { color: BORDER, width: 0.5 } });
      slide.addShape('rect', { x: 2.8, y, w: 0.07, h: 0.6, fill: { color: NAVY } });
      slide.addText(`${item.text}`, {
        x: 3.05, y: y + 0.04, w: 6.5, h: 0.28,
        color: NAVY, fontSize: 10.5, bold: true, fontFace: 'Calibri',
      });
      slide.addText(item.sub, {
        x: 3.05, y: y + 0.3, w: 6.5, h: 0.25,
        color: MUTED, fontSize: 9, fontFace: 'Calibri',
      });
    });

    const bdItems = [
      { label: 'Controls', score: breakdown.controls.score, max: 40 },
      { label: 'Risk Exposure', score: breakdown.risks.score, max: 20 },
      { label: 'Personnel', score: breakdown.personnel.score, max: 20 },
      { label: 'Policies', score: breakdown.policies.score, max: 10 },
      { label: 'Vendors', score: breakdown.vendors.score, max: 10 },
    ];

    slide.addShape('rect', { x: 0.3, y: 5.5, w: 9.5, h: 1.3, fill: { color: LIGHT_GRAY }, line: { color: BORDER, width: 0.5 } });
    slide.addText('SCORE BREAKDOWN', { x: 0.45, y: 5.55, w: 3, h: 0.25, color: MUTED, fontSize: 7.5, bold: true, charSpacing: 1, fontFace: 'Calibri' });

    bdItems.forEach((bd, i) => {
      const x = 0.45 + i * 1.87;
      slide.addText(`${bd.score}`, { x, y: 5.82, w: 1.8, h: 0.4, color: NAVY, fontSize: 22, bold: true, align: 'center', fontFace: 'Calibri' });
      slide.addText(`/${bd.max}`, { x, y: 6.0, w: 1.8, h: 0.25, color: MUTED, fontSize: 10, align: 'center', fontFace: 'Calibri' });
      slide.addText(bd.label, { x, y: 6.27, w: 1.8, h: 0.2, color: MUTED, fontSize: 8, align: 'center', fontFace: 'Calibri' });
    });

    addFooter(slide, company, quarter, year, 1);
  }

  // ─── SLIDE 2: Compliance Framework Status ───
  {
    const slide = pptx.addSlide();
    addPageHeader(slide, company, 'Compliance Status', quarter, year);

    const fwStatus = formatFrameworkStatus(data.frameworks, data.controls);
    const controlsRate = data.controls.total > 0
      ? Math.round((data.controls.passing / data.controls.total) * 1000) / 10
      : 0;

    slide.addText(`${company} maintains active certifications across ${data.frameworks.length} compliance frameworks`, {
      x: 0.3, y: 0.95, w: 9.5, h: 0.3, color: MUTED, fontSize: 10, fontFace: 'Calibri',
    });

    fwStatus.forEach((fw, i) => {
      const y = 1.35 + i * 1.55;
      const fillColor = fw.rate >= 90 ? GREEN : fw.rate >= 70 ? AMBER : RED;
      const statusColor = fw.status === 'PASSING' ? GREEN : fw.status === 'NEEDS ATTENTION' ? AMBER : RED;

      slide.addShape('rect', { x: 0.3, y, w: 9.5, h: 1.35, fill: { color: LIGHT_GRAY }, line: { color: BORDER, width: 0.5 } });
      slide.addShape('rect', { x: 0.3, y, w: 1.8, h: 0.35, fill: { color: TEAL } });
      slide.addText(fw.name, { x: 0.35, y: y + 0.04, w: 1.7, h: 0.27, color: WHITE, fontSize: 9, bold: true, fontFace: 'Calibri' });

      slide.addShape('rect', { x: 7.8, y: y + 0.04, w: 2, h: 0.27, fill: { color: statusColor, transparency: 85 } });
      slide.addText(fw.status, { x: 7.8, y: y + 0.04, w: 2, h: 0.27, color: statusColor, fontSize: 8, bold: true, align: 'center', fontFace: 'Calibri' });

      slide.addText(`${fw.passing} of ${fw.total} controls passing`, { x: 0.35, y: y + 0.42, w: 4, h: 0.25, color: TEXT, fontSize: 9.5, fontFace: 'Calibri' });
      slide.addText(`${fw.rate}%`, { x: 8.8, y: y + 0.42, w: 1, h: 0.25, color: TEXT, fontSize: 9.5, bold: true, align: 'right', fontFace: 'Calibri' });

      slide.addShape('rect', { x: 0.35, y: y + 0.72, w: 9.1, h: 0.22, fill: { color: BORDER } });
      slide.addShape('rect', { x: 0.35, y: y + 0.72, w: 9.1 * (fw.rate / 100), h: 0.22, fill: { color: fillColor } });

      if (fw.nextAuditDate) {
        slide.addText(`Next audit: ${fw.nextAuditDate}`, { x: 0.35, y: y + 1.02, w: 4.5, h: 0.22, color: MUTED, fontSize: 8.5, fontFace: 'Calibri' });
      }
    });

    const sumY = 1.35 + fwStatus.length * 1.55;
    slide.addShape('rect', { x: 0.3, y: sumY, w: 9.5, h: 1.1, fill: { color: NAVY } });
    const sumStats = [
      { val: `${data.controls.passing}/${data.controls.total}`, label: `Controls Passing (${controlsRate}%)` },
      { val: `${data.tests.passing}/${data.tests.total}`, label: 'Automated Tests Passing' },
      { val: String(data.frameworks.length), label: 'Active Frameworks' },
    ];
    sumStats.forEach((s, i) => {
      const x = 0.7 + i * 3.1;
      slide.addText(s.val, { x, y: sumY + 0.12, w: 2.8, h: 0.55, color: WHITE, fontSize: 26, bold: true, align: 'center', fontFace: 'Calibri' });
      slide.addText(s.label, { x, y: sumY + 0.7, w: 2.8, h: 0.25, color: 'AABBCC', fontSize: 8.5, align: 'center', fontFace: 'Calibri' });
    });

    addFooter(slide, company, quarter, year, 2);
  }

  // ─── SLIDE 3: Key Risk Indicators ───
  {
    const slide = pptx.addSlide();
    addPageHeader(slide, company, 'Security Performance Dashboard', quarter, year);

    slide.addText('Five key metrics updated as of ' + new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }), {
      x: 0.3, y: 0.95, w: 9.5, h: 0.3, color: MUTED, fontSize: 10, fontFace: 'Calibri',
    });

    const kriKeys = ['controlsPassingRate', 'openHighRisks', 'vendorHighRisk', 'personnelCompliance', 'policyAcceptance'];
    const positions = [
      { x: 0.3, y: 1.35, w: 4.55 },
      { x: 5.1, y: 1.35, w: 4.7 },
      { x: 0.3, y: 4.0, w: 2.95 },
      { x: 3.5, y: 4.0, w: 2.95 },
      { x: 6.7, y: 4.0, w: 3.1 },
    ];

    kriKeys.forEach((key, i) => {
      const kri = kris[key];
      const pos = positions[i];
      const h = i < 2 ? 2.5 : 2.9;
      const explanation = narratives.kriExplanations?.[key] || '';
      const trendColor = kri.trend === 'up' ? GREEN : kri.trend === 'down' ? RED : MUTED;
      const arrow = trendArrow(kri.trend);
      const priorText = kri.priorValue !== null && kri.priorValue !== undefined
        ? `${arrow} from ${kri.priorValue}${kri.unit} prior quarter`
        : 'Establishing baseline';

      slide.addShape('rect', { x: pos.x, y: pos.y, w: pos.w, h, fill: { color: LIGHT_GRAY }, line: { color: BORDER, width: 0.5 } });
      slide.addText(`${kri.value}${kri.unit}`, { x: pos.x + 0.1, y: pos.y + 0.1, w: pos.w - 0.5, h: 0.7, color: NAVY, fontSize: i < 2 ? 32 : 26, bold: true, fontFace: 'Calibri' });
      slide.addText(arrow, { x: pos.x + pos.w - 0.45, y: pos.y + 0.1, w: 0.35, h: 0.45, color: trendColor, fontSize: 20, bold: true, align: 'right', fontFace: 'Calibri' });
      slide.addText(kri.label, { x: pos.x + 0.1, y: pos.y + 0.82, w: pos.w - 0.2, h: 0.3, color: TEXT, fontSize: i < 2 ? 10 : 9, bold: true, fontFace: 'Calibri' });
      slide.addText(priorText, { x: pos.x + 0.1, y: pos.y + 1.15, w: pos.w - 0.2, h: 0.25, color: MUTED, fontSize: 8.5, fontFace: 'Calibri' });
      slide.addText(kri.benchmark, { x: pos.x + 0.1, y: pos.y + 1.42, w: pos.w - 0.2, h: 0.25, color: TEAL, fontSize: 8.5, bold: true, fontFace: 'Calibri' });
      if (explanation) {
        slide.addShape('line', { x: pos.x + 0.1, y: pos.y + 1.72, w: pos.w - 0.2, h: 0, line: { color: BORDER, width: 0.5 } });
        slide.addText(explanation, { x: pos.x + 0.1, y: pos.y + 1.8, w: pos.w - 0.2, h: h - 1.9, color: MUTED, fontSize: 8, wrap: true, fontFace: 'Calibri' });
      }
    });

    addFooter(slide, company, quarter, year, 3);
  }

  // ─── SLIDE 4: Risk Register ───
  {
    const slide = pptx.addSlide();
    addPageHeader(slide, company, 'Top Risks Requiring Board Awareness', quarter, year);

    const highRisks = (data.risks.bySeverity.critical || 0) + (data.risks.bySeverity.high || 0);
    const topRisks = formatRisksForBoard(data.risks);
    const narrativeMap = {};
    for (const n of (narratives.riskNarratives || [])) narrativeMap[n.riskId] = n.narrative;

    const pills = [
      { label: `${highRisks} High Severity`, color: RED },
      { label: `${data.risks.bySeverity.medium || 0} Medium Severity`, color: AMBER },
      { label: `${data.risks.bySeverity.low || 0} Low Severity`, color: MUTED },
    ];
    pills.forEach((p, i) => {
      slide.addShape('rect', { x: 0.3 + i * 2.8, y: 0.97, w: 2.5, h: 0.33, fill: { color: p.color, transparency: 85 }, line: { color: p.color, width: 0.5 } });
      slide.addText(p.label, { x: 0.3 + i * 2.8, y: 0.97, w: 2.5, h: 0.33, color: p.color, fontSize: 9, bold: true, align: 'center', fontFace: 'Calibri' });
    });

    const tableY = 1.4;
    slide.addShape('rect', { x: 0.3, y: tableY, w: 9.5, h: 0.35, fill: { color: NAVY } });
    const headers = ['Risk', 'Severity', 'Business Impact', 'Status', 'Owner'];
    const colW = [2.8, 0.9, 2.8, 2.2, 0.8];
    let cx = 0.35;
    headers.forEach((h, i) => {
      slide.addText(h, { x: cx, y: tableY + 0.05, w: colW[i], h: 0.25, color: WHITE, fontSize: 8.5, bold: true, fontFace: 'Calibri' });
      cx += colW[i];
    });

    topRisks.forEach((risk, ri) => {
      const rowH = 1.0;
      const rowY = tableY + 0.35 + ri * rowH;
      const rowBg = ri % 2 === 0 ? WHITE : LIGHT_GRAY;
      slide.addShape('rect', { x: 0.3, y: rowY, w: 9.5, h: rowH, fill: { color: rowBg }, line: { color: BORDER, width: 0.3 } });

      const sevColor = risk.severity === 'critical' ? '450A0A' : risk.severity === 'high' ? RED : risk.severity === 'medium' ? AMBER : MUTED;
      const narrative = narrativeMap[risk.id] || '';

      slide.addText(risk.title, { x: 0.35, y: rowY + 0.04, w: 2.7, h: 0.25, color: TEXT, fontSize: 8.5, bold: true, fontFace: 'Calibri' });
      if (narrative) {
        slide.addText(narrative, { x: 0.35, y: rowY + 0.3, w: 2.7, h: 0.6, color: MUTED, fontSize: 7.5, wrap: true, italic: true, fontFace: 'Calibri' });
      }

      slide.addShape('rect', { x: 3.2, y: rowY + 0.08, w: 0.75, h: 0.22, fill: { color: sevColor, transparency: 85 } });
      slide.addText(risk.severity.toUpperCase(), { x: 3.2, y: rowY + 0.08, w: 0.75, h: 0.22, color: sevColor, fontSize: 7, bold: true, align: 'center', fontFace: 'Calibri' });

      slide.addText(risk.businessImpact || '', { x: 4.1, y: rowY + 0.04, w: 2.75, h: 0.9, color: TEXT, fontSize: 8, wrap: true, fontFace: 'Calibri' });
      slide.addText(risk.mitigationStatus || '', { x: 6.9, y: rowY + 0.04, w: 2.15, h: 0.9, color: MUTED, fontSize: 7.5, wrap: true, fontFace: 'Calibri' });
      slide.addText((risk.ownerDisplay || risk.owner || '—').split('@')[0], { x: 9.1, y: rowY + 0.04, w: 0.65, h: 0.25, color: MUTED, fontSize: 7.5, fontFace: 'Calibri' });
    });

    const sumY = tableY + 0.35 + topRisks.length * 1.0 + 0.1;
    slide.addShape('rect', { x: 0.3, y: sumY, w: 9.5, h: 0.38, fill: { color: NAVY } });
    slide.addText(`${data.risks.open.length} open risks tracked — ${highRisks} high or critical severity requiring prioritized remediation before the next compliance review`, {
      x: 0.4, y: sumY + 0.05, w: 9.3, h: 0.28, color: WHITE, fontSize: 9, align: 'center', fontFace: 'Calibri',
    });

    addFooter(slide, company, quarter, year, 4);
  }

  // ─── SLIDE 5: Program Progress ───
  {
    const slide = pptx.addSlide();
    addPageHeader(slide, company, 'Security Program Progress', quarter, year);

    slide.addText(`${quarter} ${year} Accomplishments`, {
      x: 0.3, y: 0.95, w: 9.5, h: 0.28, color: MUTED, fontSize: 10, fontFace: 'Calibri',
    });

    slide.addShape('rect', { x: 0.3, y: 1.3, w: 9.5, h: 1.5, fill: { color: LIGHT_GRAY }, line: { color: TEAL, width: 2 } });
    slide.addText(narratives.programProgress || '', {
      x: 0.45, y: 1.38, w: 9.2, h: 1.38, color: TEXT, fontSize: 10.5, wrap: true, fontFace: 'Calibri',
    });

    const metrics = [
      { val: String(data.controls.passing), label: 'Controls Passing' },
      { val: String(data.vendors.total), label: 'Vendors Monitored' },
      { val: String(data.policies.total), label: 'Active Policies' },
      { val: String(data.personnel.compliant), label: 'Compliant Employees' },
    ];
    metrics.forEach((m, i) => {
      const x = 0.3 + i * 2.4;
      slide.addShape('rect', { x, y: 2.95, w: 2.2, h: 1.0, fill: { color: WHITE }, line: { color: BORDER, width: 0.5 } });
      slide.addText(m.val, { x, y: 3.05, w: 2.2, h: 0.55, color: NAVY, fontSize: 26, bold: true, align: 'center', fontFace: 'Calibri' });
      slide.addText(m.label, { x, y: 3.63, w: 2.2, h: 0.25, color: MUTED, fontSize: 8.5, align: 'center', fontFace: 'Calibri' });
    });

    slide.addShape('rect', { x: 0.3, y: 4.1, w: 9.5, h: 1.0, fill: { color: LIGHT_GRAY }, line: { color: BORDER, width: 0.5 } });
    slide.addText('Vendor Risk Overview', { x: 0.45, y: 4.15, w: 3, h: 0.28, color: TEXT, fontSize: 10, bold: true, fontFace: 'Calibri' });
    const vendorPills = [
      { val: data.vendors.byRiskTier.high || 0, label: 'High Risk', color: RED },
      { val: data.vendors.byRiskTier.medium || 0, label: 'Medium Risk', color: AMBER },
      { val: data.vendors.byRiskTier.low || 0, label: 'Low Risk', color: GREEN },
    ];
    vendorPills.forEach((vp, i) => {
      slide.addShape('ellipse', { x: 0.45 + i * 1.8, y: 4.5, w: 0.22, h: 0.22, fill: { color: vp.color } });
      slide.addText(`${vp.val} ${vp.label}`, { x: 0.72 + i * 1.8, y: 4.5, w: 1.5, h: 0.22, color: TEXT, fontSize: 9, fontFace: 'Calibri' });
    });
    const hrNames = data.vendors.highRiskVendors.map(v => v.name).join(', ');
    slide.addText(`High-risk: ${hrNames}`, { x: 0.45, y: 4.77, w: 9, h: 0.25, color: MUTED, fontSize: 8.5, fontFace: 'Calibri' });

    slide.addShape('rect', { x: 0.3, y: 5.25, w: 9.5, h: 1.0, fill: { color: LIGHT_GRAY }, line: { color: BORDER, width: 0.5 } });
    slide.addText('Personnel Compliance', { x: 0.45, y: 5.3, w: 4, h: 0.28, color: TEXT, fontSize: 10, bold: true, fontFace: 'Calibri' });
    slide.addText(`${data.personnel.compliant}/${data.personnel.total} (${data.personnel.complianceRate}%)`, { x: 7, y: 5.3, w: 2.7, h: 0.28, color: NAVY, fontSize: 10, bold: true, align: 'right', fontFace: 'Calibri' });
    slide.addShape('rect', { x: 0.45, y: 5.65, w: 9.1, h: 0.28, fill: { color: BORDER } });
    const barColor = data.personnel.complianceRate >= 90 ? GREEN : AMBER;
    slide.addShape('rect', { x: 0.45, y: 5.65, w: 9.1 * (data.personnel.complianceRate / 100), h: 0.28, fill: { color: barColor } });
    slide.addText(`${data.personnel.nonCompliant} employees with open items — tracked to completion`, {
      x: 0.45, y: 5.97, w: 9.1, h: 0.22, color: MUTED, fontSize: 8.5, fontFace: 'Calibri',
    });

    addFooter(slide, company, quarter, year, 5);
  }

  // ─── SLIDE 6: Decisions Needed ───
  {
    const slide = pptx.addSlide();
    addPageHeader(slide, company, 'Board Actions Required', quarter, year);

    slide.addText('Items requiring board awareness, approval, or resource allocation', {
      x: 0.3, y: 0.95, w: 9.5, h: 0.28, color: MUTED, fontSize: 10, fontFace: 'Calibri',
    });

    const decisions = narratives.decisionsNeeded || '';
    slide.addText(decisions, {
      x: 0.3, y: 1.3, w: 9.5, h: 2.4,
      color: TEXT, fontSize: 10.5, wrap: true, fontFace: 'Calibri',
    });

    slide.addShape('rect', { x: 0.3, y: 3.85, w: 9.5, h: 1.5, fill: { color: LIGHT_GRAY }, line: { color: BORDER, width: 0.5 } });
    slide.addText('STANDARD BOARD ACKNOWLEDGMENTS', { x: 0.45, y: 3.9, w: 6, h: 0.25, color: MUTED, fontSize: 7.5, bold: true, charSpacing: 1, fontFace: 'Calibri' });

    const checkItems = [
      `Acknowledge receipt of the ${quarter} ${year} quarterly cybersecurity and compliance report`,
      `Review and approve security budget allocation for the next quarter`,
      `Confirm board cybersecurity oversight responsibility and quarterly engagement frequency`,
    ];
    checkItems.forEach((item, i) => {
      const y = 4.22 + i * 0.37;
      slide.addShape('rect', { x: 0.45, y, w: 0.22, h: 0.22, fill: { color: WHITE }, line: { color: NAVY, width: 1 } });
      slide.addText(item, { x: 0.75, y, w: 8.9, h: 0.22, color: TEXT, fontSize: 9.5, fontFace: 'Calibri' });
    });

    slide.addShape('rect', { x: 0.3, y: 5.5, w: 9.5, h: 1.2, fill: { color: NAVY } });
    slide.addText('ACTIVE COMPLIANCE CERTIFICATIONS', { x: 0.5, y: 5.55, w: 5, h: 0.25, color: 'AABBCC', fontSize: 7.5, bold: true, charSpacing: 1, fontFace: 'Calibri' });

    let certX = 0.5;
    data.frameworks.forEach(fw => {
      slide.addShape('rect', { x: certX, y: 5.85, w: 1.8, h: 0.35, fill: { color: WHITE, transparency: 85 }, line: { color: WHITE, transparency: 70, width: 0.5 } });
      slide.addText(fw.name || fw.shortName, { x: certX, y: 5.85, w: 1.8, h: 0.35, color: WHITE, fontSize: 9.5, bold: true, align: 'center', fontFace: 'Calibri' });
      certX += 1.95;
    });

    slide.addText(`${company} maintains active certifications in: ${data.frameworks.map(f => f.name).join(', ')}`, {
      x: 0.5, y: 6.28, w: 9, h: 0.3, color: 'AABBCC', fontSize: 9, fontFace: 'Calibri',
    });

    addFooter(slide, company, quarter, year, 6);
  }

  await pptx.writeFile({ fileName: outputPath });
  logger.info(`PowerPoint saved: ${outputPath}`);
  return outputPath;
}

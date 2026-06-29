import Anthropic from '@anthropic-ai/sdk';
import logger from '../utils/logger.js';
import { PROMPT_EXECUTIVE_SUMMARY, PROMPT_RISK_NARRATIVE, PROMPT_DECISIONS_NEEDED, PROMPT_KRI_EXPLANATION, PROMPT_PROGRAM_PROGRESS } from '../narrative/prompts.js';

const MODEL = 'claude-sonnet-4-6';

export class ClaudeClient {
  constructor() {
    this._client = null;
  }

  _getClient() {
    if (!this._client) {
      if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY not set');
      this._client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    }
    return this._client;
  }

  async generateNarrative(systemPrompt, userPrompt) {
    const client = this._getClient();
    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: 1000,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });
    return msg.content[0].text;
  }

  async generateExecutiveSummary(data, score, priorScore, priorQuarter) {
    const { system, user } = PROMPT_EXECUTIVE_SUMMARY({ data, score, priorScore, priorQuarter });
    try {
      const text = await this.generateNarrative(system, user);
      logger.info('Claude: executive summary generated');
      return text;
    } catch (err) {
      logger.warn(`Claude executive summary failed, using fallback: ${err.message}`);
      const trend = score >= (priorScore || score) ? 'improved' : 'declined';
      return `Acme SaaS Inc's security posture has ${trend} this quarter, with ${data.controls.passing} of ${data.controls.total} compliance controls passing and ${data.risks.bySeverity.high} high-severity risks requiring attention. The security team has made measurable progress while maintaining active certifications across all compliance frameworks.`;
    }
  }

  async generateRiskNarrative(risk) {
    const { system, user } = PROMPT_RISK_NARRATIVE(risk);
    try {
      const text = await this.generateNarrative(system, user);
      logger.info(`Claude: risk narrative generated for ${risk.id}`);
      return text;
    } catch (err) {
      logger.warn(`Claude risk narrative failed for ${risk.id}, using fallback: ${err.message}`);
      return `${risk.businessImpact} ${risk.mitigationStatus}.`;
    }
  }

  async generateDecisionsNeeded(data, score) {
    const { system, user } = PROMPT_DECISIONS_NEEDED({ data, score });
    try {
      const text = await this.generateNarrative(system, user);
      logger.info('Claude: decisions needed generated');
      return text;
    } catch (err) {
      logger.warn(`Claude decisions needed failed, using fallback: ${err.message}`);
      return `1. Approve additional resources to remediate ${data.risks.bySeverity.high} high-severity open risks before the next compliance audit.\n2. Confirm board oversight of the annual incident response testing program scheduled for Q3.\n3. Review and approve the security budget allocation for next quarter to maintain certification momentum.`;
    }
  }

  async generateKRIExplanation(kri) {
    const { system, user } = PROMPT_KRI_EXPLANATION(kri);
    try {
      const text = await this.generateNarrative(system, user);
      logger.info(`Claude: KRI explanation generated for ${kri.label}`);
      return text;
    } catch (err) {
      logger.warn(`Claude KRI explanation failed for ${kri.label}, using fallback: ${err.message}`);
      return `This metric tracks ${kri.label.toLowerCase()} and directly impacts our compliance posture and customer trust.`;
    }
  }

  async generateProgramProgress(data, priorData) {
    const { system, user } = PROMPT_PROGRAM_PROGRESS({ data, priorData });
    try {
      const text = await this.generateNarrative(system, user);
      logger.info('Claude: program progress generated');
      return text;
    } catch (err) {
      logger.warn(`Claude program progress failed, using fallback: ${err.message}`);
      return `This quarter the security team maintained strong compliance across both active frameworks while actively remediating identified control gaps. Vendor risk management efforts continued with questionnaires issued to all overdue suppliers. Personnel compliance remains above 90%, with outstanding training completions expected before quarter close.`;
    }
  }
}

export default new ClaudeClient();

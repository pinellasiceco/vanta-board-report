# Vanta Board Report Generator

Generate board-ready compliance reports from your Vanta data in under 5 minutes.

## What it produces

- A **6-page PDF board report** — executive summary, compliance status, risk indicators, risk register, program progress, and board actions
- A **6-slide PowerPoint presentation** — mirrors the PDF, ready for screen sharing in board meetings
- Both generated from live Vanta data, with board-ready narrative written by Claude

## Prerequisites

- Node.js 20+
- Vanta account with API credentials (OAuth 2.0)
- Anthropic API key (optional — falls back to template text if not set)

## Quick Start (Mock Mode — No credentials needed)

```bash
npm install
cp .env.example .env
npm start -- generate --mock
# Opens dashboard at http://localhost:3001
```

Click **Generate Board Report** in the dashboard. Reports appear in `data/reports/`.

## Connecting to Real Vanta

1. Go to `app.vanta.com` → Settings → Developer Console
2. Create a new application (type: **Manage Vanta**)
3. Copy `client_id` and `client_secret` to `.env`
4. Set `USE_MOCK_DATA=false` in `.env`
5. Run: `npm start -- generate`

## CLI Usage

```bash
# Generate report with dashboard
npm start -- generate --mock

# Generate CLI-only (no browser)
npm start -- generate --mock --no-dashboard

# Test API credentials
npm start -- test-connection --mock

# View quarterly history
npm start -- history
```

## Report Contents

| Page | Content |
|------|---------|
| 1 | Executive Risk Summary — posture score, trends, top attention items |
| 2 | Compliance Framework Status — per-framework progress bars |
| 3 | Key Risk Indicators — 5 KPI metrics with trend arrows |
| 4 | Risk Register — top 5 risks in business language |
| 5 | Program Progress — accomplishments, vendor summary, personnel compliance |
| 6 | Board Actions Required — decisions needed, standard acknowledgments |

## Quarterly Cadence

Run once per quarter before your board meeting. The tool tracks trends quarter-over-quarter automatically — each run saves state and the next run shows delta from the prior period.

## Environment Variables

See `.env.example` for all configuration options.

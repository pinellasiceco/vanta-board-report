# Publishing to the Vanta Integration Marketplace

## Overview

Publishing this tool as a Vanta public integration allows any of Vanta's 15,000+ customers to install it directly from the Vanta integrations page.

## Steps

1. Apply at `developer.vanta.com/partner`
2. Get approved as a Vanta technology partner
3. Receive sandbox tenant for testing
4. Convert private integration to public OAuth flow
5. Submit for marketplace review
6. Get listed under "Reporting & Analytics" category

## What changes for marketplace version

- OAuth flow becomes multi-tenant (customers authorize YOUR app to read THEIR Vanta)
- Credentials stored per-customer, not in `.env`
- Backend needed to host the OAuth callback
- Reports generated server-side and emailed/downloaded by the customer

## Revenue model options

- $99/report (one-time, no commitment)
- $199/month (quarterly reports + history + trend analysis)
- Partner bundle (included with GRC Migrate consulting)

## Timeline

- Build and test: complete
- Partner application: 1–2 weeks for approval
- Marketplace listing: 2–4 weeks after approval

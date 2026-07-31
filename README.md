<p align="center">
  <img src="assets/tally-financial-os-logo.svg" alt="Tally Financial OS" width="760">
</p>

# Tally Financial OS MCP

**AI-powered finance operations for TallyPrime — connected to Claude.**

Tally Financial OS turns Claude into a company-aware finance assistant that can read Tally data, understand the active company structure, analyse financial information, prepare accounting entries, require approval, and write approved vouchers back to TallyPrime.

It is designed for companies from approximately **₹10 crore to ₹1,000 crore** in annual scale. It can help reduce manual finance work, duplicate payments, missed collections, excess inventory, reporting delays, and avoidable accounting errors. Actual savings depend on the company’s processes, controls, transaction volume, and adoption; this software does not guarantee a particular saving or revenue increase.

<p align="center">
  <img src="assets/architecture.svg" alt="Tally Financial OS architecture" width="100%">
</p>

## What it does

### Read and analyse

Ask Claude questions such as:

- “Show customers overdue by more than ₹10 lakh.”
- “Compare this quarter’s expenses with last quarter.”
- “Which stock items are slow-moving?”
- “Analyse the company’s profit and loss and explain the largest changes.”
- “Find unusual ledger transactions.”
- “Show the current company’s ledgers, groups, voucher types, stock items, units and godowns.”

The original reporting tools remain available: company and master lookup, collection queries, SQL analysis, chart of accounts, trial balance, profit and loss, balance sheet, stock reports, outstanding bills, ledger statements, and stock-item statements.

### Company-aware write workflow

The write layer is deliberately controlled:

```text
Read company profile
  → Create draft
  → Validate against that company’s masters
  → Preview
  → Owner/authorised user approves
  → Post to Tally
  → Verify active company before writing
```

Available write workflow tools:

- `company-profile` — reads the open company’s ledgers, groups, voucher types, stock items, units and godowns.
- `voucher-draft-create` — validates voucher type, ledger names, date, amounts, and debit/credit balance without posting.
- `voucher-draft-preview` — shows the proposed entry before posting.
- `voucher-draft-approve` — explicit approval step.
- `voucher-draft-post` — writes the approved voucher only after rechecking that the same company is active.
- `voucher-draft-discard` — removes an unposted draft.
- `voucher-drafts-list` — lists drafts held by the connector process.
- `ledger-create-update` — original ledger master write capability.
- `delete-master` — original destructive master deletion capability; use carefully.

<p align="center">
  <img src="assets/workflow.svg" alt="Bill to verified Tally entry workflow" width="100%">
</p>

## How it can help a company

| Area | Manual method | With Tally Financial OS |
|---|---|---|
| Reporting | Export, clean, reconcile, prepare manually | Ask Claude and analyse current Tally data |
| Receivables | Periodic spreadsheet follow-up | Find overdue and high-value receivables quickly |
| Payables | Manual invoice review | Search, compare, and investigate duplicate or unusual entries |
| Inventory | Spreadsheet or delayed reports | Query stock, ageing, movement, and valuation data |
| Data entry | Re-key bills into Tally | Prepare validated voucher drafts for approval |
| Management decisions | Wait for MIS reports | Ask questions against current company data |
| Controls | Human memory and checklists | Company context, master validation, preview and approval workflow |

Possible outcomes include reduced finance-team workload, earlier collections, less working capital blocked in stock, fewer duplicate or incorrect entries, and faster management decisions. Measure results against your current baseline before making financial claims.

## Requirements

- TallyPrime Silver or Gold
- TallyPrime running on the customer computer or server
- Tally XML server enabled
- Tally configured as **Server**
- Default Tally XML port: `9000`
- Claude Desktop with MCP extension support
- Node.js is bundled/used by the extension package

Tally must be running and its XML server must be reachable. The company must be available in Tally; the extension reads the active company and refuses company-mismatched posting. Tally does not necessarily need to be the foreground window, but the Tally process and XML server must be available.

## One-click installation in Claude Desktop

1. Download the latest `.mcpb` file from the repository’s **Releases** page.
2. Open Claude Desktop.
3. Open **Settings → Extensions**.
4. Choose **Advanced settings** if shown.
5. Select **Install extension**.
6. Choose `tally-prime-financial-os.mcpb`.
7. Confirm installation.
8. Start TallyPrime and enable its XML server on port `9000`.
9. Open the company you want to use.
10. In Claude, enable **Tally Prime Financial OS** under tools/extensions.
11. Ask Claude to run `company-profile` first.

Before posting any entry, review the draft and explicitly approve it. Do not give approval for an entry that has not been checked.

## Manual installation in Claude Desktop

1. Download and extract the release ZIP, or clone/download this repository.
2. Install Node.js 20 or newer.
3. From the project directory, run:

```bash
npm ci
npm run build
```

4. Configure Claude Desktop’s MCP configuration file:

```json
{
  "mcpServers": {
    "Tally Financial OS": {
      "command": "node",
      "args": ["/absolute/path/to/tally-financial-os-mcp/dist/index.mjs"]
    }
  }
}
```

5. Replace the path with the actual absolute path.
6. Restart Claude Desktop.
7. Start TallyPrime and confirm the XML server is reachable.

## Build the one-click MCPB installer

```bash
npm ci
npm run test
npm run package:mcpb
```

The package is generated at:

```text
dist/tally-prime-financial-os.mcpb
```

## TallyPrime setup

In TallyPrime, enable the XML/API server from the connectivity settings and configure:

```text
TallyPrime acts as: Server
Port: 9000
```

Test locally:

```bash
curl http://localhost:9000
```

A running Tally XML server should return a Tally server response. If Claude reports a connection problem, check that Tally is running, the correct company is open/available, the XML server is enabled, and another application is not using the configured port.

## Security and commercial deployment

- Do not expose Tally’s unauthenticated XML port directly to the public internet.
- Use a customer-side local connector or secure outbound tunnel for remote Claude access.
- Use backups before enabling any write or delete operation.
- Use the draft → preview → approval → post workflow.
- Restrict access to authorised company users.
- Review every entry posted to Tally.
- Keep audit and approval records in your commercial deployment.

This repository is public for product documentation and distribution. The software is proprietary commercial software; commercial use requires permission from Zenastra Industries. See `LICENSE` and `THIRD_PARTY_NOTICES.md`.

## Current limitations

- The current voucher writer supports typed ledger vouchers; full invoice-line OCR and automatic bill ingestion are not yet included.
- Real Tally posting must be tested against each customer’s TallyPrime version, configuration, voucher types, GST setup, and company data.
- Drafts are held in the connector process; production deployments should add durable storage, user identity, immutable audit logs, idempotency, and role-based maker-checker approvals.
- Accounting and statutory decisions remain the responsibility of the company and its authorised professionals.

## Support and licensing

**Zenastra Industries**

- General support: `contact@zenastraindustries.com`
- CEO: `raghav22062003ss@gmail.com`
- Website: https://zenastraindustries.com

## License

Copyright © 2026 Zenastra Industries. Proprietary commercial software. See `LICENSE` for terms.

Third-party packages retain their own licenses; see `THIRD_PARTY_NOTICES.md`.

## Disclaimer

Tally Financial OS is an automation and analysis tool, not a substitute for an accountant, auditor, tax adviser, or management approval. Always verify extracted data, accounting classifications, taxes, and final postings.

## Product roadmap

- Bill/PDF/image ingestion
- OCR and invoice-field extraction
- Supplier and item matching
- GST validation and reconciliation
- Duplicate invoice and duplicate payment detection
- Sales, purchase, receipt, payment, journal, contra, credit-note and debit-note templates
- Durable approval and audit storage
- Role-based controls and approval thresholds
- CFO alerts and cash-flow forecasting
- Inventory ageing and profitability analysis

## Acknowledgement

This project is based on and extends the public Tally MCP server pattern by Dhananjay Gokhale. Upstream notices are preserved in `THIRD_PARTY_NOTICES.md`; see the original project for its history and upstream documentation.

Original project: https://github.com/dhananjay1405/tally-mcp-server

---

Built by **Zenastra Industries** for finance teams that want faster, safer, more explainable operations around TallyPrime.

# Private Corpus Testing

Use the private corpus before serious deploys to catch real-file extraction regressions.

Private files stay outside git in `.private-corpus/`.

## Manifest

Create `.private-corpus/manifest.json`:

```json
{
  "baseDir": "files",
  "cases": [
    {
      "name": "May bank statement to QuickBooks",
      "file": "bank/may-statement.pdf",
      "converter": "bank",
      "outputFormat": "quickbooks_csv",
      "minRows": 25,
      "minTrustScore": 0.7,
      "expectedHeaders": ["Date", "Description", "Amount"],
      "mustContain": ["Opening Balance"],
      "mustNotContain": ["undefined", "NaN"],
      "maxWarnings": 3
    },
    {
      "name": "Receipt photo to CSV",
      "file": "receipts/coffee.png",
      "converter": "receipt",
      "requiresEnv": ["MISTRAL_API_KEY"],
      "minRows": 1,
      "mustContain": ["Total"]
    }
  ]
}
```

Run:

```bash
npm run corpus:private
```

To make missing or failed corpus tests block a release:

```bash
AICONVERTER_PRIVATE_CORPUS_REQUIRED=true npm run corpus:private
```

## What belongs here

- anonymized real bank statements
- credit-card statements
- receipts and invoices
- screenshots with table data
- documents and audio samples when the required provider env is available

Do not commit the files, generated outputs, or provider secrets.

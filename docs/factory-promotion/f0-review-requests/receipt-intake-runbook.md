# F0.1 Review Receipt Intake Runbook

Status: operator runbook, not review evidence.
Date: 2026-06-11

This runbook explains how to turn a real independent Opus review output into
the two F0.1 receipt files without hand-editing receipt JSON.

The intake command does not perform the review and does not approve the work. It
only normalizes a raw review output file into the required receipt shape, binds
the request prompt SHA256, raw output SHA256, reviewed commit SHA, resolved model
id, scope id, and closed authority flags, then checks the target receipt through
`factory:receipt-preflight`.

## Preconditions

1. The reviewer used the matching request packet in this directory.
2. The raw reviewer output was saved as a durable file outside
   `docs/factory-promotion/`.
3. The reviewer provided the actual resolved Opus-family model id.
4. The reviewed commit SHA is known.
5. If the review has unresolved findings, they are stored as JSON and
   `unresolved_finding_count` is non-zero. F0.1 will remain blocked.

## Connector Governance Receipt

Dry-run first:

```bash
npm run factory:f0-review-receipt-intake -- \
  --scope-id connector_external_app_governance \
  --raw-output-path <raw-opus-review-output.txt> \
  --reviewed-commit-sha <reviewed-commit-sha> \
  --engine-resolved-model-id <actual-resolved-opus-model-id> \
  --unresolved-finding-count 0 \
  --check \
  --require-pass
```

Write the receipt only after the dry-run passes:

```bash
npm run factory:f0-review-receipt-intake -- \
  --scope-id connector_external_app_governance \
  --raw-output-path <raw-opus-review-output.txt> \
  --reviewed-commit-sha <reviewed-commit-sha> \
  --engine-resolved-model-id <actual-resolved-opus-model-id> \
  --unresolved-finding-count 0
```

Expected receipt path:

```text
artifacts/connector-external-app-governance/review/claude-connector-governance-review-receipt.json
```

## Execution/Write Authority Receipt

Dry-run first:

```bash
npm run factory:f0-review-receipt-intake -- \
  --scope-id execution_write_authority_maturity \
  --raw-output-path <raw-opus-review-output.txt> \
  --reviewed-commit-sha <reviewed-commit-sha> \
  --engine-resolved-model-id <actual-resolved-opus-model-id> \
  --unresolved-finding-count 0 \
  --check \
  --require-pass
```

Write the receipt only after the dry-run passes:

```bash
npm run factory:f0-review-receipt-intake -- \
  --scope-id execution_write_authority_maturity \
  --raw-output-path <raw-opus-review-output.txt> \
  --reviewed-commit-sha <reviewed-commit-sha> \
  --engine-resolved-model-id <actual-resolved-opus-model-id> \
  --unresolved-finding-count 0
```

Expected receipt path:

```text
artifacts/execution-write-authority-maturity/review/claude-execution-write-authority-review-receipt.json
```

## Final F0 Checks

After both receipts are written:

```bash
npm run factory:receipt-preflight -- --check --require-pass
npm run factory:promotion-f0-gate -- --check --require-pass
npm run platform:connector-external-app-governance -- --check
npm run platform:execution-write-authority-maturity -- --check
```

## Rejection Rules

The intake command blocks:

- label-only model ids such as `claude_code_opus_max`
- any model id containing `fable`
- raw output paths under `docs/factory-promotion/`
- output paths outside the two F0.1 receipt targets
- unresolved findings when `--require-pass` is used

These rejections protect F0.1 from treating request packets, planning documents,
or planning-lane output as independent review evidence.

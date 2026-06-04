import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildPlatformReviewAuthorityContract,
  runPlatformReviewAuthorityContract,
} from "../src/platform-review-authority-contract.mjs";

const RUN_AT = "2026-06-04T00:00:00.000Z";

test("Review authority contract freezes Codex, Claude, human, GitHub, and single-owner roles", async () => {
  const fixture = await writeFixture();
  try {
    const result = await buildPlatformReviewAuthorityContract({
      runAt: RUN_AT,
      write: false,
      ...fixture.options,
    });

    assert.equal(result.validation.valid, true);
    assert.equal(result.review_authority_anchor.program_range, "P3841-P4000");
    assert.equal(result.review_authority_anchor.phase_range, "P3841-P3860");
    assert.equal(result.review_authority_anchor.next_phase_slot, "P3861");
    assert.equal(result.summary.review_authority_contract_status, "ready_for_review_authority_contract");
    assert.equal(result.summary.p4000_role_authority_contract_ready, true);
    assert.equal(result.authority_actor_rows.length, 5);
    assert.equal(result.authority_rule_rows.length, 8);
    assert.equal(result.closeout_control_rows.length, 8);
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});

test("Review authority contract prevents Codex and Claude from becoming final authority", async () => {
  const fixture = await writeFixture();
  try {
    const result = await buildPlatformReviewAuthorityContract({
      runAt: RUN_AT,
      write: false,
      ...fixture.options,
    });
    const codex = result.authority_actor_rows.find((row) => row.actor_id === "actor.codex.primary_developer");
    const claude = result.authority_actor_rows.find((row) => row.actor_id === "actor.claude_code.opus_max_reviewer");
    const human = result.authority_actor_rows.find((row) => row.actor_id === "actor.human.owner_adjudicator");
    const github = result.authority_actor_rows.find((row) => row.actor_id === "actor.github.independent_reviewer");

    assert.equal(codex.can_modify_source, true);
    assert.equal(codex.can_finally_approve, false);
    assert.equal(codex.can_self_approve, false);
    assert.equal(claude.can_review_findings, true);
    assert.equal(claude.can_modify_source, false);
    assert.equal(claude.can_finally_approve, false);
    assert.equal(human.can_finally_approve, true);
    assert.equal(human.can_complete_enterprise_trust_gate, false);
    assert.equal(github.can_complete_enterprise_trust_gate, true);
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});

test("Review authority contract treats single-owner mode as lower-trust readiness only", async () => {
  const fixture = await writeFixture();
  try {
    const result = await buildPlatformReviewAuthorityContract({
      runAt: RUN_AT,
      write: false,
      ...fixture.options,
    });
    const enterpriseBoundary = result.single_owner_boundary_rows.find((row) => row.control_id === "single_owner_enterprise_trust_forbidden");
    const independentRule = result.authority_rule_rows.find((row) => row.rule_id === "single_owner_exception_not_enterprise_trust");

    assert.equal(result.summary.single_owner_exception_observed_now, true);
    assert.equal(result.summary.single_owner_merge_readiness_now, true);
    assert.equal(result.summary.single_owner_enterprise_trust_allowed_now, false);
    assert.equal(enterpriseBoundary.current_verdict, "pass");
    assert.equal(independentRule.authority_status, "blocked");
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});

test("Review authority contract fails closed when single-owner evidence overclaims enterprise trust", async () => {
  const fixture = await writeFixture({
    boundary: {
      single_owner_merge_readiness_now: true,
      independent_github_review_completed_now: false,
      enterprise_trust_claim_allowed_now: true,
    },
  });
  try {
    const result = await buildPlatformReviewAuthorityContract({
      runAt: RUN_AT,
      write: false,
      ...fixture.options,
    });
    const enterpriseBoundary = result.single_owner_boundary_rows.find((row) => row.control_id === "single_owner_enterprise_trust_forbidden");

    assert.equal(result.validation.valid, false);
    assert.equal(result.summary.p4000_role_authority_contract_ready, false);
    assert.equal(result.summary.single_owner_enterprise_trust_allowed_now, true);
    assert.equal(enterpriseBoundary.current_verdict, "blocked");
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});

test("Review authority contract check mode throws on missing required source evidence", async () => {
  const fixture = await writeFixture({ packageScriptRegistered: false });
  try {
    await assert.rejects(
      () => runPlatformReviewAuthorityContract({
        runAt: RUN_AT,
        write: false,
        check: true,
        ...fixture.options,
      }),
      /Platform review authority contract failed/,
    );
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});

async function writeFixture(options = {}) {
  const root = await mkdtemp(path.join(os.tmpdir(), "platform-review-authority-contract-"));
  const packagePath = path.join(root, "package.json");
  const ledgerPath = path.join(root, "hermes-external-verification-enforcement.md");
  const reviewDir = path.join(root, "review");
  const latestDir = path.join(root, "latest");
  await mkdir(reviewDir, { recursive: true });
  await mkdir(latestDir, { recursive: true });
  const singleOwnerExceptionReceiptPath = path.join(reviewDir, "single-owner-exception-receipt.json");
  const externalVerificationBoundaryPath = path.join(latestDir, "external-verification-boundary.json");
  const packageJson = {
    scripts: options.packageScriptRegistered === false
      ? {}
      : { "platform:review-authority-contract": "node scripts/platform-review-authority-contract.mjs" },
  };
  const receipt = {
    schema_version: "single-owner-exception-receipt.v1",
    receipt_status: "observed",
    single_owner_exception_observed_now: true,
    independent_github_review_completed_now: false,
    enterprise_trust_claim_allowed_now: false,
  };
  const boundary = {
    schema_version: "external-verification-boundary.v1",
    single_owner_merge_readiness_now: true,
    independent_github_review_completed_now: false,
    enterprise_trust_claim_allowed_now: false,
    ...options.boundary,
  };
  await writeJson(packagePath, packageJson);
  await writeFile(ledgerPath, "# P3841-P4000 Review Process Upgrade\n", "utf8");
  await writeJson(singleOwnerExceptionReceiptPath, receipt);
  await writeJson(externalVerificationBoundaryPath, boundary);
  return {
    root,
    options: {
      packagePath,
      externalVerificationEnforcementLedgerPath: ledgerPath,
      singleOwnerExceptionReceiptPath,
      externalVerificationBoundaryPath,
    },
  };
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

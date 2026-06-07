import { runReceiptWorkbenchOperatorQueueStaticShellFilePlanCandidateCli } from "../src/receipt-workbench-operator-queue-static-shell-file-plan-candidate.mjs";

runReceiptWorkbenchOperatorQueueStaticShellFilePlanCandidateCli().catch((error) => {
  console.error(error.message);
  if (error.validation) console.error(JSON.stringify(error.validation, null, 2));
  process.exitCode = 1;
});

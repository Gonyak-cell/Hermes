import { runReceiptWorkbenchOperatorQueueStaticShellImplementationBindingCandidateCli } from "../src/receipt-workbench-operator-queue-static-shell-implementation-binding-candidate.mjs";

runReceiptWorkbenchOperatorQueueStaticShellImplementationBindingCandidateCli().catch((error) => {
  console.error(error.message);
  if (error.validation) console.error(JSON.stringify(error.validation, null, 2));
  process.exitCode = 1;
});

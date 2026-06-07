import { runReceiptWorkbenchOperatorQueueStaticShellImplementationHandoffPackageCli } from "../src/receipt-workbench-operator-queue-static-shell-implementation-handoff-package.mjs";

runReceiptWorkbenchOperatorQueueStaticShellImplementationHandoffPackageCli().catch((error) => {
  console.error(error.message);
  if (error.validation) console.error(JSON.stringify(error.validation, null, 2));
  process.exitCode = 1;
});

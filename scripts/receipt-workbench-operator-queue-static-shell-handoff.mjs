import { runReceiptWorkbenchOperatorQueueStaticShellHandoffCli } from "../src/receipt-workbench-operator-queue-static-shell-handoff.mjs";

runReceiptWorkbenchOperatorQueueStaticShellHandoffCli().catch((error) => {
  console.error(error.message);
  if (error.validation) console.error(JSON.stringify(error.validation, null, 2));
  process.exitCode = 1;
});

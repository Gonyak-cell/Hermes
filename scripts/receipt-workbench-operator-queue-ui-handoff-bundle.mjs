import { runReceiptWorkbenchOperatorQueueUiHandoffBundleCli } from "../src/receipt-workbench-operator-queue-ui-handoff-bundle.mjs";

runReceiptWorkbenchOperatorQueueUiHandoffBundleCli().catch((error) => {
  console.error(error.message);
  if (error.validation) console.error(JSON.stringify(error.validation, null, 2));
  process.exitCode = 1;
});

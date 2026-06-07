import { runReceiptWorkbenchOperatorQueueLocalUiBindingSmokeCli } from "../src/receipt-workbench-operator-queue-local-ui-binding-smoke.mjs";

runReceiptWorkbenchOperatorQueueLocalUiBindingSmokeCli().catch((error) => {
  console.error(error.message);
  if (error.validation) console.error(JSON.stringify(error.validation, null, 2));
  process.exitCode = 1;
});

import { runReceiptWorkbenchOperatorQueueUiAdapterFixturePreviewCli } from "../src/receipt-workbench-operator-queue-ui-adapter-fixture-preview.mjs";

runReceiptWorkbenchOperatorQueueUiAdapterFixturePreviewCli().catch((error) => {
  console.error(error.message);
  if (error.validation) console.error(JSON.stringify(error.validation, null, 2));
  process.exitCode = 1;
});

import { runUiProjectionReplayLedgerCli } from "../src/ui-projection-replay-ledger.mjs";

runUiProjectionReplayLedgerCli().catch((error) => {
  console.error(error.message);
  if (error.validation) console.error(JSON.stringify(error.validation, null, 2));
  process.exitCode = 1;
});

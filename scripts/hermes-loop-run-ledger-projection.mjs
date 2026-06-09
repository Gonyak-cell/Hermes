import { runHermesLoopRunLedgerProjectionCli } from "../src/hermes-loop-run-ledger-projection.mjs";

runHermesLoopRunLedgerProjectionCli().catch((error) => {
  console.error(error.message);
  if (error.validation) console.error(JSON.stringify(error.validation, null, 2));
  process.exitCode = 1;
});

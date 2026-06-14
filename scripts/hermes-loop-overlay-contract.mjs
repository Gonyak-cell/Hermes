import { runHermesLoopOverlayContractCli } from "../src/hermes-loop-overlay-contract.mjs";

runHermesLoopOverlayContractCli().catch((error) => {
  console.error(error.message);
  if (error.validation) console.error(JSON.stringify(error.validation, null, 2));
  process.exitCode = 1;
});

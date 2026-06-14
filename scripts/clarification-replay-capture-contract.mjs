import { runClarificationReplayCaptureContractCli } from "../src/clarification-replay-capture-contract.mjs";

runClarificationReplayCaptureContractCli().catch((error) => {
  console.error(error.message);
  if (error.validation) console.error(JSON.stringify(error.validation, null, 2));
  process.exitCode = 1;
});

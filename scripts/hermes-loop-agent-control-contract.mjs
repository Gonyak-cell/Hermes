import { runHermesLoopAgentControlContractCli } from "../src/hermes-loop-agent-control-contract.mjs";

runHermesLoopAgentControlContractCli().catch((error) => {
  console.error(error.message);
  if (error.validation) console.error(JSON.stringify(error.validation, null, 2));
  process.exitCode = 1;
});

import { runHermesLoopContextMemoryGroundingCli } from "../src/hermes-loop-context-memory-grounding.mjs";

runHermesLoopContextMemoryGroundingCli().catch((error) => {
  console.error(error.message);
  if (error.validation) console.error(JSON.stringify(error.validation, null, 2));
  process.exitCode = 1;
});

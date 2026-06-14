import { runHermesLoopSourceBindingCli } from "../src/hermes-loop-source-binding.mjs";

runHermesLoopSourceBindingCli().catch((error) => {
  console.error(error.message);
  if (error.validation) console.error(JSON.stringify(error.validation, null, 2));
  process.exitCode = 1;
});

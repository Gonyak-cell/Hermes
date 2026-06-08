import { runSeedSynthesisExecutionReadinessCli } from "../src/seed-synthesis-execution-readiness.mjs";

runSeedSynthesisExecutionReadinessCli().catch((error) => {
  console.error(error.message);
  if (error.validation) console.error(JSON.stringify(error.validation, null, 2));
  process.exitCode = 1;
});

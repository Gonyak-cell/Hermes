import { runWorkOsPlanStateProjectionCli } from "../src/work-os-plan-state-projection.mjs";

runWorkOsPlanStateProjectionCli().catch((error) => {
  console.error(error.message);
  if (error.validation) console.error(JSON.stringify(error.validation, null, 2));
  process.exitCode = 1;
});

import { runWorkOsPlanStateApiReadModelCli } from "../src/work-os-plan-state-api-read-model.mjs";

runWorkOsPlanStateApiReadModelCli().catch((error) => {
  console.error(error.message);
  if (error.validation) console.error(JSON.stringify(error.validation, null, 2));
  process.exitCode = 1;
});

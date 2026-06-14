import { runWorkOsPlanStateStaticBundleHandoffCli } from "../src/work-os-plan-state-static-bundle-handoff.mjs";

runWorkOsPlanStateStaticBundleHandoffCli().catch((error) => {
  console.error(error.message);
  if (error.validation) console.error(JSON.stringify(error.validation, null, 2));
  process.exitCode = 1;
});

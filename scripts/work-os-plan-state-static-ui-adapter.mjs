import { runWorkOsPlanStateStaticUiAdapterCli } from "../src/work-os-plan-state-static-ui-adapter.mjs";

runWorkOsPlanStateStaticUiAdapterCli().catch((error) => {
  console.error(error.message);
  if (error.validation) console.error(JSON.stringify(error.validation, null, 2));
  process.exitCode = 1;
});

import { runPlanRegistryControlPlaneCandidateCli } from "../src/plan-registry-control-plane-candidate.mjs";

runPlanRegistryControlPlaneCandidateCli().catch((error) => {
  console.error(error.message);
  if (error.validation) console.error(JSON.stringify(error.validation, null, 2));
  process.exitCode = 1;
});

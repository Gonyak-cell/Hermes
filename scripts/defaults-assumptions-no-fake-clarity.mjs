import { runDefaultsAssumptionsNoFakeClarityCli } from "../src/defaults-assumptions-no-fake-clarity.mjs";

runDefaultsAssumptionsNoFakeClarityCli().catch((error) => {
  console.error(error.message);
  if (error.validation) console.error(JSON.stringify(error.validation, null, 2));
  process.exitCode = 1;
});

import { runSeedRecheckValidationContractCli } from "../src/seed-recheck-validation-contract.mjs";

runSeedRecheckValidationContractCli().catch((error) => {
  console.error(error.message);
  if (error.validation) console.error(JSON.stringify(error.validation, null, 2));
  process.exitCode = 1;
});

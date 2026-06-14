import { runCommercialSpecRegistrationCandidateCli } from "../src/commercial-spec-registration-candidate.mjs";

runCommercialSpecRegistrationCandidateCli().catch((error) => {
  console.error(error.message);
  if (error.validation) console.error(JSON.stringify(error.validation, null, 2));
  process.exitCode = 1;
});

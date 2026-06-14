import { runAmbiguousRequestIntakeCli } from "../src/ambiguous-request-intake.mjs";

runAmbiguousRequestIntakeCli().catch((error) => {
  console.error(error.message);
  if (error.validation) console.error(JSON.stringify(error.validation, null, 2));
  process.exitCode = 1;
});

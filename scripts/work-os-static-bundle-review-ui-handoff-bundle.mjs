import { runWorkOsStaticBundleReviewUiHandoffBundleCli } from "../src/work-os-static-bundle-review-ui-handoff-bundle.mjs";

runWorkOsStaticBundleReviewUiHandoffBundleCli().catch((error) => {
  console.error(error.message);
  if (error.validation) console.error(JSON.stringify(error.validation, null, 2));
  process.exitCode = 1;
});

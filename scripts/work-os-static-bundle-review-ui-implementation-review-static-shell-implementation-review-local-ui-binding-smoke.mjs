import { runWorkOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewLocalUiBindingSmokeCli } from "../src/work-os-static-bundle-review-ui-implementation-review-static-shell-implementation-review-local-ui-binding-smoke.mjs";

runWorkOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewLocalUiBindingSmokeCli().catch((error) => {
  console.error(error.message);
  if (error.validation) console.error(JSON.stringify(error.validation, null, 2));
  process.exitCode = 1;
});

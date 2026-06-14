import { runWorkOsStaticBundleReviewStaticUiAdapterCli } from "../src/work-os-static-bundle-review-static-ui-adapter.mjs";

runWorkOsStaticBundleReviewStaticUiAdapterCli().catch((error) => {
  console.error(error.message);
  if (error.validation) console.error(JSON.stringify(error.validation, null, 2));
  process.exitCode = 1;
});

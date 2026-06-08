import { runWorkOsStaticBundleReviewUiImplementationReviewPacketCandidateCli } from "../src/work-os-static-bundle-review-ui-implementation-review-packet-candidate.mjs";

runWorkOsStaticBundleReviewUiImplementationReviewPacketCandidateCli().catch((error) => {
  console.error(error.message);
  if (error.validation) console.error(JSON.stringify(error.validation, null, 2));
  process.exitCode = 1;
});

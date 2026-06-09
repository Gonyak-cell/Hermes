import { runPostP64000FocusedReReviewRawCaptureIntakeCli } from "../src/post-p64000-focused-re-review-raw-capture-intake.mjs";

runPostP64000FocusedReReviewRawCaptureIntakeCli().catch((error) => {
  console.error(error.stack ?? error.message);
  process.exitCode = 1;
});

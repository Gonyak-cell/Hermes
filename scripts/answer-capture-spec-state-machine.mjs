import { runAnswerCaptureSpecStateMachineCli } from "../src/answer-capture-spec-state-machine.mjs";

runAnswerCaptureSpecStateMachineCli().catch((error) => {
  console.error(error.message);
  if (error.validation) console.error(JSON.stringify(error.validation, null, 2));
  process.exitCode = 1;
});

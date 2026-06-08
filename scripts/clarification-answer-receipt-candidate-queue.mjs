import { runClarificationAnswerReceiptCandidateQueueCli } from "../src/clarification-answer-receipt-candidate-queue.mjs";

runClarificationAnswerReceiptCandidateQueueCli().catch((error) => {
  console.error(error.message);
  if (error.validation) console.error(JSON.stringify(error.validation, null, 2));
  process.exitCode = 1;
});

import { runQuestionPlannerConflictDetectorCli } from "../src/question-planner-conflict-detector.mjs";

runQuestionPlannerConflictDetectorCli().catch((error) => {
  console.error(error.message);
  if (error.validation) console.error(JSON.stringify(error.validation, null, 2));
  process.exitCode = 1;
});

# Policy Violation Queue

`policy_violation_queue` is a read-only Desktop projection for Phase 294. It turns model, tool/runtime, access, and output policy blocks or holds from Policy Operations Surface into queue items and actor actions.

The queue emits panel rows, queue item rows, actor action rows, boundary checks, validation rows, and a summary under `artifacts/policy-violation-queue/latest`. Actor actions are human-review instructions only: the artifact does not mutate policy, apply approvals or receipts, execute protected actions, deliver output, start routes or servers, generate legal advice, or produce client-facing output.

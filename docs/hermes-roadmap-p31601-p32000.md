# Hermes Roadmap P31601-P32000

P31601-P32000 turns the P31600 ambiguous request intake contract into a deterministic question planner and conflict detector. It creates question candidates from missing specification slots, identifies conflicts such as protected-action requests without authority boundaries, groups question candidates into clarification bundles, assigns priority bands, and opens a clean handoff to the later answer capture state machine.

This tranche continues the Ouroboros-style concept absorption by making the prompt-to-spec loop inspectable before seed synthesis. It does not send questions, capture answers, synthesize seeds, apply defaults, execute commands, write product files, approve, deploy, or claim production readiness.

| Phase | Name | Output |
| --- | --- | --- |
| P31601-P31640 | P31600 Source Binding | `p31600_source_binding_rows` |
| P31641-P31720 | Question Planner | `question_planner_rows` |
| P31721-P31800 | Conflict Detector | `question_conflict_detector_rows` |
| P31801-P31880 | Clarification Bundle | `clarification_bundle_rows` |
| P31881-P31940 | Question Priority Policy | `question_priority_policy_rows` |
| P31941-P31980 | No-Auto-Question Boundary | `no_auto_question_boundary_rows` |
| P31981-P32000 | P32000 Clean Checkpoint | `p32000_clean_checkpoint_rows` |

## Completion Contract

P32000 can report `ready_for_answer_capture_state_machine=true` only when:

- The P31600 source is valid and has opened `ready_for_clarifying_question_engine`.
- Question planner rows exist for ambiguous or protected request slots.
- Conflict detector rows mark protected action, high-risk, authority-boundary, and threshold conflicts.
- Clarification bundle rows group question candidates without sending them.
- Priority policy rows provide deterministic ask order hints.
- No-auto-question boundary rows keep question send, answer capture, seed synthesis, runtime, write, approval, deployment, production PASS, and enterprise trust closed.

## Closed Boundary

Even when P32000 is ready, Hermes still must not treat this as a live conversation, captured user answer, executable seed, runtime/write lane, review completion, final approval, production PASS, or enterprise-trust claim. The artifact only proves that Hermes can plan clarifying questions and detect conflicts without pretending ambiguous intent is already clear.

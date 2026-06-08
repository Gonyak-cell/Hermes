# Hermes Roadmap P32001-P32400

P32001-P32400 turns the P32000 question planner and conflict detector into an answer capture contract and specification state machine. It defines expected answer refs, redaction requirements, allowed state transitions, transition validators, and a clean handoff to the later seed readiness gate.

This tranche still does not capture live answers. It only defines how answer receipts must be referenced and redacted before any future spec update can be considered. It does not synthesize seeds, apply defaults, execute commands, write product files, approve, deploy, or claim production readiness.

| Phase | Name | Output |
| --- | --- | --- |
| P32001-P32040 | P32000 Source Binding | `p32000_source_binding_rows` |
| P32041-P32120 | Answer Capture Contract | `answer_capture_contract_rows` |
| P32121-P32200 | Spec State Machine | `spec_state_machine_rows` |
| P32201-P32280 | Answer Redaction Boundary | `answer_redaction_boundary_rows` |
| P32281-P32340 | State Transition Validator | `state_transition_validator_rows` |
| P32341-P32380 | No-Seed-Synthesis Boundary | `no_seed_synthesis_boundary_rows` |
| P32381-P32400 | P32400 Clean Checkpoint | `p32400_clean_checkpoint_rows` |

## Completion Contract

P32400 can report `ready_for_seed_readiness_gate=true` only when:

- The P32000 source is valid and has opened `ready_for_answer_capture_state_machine`.
- Answer capture contract rows define expected answer refs without claiming answers are present.
- Spec state machine rows model the question, answer, spec update, and seed readiness states.
- Answer redaction boundary rows keep raw answers hidden and require redaction before future use.
- State transition validator rows block transitions that require answer receipts when no receipt exists.
- No-seed-synthesis boundary rows keep seed synthesis, runtime, write, protected action, approval, deployment, production PASS, and enterprise trust closed.

## Closed Boundary

Even when P32400 is ready, Hermes still must not treat this as a captured answer, final specification, synthesized seed, executable command, write lane, review completion, final approval, production PASS, or enterprise-trust claim. The artifact only proves that future answer capture can be governed by deterministic state and redaction rules.

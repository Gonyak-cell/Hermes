# Hermes Roadmap P31201-P31600

P31201-P31600 turns the P31200 static shell implementation handoff package into the first generic ambiguity intake contract. It models incomplete user intent as structured prompt sources, parsed intents, task type registry rows, selected spec schemas, slot clarity scores, ambiguity thresholds, and a clean handoff to the later clarifying question engine.

This tranche absorbs the useful Ouroboros-style concept of converging incomplete intent into executable specification, but it does not adopt Ouroboros or Nous Hermes runtime as an execution authority. It does not ask live user questions, capture answers, synthesize final seeds, execute commands, write product files, approve, deploy, or claim production readiness.

| Phase | Name | Output |
| --- | --- | --- |
| P31201-P31240 | P31200 Source Binding | `p31200_source_binding_rows` |
| P31241-P31300 | Ambiguous Request Intake | `ambiguous_request_intake_rows` |
| P31301-P31360 | Intent Parser | `intent_parser_rows` |
| P31361-P31440 | Task Type Registry | `task_type_registry_rows` |
| P31441-P31520 | Spec Schema Selector And Slot Clarity Scoring | `spec_schema_selector_rows`, `slot_clarity_scoring_rows` |
| P31521-P31570 | Ambiguity Threshold Policy | `ambiguity_threshold_policy_rows` |
| P31571-P31600 | P31600 Clean Checkpoint | `p31600_clean_checkpoint_rows` |

## Completion Contract

P31600 can report `ready_for_clarifying_question_engine=true` only when:

- The P31200 source is valid and has opened `ready_for_p31201_handoff`.
- Prompt source rows preserve raw request refs without executing the request.
- Intent parser rows extract task type, target object, intent verb, constraints, and authority risk.
- Task type registry rows define generic task families and allowed ambiguity thresholds.
- Spec schema selector rows map task types to required specification slots.
- Slot clarity scoring rows compute clarity, weight, contribution, and missing-slot state.
- Ambiguity threshold policy rows determine whether clarification is required before execution.
- All runtime, write, protected action, approval, deployment, connector write, raw exposure, and final automated approval boundaries remain closed.

## Closed Boundary

Even when P31600 is ready, Hermes still must not treat this as an actual clarifying conversation, user answer capture, executable seed, write lane, runtime, review completion, final approval, production PASS, or enterprise-trust claim. The artifact only proves that ambiguous request intake metadata can be produced and checked deterministically.

# Hermes Roadmap P18401-P18800 Check-Mode Scanner Robustness

P18401-P18800은 P18400 Check-Mode Guard Normalization 다음 단계다. 목표는 P18400 Claude Code Opus max review가 남긴 nonblocking scanner debt를 실제 validator hardening으로 닫는 것이다. 이 단계는 검증기를 더 신뢰 가능하게 만드는 구간이며, 실행 권한이나 write 권한을 열지 않는다.

P18400 source artifact가 디스크에 없으면 P18800 builder는 P18400 Check-Mode Guard Normalization을 in-memory로 재계산해 conservative source summary를 만든다. P18800은 production PASS, enterprise trust, runtime execution, write/action authority, connector write, reviewer mutation, final approval을 열지 않는다.

| 범위 | 이름 | 목표 | 산출물 |
|---|---|---|---|
| P18401-P18440 | Claude Finding Intake | P18400 review의 P3/INFO scanner findings를 finding class로 정규화한다. | `scanner_finding_closure_rows` |
| P18441-P18520 | Tokenizer-Aware Branch Scan | string/comment/template literal 안의 brace, fake assignment, unterminated literal을 executable code로 오인하지 않는다. | `tokenizer_fixture_rows` |
| P18521-P18600 | Parser Shape Coverage | equality, reversed equality, loose equality, switch case, array includes, alternate parser branch를 fixture로 고정한다. | `parser_shape_fixture_rows` |
| P18601-P18680 | Guard Convention Ledger | `options.write !== false` literal guard convention과 member-expression/template-literal/destructured-flag unsupported variants를 명시한다. | `guard_convention_rows` |
| P18681-P18740 | Schema And Readiness Tightening | row collection schema coverage와 summary/boundary readiness 의미를 정렬한다. | `schema_readiness_rows` |
| P18741-P18800 | P18800 Handoff Freeze | scanner robustness, finding closure, validation evidence, authority boundary, P18801 handoff를 freeze한다. | `p18800_freeze_rows` |

완료 기준:

- P18400 Claude review finding classes가 모두 `resolved` 또는 `accepted_non_blocking_closed` 상태다.
- parser shape fixtures는 `arg === "--check"`, `"--check" === arg`, `arg == "--check"`, `case "--check"`, `["--check"].includes(arg)`, canonical `parseArgs` 밖의 alternate parser branch를 포함한다.
- string/comment/template literal 내부 fake assignment와 unterminated literal은 PASS 증거가 될 수 없다.
- unsupported parser shapes는 documented unsupported 상태로 남고, 그 사실만으로 runtime/write authority를 열지 않는다.
- row collection shape와 readiness semantics가 downstream projection에 충분히 명시된다.
- P18400 broader trust debt는 지워지지 않고 다음 trust tranche로 이어진다.
- P18800은 runtime execution, write/protected action, connector write, production PASS, enterprise trust, final approval을 열지 않는다.

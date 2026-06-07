# Hermes P28001-P28400 Receipt Workbench Operator Queue Local UI Binding Smoke

P28001-P28400은 P28000 Receipt Workbench Operator Queue UI Handoff Bundle 이후의 read-only handoff bundle을 local UI shell에 붙이기 전 smoke 계약으로 고정한다. 이 단계는 실제 서버, route, DOM, browser, click, write를 열지 않는다. 목적은 다음 local UI shell 단계가 어떤 static slot, safe DOM anchor, GET-only fixture, blocker/no-action projection을 사용해야 하는지 잃지 않게 하는 것이다.

| Range | Name | Output |
|---|---|---|
| `P28001-P28040` | P28000 Source Binding | `p28000_source_binding_rows` |
| `P28041-P28120` | Local UI Binding Smoke Contract | `local_ui_binding_smoke_rows` |
| `P28121-P28200` | Static Shell Binding Map | `static_shell_binding_map_rows` |
| `P28201-P28280` | GET-Only Fixture Fetch Contract | `get_only_fixture_fetch_contract_rows` |
| `P28281-P28340` | Visible Blocker/No-Action Projection | `visible_blocker_no_action_rows` |
| `P28341-P28380` | No-Server/No-Browser Boundary | `no_server_no_browser_boundary_rows` |
| `P28381-P28400` | P28400 Clean Checkpoint | `p28400_clean_checkpoint_rows` |

## Boundary

P28400 may open `ready_for_p28401_handoff` only when the P28000 source is valid and ready, local binding smoke rows are visible, static shell slots are mapped, GET-only fixture rows are present, blocker/no-action projection is visible, and every inherited false flag remains closed.

P28400이 ready여도 이는 local UI binding smoke readiness일 뿐이다. actual server start, route registration, route mount, route execution, DOM rendering, browser run, browser smoke, live refresh, network fetch, screenshot capture, click action, keyboard action, command/approve/closeout button enablement, state mutation, write, HTML file write, export, publish, final approval, production PASS, enterprise trust, release approval, deployment, runtime execution, write/protected action, connector write, raw exposure, secret read, reviewer mutation, final automated approval은 계속 false다.

# Trading Pack Phase Ledger

Status date: 2026-05-31

This ledger accepts the P001-P340 Trading Pack roadmap as a Hermes domain-pack track.
The pack is a project/workflow control-plane extension for research, backtest, and paper
trading operations. It does not provide financial advice, promise returns, place orders,
connect to broker or exchange APIs, store credentials, or enable live trading by default.

## Current Boundary

- Active stages: research, backtest, paper.
- Blocked stages: shadow_live, limited_live, full_auto.
- Live adapters: disabled by default.
- Real order placement: blocked.
- Plaintext API key storage: forbidden.
- Human approval: required for every promotion, rollback, protected output, and any future live-read or live-write capability.
- Rollback default: paper mode.
- Kill switch default: manual resume only.
- Audit default: replayable artifacts with source, timestamp, confidence, owner, and review status.

## Phase Ranges

| Range | Scope | Current status | Safety note |
| --- | --- | --- | --- |
| P001-P015 | Product and safety foundation | active | Defines identity, forbidden conditions, promotion, rollback, kill switch, and audit policy. |
| P016-P035 | Core trading contracts | active | Adds schemas, safe examples, fixtures, validation, docs, and read-only dashboard/API stub. |
| P036-P060 | Hedge fund strategy taxonomy | complete | Research taxonomy only; no trade recommendation or live execution. |
| P061-P090 | Market data and feature store | complete | Manual/fixture ingestion first; vendor/live feeds need separate approval. |
| P091-P125 | Strategy/signal engine | complete | Signal output remains separated from order intent and human review queue. |
| P126-P165 | Deep learning auto-improvement layer | complete | Research-only model registry; deployment blocked until promotion gates exist. |
| P166-P195 | Backtest and validation | complete | Deterministic runner, bias checks, stress scenarios, and golden fixtures required. |
| P196-P220 | Risk engine | complete | pass/warn/block/halt results precede any order-intent boundary. |
| P221-P245 | Paper and shadow live | complete | Paper allowed; shadow live is read-only/no-order with live writes blocked. |
| P246-P280 | Execution engine | complete | Interfaces and simulated adapters exist; live adapters and real orders stay disabled. |
| P281-P310 | Limited live auto trading | complete | Governance, caps, whitelists, halt gates, rollback, and reports exist; limited-live enablement and live order submission remain blocked without explicit approval receipts. |
| P311-P330 | Full auto multi-strategy governance | complete | Governance, health scoring, dry-run allocators, failover, audit replay, and disaster recovery exist; full-auto enablement and automatic order submission remain blocked. |
| P331-P340 | Trading Pack v1.0 freeze | complete | Trading Pack freeze checklist, golden fixture, no-write check, validate chain, contracts gate, and release freeze gate are represented without live enablement. |

## P001-P035 Acceptance Criteria

- P001-P006: Trading Pack identity, staged promotion model, forbidden conditions, asset classes, strategy universe, and tradability flags are documented.
- P007-P014: Short, derivatives, leverage, Korea short-selling capability checks, crypto custody notes, human approval, promotion, rollback, kill switch, and audit/replay policies are represented in pack metadata and validation checks.
- P015: This phase ledger is the source of truth for Trading Pack rollout status.
- P016-P030: Core trading contracts exist under `schemas/trading/`.
- P031-P032: Safe examples and golden fixture catalog exist under `examples/trading/`.
- P033: `trading:validate` validates pack registration, schemas, examples, and safety invariants.
- P034: This document provides the operator-facing domain pack documentation baseline.
- P035: `trading:dashboard` emits a read-only dashboard/API stub with no mutating order routes.

## P036-P060 Acceptance Criteria

- P036-P042: `examples/trading/strategy-archetype-registry.json` registers the strategy archetype registry and the equity long/short, equity market neutral, statistical arbitrage, short bias, relative value, and pairs trading archetypes.
- P043-P050: Convertible/fixed income arbitrage, event-driven, global macro, managed futures/CTA, volatility/tail-risk, and multi-strategy allocator are represented with research-only or paper-only tradability boundaries.
- P045-P046: Corporate action and crypto event models cover merger, earnings, corporate action, listing, delisting, unlock, fork, and tokenomics events.
- P051-P054: Every archetype declares required data, tradability constraints, risk model, and standardized `trading-signal.v1` output.
- P055-P058: Strategy conflict, correlation, capacity/liquidity, and draft/active/disabled/retired lifecycle models are defined.
- P059: This document records the strategy taxonomy boundary and keeps it separate from live recommendation or execution behavior.
- P060: `trading:strategy-taxonomy` validates the taxonomy registry, fixture expectations, no-live boundary, and package/pack registration.

## P061-P090 Acceptance Criteria

- P061-P062: `examples/trading/market-data-feature-store.json` defines CSV/manual import adapters and normalized `trading-market-data.v1` OHLCV artifacts.
- P063-P066: Korea stock, US stock, crypto 24/7 sessions, and manual FX snapshots are represented without live vendor feeds.
- P067-P071: Corporate action placeholders and stale, missing, duplicate candle, and abnormal price/spread quality checks are declared.
- P072-P081: Liquidity, volatility, momentum, mean-reversion, correlation, regime, macro placeholder, event placeholder, on-chain placeholder, and sentiment/news placeholder features are registered.
- P082-P085: Feature snapshots are versioned, lineage-bound, leakage-checked, and assigned quality scores.
- P086-P087: Data vendor abstraction is stub-only and deterministic replay mode requires source snapshots.
- P088-P089: `trading:market-data-report` and `trading:feature-report` validate market data, feature artifacts, fixture expectations, and no-live boundaries.
- P090: Feature store dashboard/API routes are read-only GET routes; live feed and credential routes remain disabled.

## P091-P125 Acceptance Criteria

- P091-P099: `examples/trading/signal-engine.json` defines the strategy adapter interface and rule-based, technical indicator, factor, macro, event-driven, crypto on-chain placeholder, sentiment placeholder, and DL model adapters.
- P100-P104: Signal candidates use `trading-signal.v1`, include confidence, rationale, source bindings, and pass freshness gates.
- P105-P109: Conflict detection, signal aggregation, multi-strategy weights, correlation penalty, and risk-adjusted signal score are declared without automatic order generation.
- P110-P111: Signal review queue covers every candidate and the signal-to-order-intent boundary remains blocked with zero generated order intents.
- P112-P114: Drift detection, decay tracking, and signal attribution are represented with source and feature lineage requirements.
- P115: `trading:signal-report` validates the signal engine fixture, signal artifacts, source bindings, fixture expectations, and package/pack registration.
- P116-P125: Tests, golden fixtures, read-only dashboard/API routes, docs, and release-gate registration are present; mutating signal-to-order and order routes remain disabled.

## P126-P165 Acceptance Criteria

- P126-P128: `examples/trading/model-improvement-layer.json` defines the model registry, dataset registry, and label generation contract without future-feature access.
- P129-P132: Train/validation/test and walk-forward splits are chronological, and time-series plus target leakage guards must pass before promotion.
- P133-P138: Explainability artifacts, baseline model, sequence placeholder, temporal transformer placeholder, ensemble placeholder, and reinforcement-learning placeholder are registered as research-only `trading-model.v1` artifacts.
- P139-P143: Hyperparameter search, retraining candidate, model scorecards, degradation checks, and drift checks are deterministic and block promotion when unsafe.
- P144-P149: Model promotion candidate, promotion policy gate, rollback, champion/challenger, auto-improvement loop, and live-deployment boundary all require human review and keep live deployment, order intent, and real execution blocked.
- P150-P151: `trading:model-train-report` and `trading:model-eval-report` validate the model improvement fixture, model artifacts, promotion artifacts, fixture expectations, and package/pack registration.
- P152-P165: Tests, golden fixtures, audit replay, read-only dashboard/API routes, docs, and release-gate registration are present; model promote-live, model-to-order-intent, and order routes remain disabled.

## P166-P195 Acceptance Criteria

- P166-P168: `examples/trading/backtest-validation.json` defines a deterministic backtest runner with strategy-version and model-version bindings.
- P169-P173: Transaction cost, slippage, FX conversion, crypto fee, and position-sizing models are declared with no leverage or live execution.
- P174-P181: Portfolio-level, multi-strategy, benchmark, CAGR/return/drawdown/win-rate/payoff, risk-adjusted, exposure, turnover, and capacity metrics are represented as reviewable artifacts.
- P182-P185: Lookahead-bias, survivorship-bias, overfitting, and walk-forward validation checks are present and block promotion when unsafe.
- P186-P188: Liquidity stress, crash-regime replay, and crypto 24/7 weekend-gap replay are present as deterministic stress scenarios.
- P189-P190: `trading:backtest-report` validates backtest artifacts and emits a read-only dashboard/API surface.
- P191-P195: Tests, golden fixtures, fixture regression hashes, docs, and release-gate registration are present; backtest promotion, backtest-to-order-intent, and order routes remain disabled.

## P196-P220 Acceptance Criteria

- P196-P202: `examples/trading/risk-engine.json` defines portfolio exposure, asset-class exposure, single-name concentration, altcoin allocation, daily loss, weekly loss, and max-drawdown halt limits.
- P203-P208: Volatility, liquidity, stale data, abnormal spread, correlated exposure, and FX exposure guards are bound to feature/data lineage and can block or warn before order intent.
- P209-P214: Leverage/margin, short-selling, order frequency, loss-streak cooldown, model degradation, and data outage gates are present; leverage, margin, shorting, and order generation remain blocked by default.
- P215-P217: Risk results support `pass`, `warn`, `block`, and `halt`; overrides require human approval and protected-action gates; risk audit events are replayable and pending review.
- P218-P219: `trading:risk-check` validates the risk engine fixture and emits a read-only dashboard/API surface.
- P220: Risk freeze is locked to the fixture and golden regression path; risk override, signal-to-order-intent, and order routes remain disabled.

## P221-P245 Acceptance Criteria

- P221-P225: `examples/trading/paper-shadow-live.json` defines a paper order ledger, deterministic fill simulator, partial/rejected fill models, paper PnL, and paper drawdown.
- P226-P229: Strategy/model paper scorecards, paper/live parity, and promotion criteria to shadow are present and require human review; shadow-live enablement remains disabled.
- P230-P233: Read-only live data adapter, shadow signal generation, non-executable shadow order intents, and no-order shadow mode are present; broker/exchange writes and real orders remain blocked.
- P234-P238: Intended-fill vs market comparison, latency measurement, data outage detection, shadow PnL estimate, and shadow/live drift report are represented as review-only artifacts.
- P239-P240: Kill switch dry run and promotion criteria to limited live are present; limited live remains blocked.
- P241-P245: `trading:paper-report` and `trading:shadow-report` validate the paper/shadow fixture, tests, golden fixtures, read-only dashboard/API, and operator integration; shadow-live, shadow-order, and real-order routes remain disabled.

## P246-P280 Acceptance Criteria

- P246-P249: `examples/trading/execution-engine.json` freezes the order-intent schema, requires the pre-trade risk gate, whitelists limit/cancel only, and disables market orders.
- P250-P255: Limit/cancel support, order throttle, duplicate prevention, idempotency keys, and execution state machine are present as simulation-only controls.
- P256-P262: Broker and crypto exchange adapter interfaces, credential broker contract, secret handling, sandbox adapter, simulated broker adapter, and live-disabled adapter are represented; live writes, external network, credential lookup, and secret logging remain disabled.
- P263-P267: Execution audit trail, fill reconciliation, failed-order handling, emergency halt, and manual-resume-only policy are present and human-reviewable.
- P268-P270: Execution dashboard/API and `trading:execution-report` are registered as read-only validation surfaces.
- P271-P280: Execution regression cases cover schema validation, order whitelist, market-order block, idempotency, adapter boundaries, secret boundary, fill reconciliation, emergency halt, manual resume, and no-write check.

## P281-P310 Acceptance Criteria

- P281-P285: `examples/trading/limited-live-governance.json` defines the explicit human approval gate, capital cap, asset whitelist, strategy whitelist, and model whitelist while keeping `limited_live_enabled` false.
- P286-P291: Order size cap, daily order count cap, daily loss halt, exchange/broker outage halt, stale data halt, and abnormal spread halt are enforced before any live order submission route can exist.
- P292-P294: First trade manual confirmation, stale order auto-cancel policy, and post-trade reconciliation are present; no live order, live cancel, or live fill is produced.
- P295-P299: Daily live report, local incident notification, rollback-to-paper policy, live-vs-paper comparison, and model live degradation check are reviewable artifacts tied to prior paper/shadow, risk, model, and execution outputs.
- P300-P301: Promotion criteria to full auto and limited-live freeze report exist, but full-auto enablement and limited-live enablement remain blocked.
- P302-P310: `trading:limited-live-report` validates tests, golden fixtures, read-only dashboard/API routes, runbook/operator-handbook requirements, no-write behavior, release-gate registration, and this ledger entry.

## P311-P330 Acceptance Criteria

- P311-P313: `examples/trading/full-auto-governance.json` defines the full-auto approval checklist plus strategy and model health scoring, with no approval receipt and no full-auto eligibility granted.
- P314-P315: Automatic strategy/model disable policies are control-plane state changes only; they do not touch live orders or broker/exchange adapters.
- P316-P320: Portfolio capital, multi-strategy conflict, risk budget, regime detection, and market stress allocators are present as dry-run-only governance surfaces with no live allocation changes.
- P321-P322: Data vendor failover is read-only and local/fixture-bound; broker/exchange failover falls back to paper and cannot enable live writes.
- P323-P327: Monthly strategy review, audit replay, disaster recovery, tax/export placeholder, and full-auto operator handbook are represented with human review and manual resume requirements.
- P328-P330: Full-auto dashboard/API and final safety regression suite are registered; full-auto approval, automatic order submission, allocator apply, broker failover, and generic order routes remain disabled.

## P331-P340 Acceptance Criteria

- P331-P333: Trading Pack v1 freeze checklist, schema/manifest registration, and golden fixture lock exist under `examples/trading/full-auto-governance.json` and `examples/trading/full-auto-governance-golden-fixtures.json`.
- P334-P335: Check-mode no-write behavior and the `npm run validate` chain include `trading:full-auto-report -- --check`.
- P336-P337: `contracts:validate -- --check` and `release:freeze -- --check` are required final gates before claiming Trading Pack v1 freeze.
- P338-P340: `trading:full-auto-report` writes the freeze artifact, this ledger records P340 as the Trading Pack completion baseline, and live/full-auto enablement remains disallowed.

## Promotion Policy

Promotion is stage-gated in this order: research -> backtest -> paper -> shadow_live -> limited_live -> full_auto.
The current implementation blocks every stage after paper. A future phase may only open a blocked stage when all of these are true:

- deterministic validation artifacts are green;
- risk gates return pass or explicitly reviewed warn;
- human approval receipt exists;
- rollback-to-paper path is tested;
- kill switch has been dry-run;
- credentials are brokered outside model context and never logged;
- audit replay can reconstruct the decision path.

## Non-Goal

The Trading Pack is not a broker, exchange connector, investment adviser, or autonomous trading bot in this phase.
It is a deterministic Hermes control-plane pack for organizing trading research workflows and proving that unsafe
execution paths remain blocked.

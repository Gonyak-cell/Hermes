# Trading Promotion Governance Readonly Fixtures

`trading:promotion-governance-readonly-fixtures` is the P403 Platform Operations
Stability fixture layer for Trading promotion governance.

It consumes the P402 promotion completion gate fixture chain in memory and
proves that promotion governance reports can be active or complete only as
read-only evidence. They do not mark any higher stage complete for enablement.

The command does not receive receipts, apply approvals, submit orders, enable
shadow-live, enable limited-live, enable full-auto, write broker/exchange state,
mutate artifacts in `--check`, execute commands, or perform protected actions.

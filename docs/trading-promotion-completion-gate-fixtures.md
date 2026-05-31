# Trading Promotion Completion Gate Fixtures

`trading:promotion-completion-gate-fixtures` is the P402 Platform Operations
Stability fixture layer for Trading promotion governance.

It consumes the P401 promotion receipt contract fixture chain in memory and
builds one completion gate for each promotion hop. Each gate proves that a
higher stage cannot be marked complete for enablement until its independent
human approval receipt exists.

The command does not receive, validate, apply, or materialize receipts. It keeps
governance reports as read-only control-plane evidence while shadow-live,
limited-live, full-auto, live execution, order submission, broker writes,
exchange writes, artifact mutation, command execution, and protected actions
remain blocked in `--check`.

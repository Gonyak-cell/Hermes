# Trading Promotion Receipt Contract Fixtures

`trading:promotion-receipt-contract-fixtures` is the P401 Platform Operations
Stability fixture layer for Trading promotion governance.

It consumes the P400 data-outage halt fixture chain in memory, then declares
independent human approval receipt contracts for:

- research to backtest
- backtest to paper
- paper to shadow-live
- shadow-live to limited-live
- limited-live to full-auto
- full-auto activation

The command does not receive, validate, apply, or materialize human receipts. It
only proves that promotion claims have distinct future receipt contracts, that
governance reports may be complete while real enablement remains false, and that
shadow-live, limited-live, full-auto, live execution, broker writes, exchange
writes, command execution, artifact mutation, and protected actions remain
blocked in `--check`.

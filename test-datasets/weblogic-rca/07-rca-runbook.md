# WebLogic RCA Runbook

Use this runbook to test retrieval with log files.

## Startup stuck in ADMIN or STARTING

Check the first subsystem failure before reviewing later stuck thread warnings. A server can remain in ADMIN when a required deployment fails activation.

Common causes:

- JDBC pool cannot create initial connections.
- JMS persistent store cannot open.
- MDB destination is unavailable.
- Application deployment fails during servlet preload.

Evidence to collect:

- First BEA error in chronological order.
- Server state transition line.
- Failed subsystem health line.
- Deployment task ID and application name.

## JDBC pool exhaustion

Pool exhaustion is usually confirmed by `PoolLimitSQLException`, high active connection count, and waiting connection count.

Separate facts from probable causes:

- Confirmed fact: no available connections in the pool.
- Probable cause: leaked connection, slow SQL, or database process limit.
- Risk: increasing max capacity can overload the database if the database is already at process limit.

Recommended next steps:

- Review leaked connection stack.
- Check database process/session limit.
- Review slow SQL and missing indexes.
- Validate connection close logic in application error paths.

## JMS persistent store failure

JMS failures often cascade into MDB deployment failures. If the JMS server cannot activate, destinations will not be available.

Recommended next steps:

- Back up the store directory before recovery.
- Check disk permissions and mount health.
- Use store admin recovery for corrupted records.
- Restore from a clean snapshot when corruption is confirmed.

## Web service timeout

If stuck threads are blocked in SOAP or REST client calls, check downstream service latency before tuning WebLogic threads.

Recommended next steps:

- Validate downstream health.
- Lower read timeout.
- Use a dedicated Work Manager.
- Add circuit breaker behavior in the application.

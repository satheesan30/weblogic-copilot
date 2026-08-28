# WebLogic Copilot Test Dataset

Synthetic dataset for testing WebLogic Copilot upload, chunking, embedding, ChromaDB indexing, retrieval, citations, and RCA answers.

## Files

- `01-managed-server-startup-stuck.log`: startup stuck in `ADMIN` due to JDBC and JMS dependency failures.
- `02-jdbc-pool-exhaustion.log`: JDBC connection pool exhaustion with leaked connection and database process limit.
- `03-jms-persistent-store-failure.log`: JMS persistent store corruption causing JMS server and MDB activation failure.
- `04-deployment-classloading-conflict.log`: deployment failure caused by duplicate JAX-RS classes.
- `05-webservice-timeout-and-stuck-thread.log`: stuck threads caused by downstream SOAP timeout.
- `06-node-manager-ssl-handshake.log`: Node Manager SSL hostname verification failure.
- `07-rca-runbook.md`: general RCA guidance for retrieval testing.
- `08-domain-config-notes.properties`: domain, JDBC, JMS, Work Manager, web service, and Node Manager settings.

## How To Use

1. Start Ollama, ChromaDB, and the app.
2. Open the Upload page.
3. Upload all files from this folder.
4. Wait until indexing finishes.
5. Go to Chat and ask the test questions below.

## Test Questions

Ask these after indexing:

```text
Why did ms-payments-01 stay in ADMIN instead of RUNNING?
```

Expected evidence:

- `payments-app` failed activation.
- `FinanceXADataSource` could not create connections.
- `PaymentFileStore` permission denied.
- `PaymentSettlementQueue` unavailable.

```text
Find the root cause of the OrdersCoreDS incident.
```

Expected evidence:

- `PoolLimitSQLException`
- `ActiveConnectionsCurrentCount=50`
- leaked connection from `OrderSearchDAO.findOrders`
- database `ORA-00020`

```text
Why did BillingJMSServer fail to start?
```

Expected evidence:

- `BillingFileStore` corrupted record.
- checksum mismatch.
- JMS server could not activate.
- MDB destination unavailable.

```text
Explain the portal-ui deployment failure.
```

Expected evidence:

- duplicate `javax.ws.rs.core.Application`
- `jsr311-api-1.1.1.jar`
- `NoSuchMethodError`
- servlet preload failure.

```text
Why are claims requests getting stuck?
```

Expected evidence:

- outbound SOAP call to `PolicyValidation`
- read timeout.
- stuck threads in `PolicyClient.validatePolicy`.
- Work Manager overload.

```text
Why cannot AdminServer start ms-inventory-02 through Node Manager?
```

Expected evidence:

- Node Manager TCP port reachable.
- SSL hostname verification failed.
- certificate CN/SAN mismatch.

## Good Answer Criteria

The assistant should:

- Separate confirmed facts from probable causes.
- Cite the relevant uploaded files.
- Mention the first failure in chronological order.
- Avoid inventing services, hosts, or fixes not present in the dataset.
- Provide next steps that match the incident evidence.

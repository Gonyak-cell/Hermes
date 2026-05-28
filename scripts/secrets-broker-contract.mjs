#!/usr/bin/env node
import { runSecretsBrokerContractCli } from "../src/secrets-broker-contract.mjs";

await runSecretsBrokerContractCli(process.argv.slice(2));

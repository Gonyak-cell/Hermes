#!/usr/bin/env node
import { runDomainPackRegistryCli } from "../src/domain-pack-registry.mjs";

await runDomainPackRegistryCli(process.argv.slice(2));

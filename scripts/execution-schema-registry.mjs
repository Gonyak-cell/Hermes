#!/usr/bin/env node
import { runExecutionSchemaRegistryCli } from "../src/execution-schema-registry.mjs";

await runExecutionSchemaRegistryCli(process.argv.slice(2));

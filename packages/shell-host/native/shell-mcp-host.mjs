#!/usr/bin/env node
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TOOL_DEFINITIONS } from './contracts.mjs';
import { createFileToolHandlers } from './file-provider.mjs';
import { createNativeMessageChannel, NATIVE_EOF } from './framing.mjs';
import { createHostLogger } from './logger.mjs';
import { initializeHostEnvironment } from './os-adapter.mjs';
import { readShellHostPackageMetadata } from './package-metadata.mjs';
import { createPickerToolHandlers } from './picker-provider.mjs';
import { createProcessToolHandlers } from './process-provider.mjs';
import { createNativeRouter, jsonRpcError } from './router.mjs';
import { createSessionProvider } from './session-provider.mjs';
import { createSkillToolHandlers } from './skill-provider.mjs';

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const packageMetadata = readShellHostPackageMetadata();
const logger = createHostLogger();
initializeHostEnvironment(packageRoot, logger.logLine);

const sessionProvider = createSessionProvider({ logLine: logger.logLine });
const router = createNativeRouter({
  toolDefinitions: TOOL_DEFINITIONS,
  toolHandlerGroups: [
    createProcessToolHandlers(),
    createSkillToolHandlers(),
    createPickerToolHandlers(),
    createFileToolHandlers({ logLine: logger.logLine }),
    sessionProvider.handlers,
  ],
  logger,
  serverVersion: packageMetadata.version,
});
const channel = createNativeMessageChannel({ logLine: logger.logLine });
const inFlight = new Set();
let toolCallTail = Promise.resolve();

async function main() {
  while (true) {
    const envelope = await channel.readMessage();
    if (envelope === NATIVE_EOF) break;
    scheduleEnvelope(envelope);
  }
  await Promise.allSettled([...inFlight]);
  sessionProvider.shutdown();
}

function scheduleEnvelope(envelope) {
  const run = () => handleEnvelope(envelope);
  const task = isToolCallEnvelope(envelope)
    ? toolCallTail.then(run, run)
    : run();
  if (isToolCallEnvelope(envelope)) {
    toolCallTail = task.then(() => undefined, () => undefined);
  }
  inFlight.add(task);
  void task.then(
    () => inFlight.delete(task),
    () => inFlight.delete(task),
  );
}

async function handleEnvelope(envelope) {
  try {
    const response = await router.handleEnvelope(envelope);
    if (response) await channel.writeMessage(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.logLine(`Error: ${message}`);
    await channel.writeMessage(jsonRpcError(null, -32603, message || 'Internal error'));
  }
}

function isToolCallEnvelope(envelope) {
  return envelope?.protocol === 'deepseek-pp-mcp-native'
    && envelope?.version === 1
    && envelope?.message?.jsonrpc === '2.0'
    && envelope?.message?.method === 'tools/call';
}

main().catch(error => {
  const message = error instanceof Error ? error.message : String(error);
  logger.logLine(`Fatal: ${message}`);
  sessionProvider.shutdown();
  process.exit(1);
});

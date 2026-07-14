import type { ToolExecutionRecord } from '../types';
import { INCOMPLETE_TOOL_CALL_ERROR_CODE } from '../tool/execution-error';

export { INCOMPLETE_TOOL_CALL_ERROR_CODE } from '../tool/execution-error';

export function selectContinuableToolExecutions(
  executions: readonly ToolExecutionRecord[],
): ToolExecutionRecord[] {
  return executions.filter((execution) =>
    !execution.pending &&
    execution.result.error?.code !== INCOMPLETE_TOOL_CALL_ERROR_CODE &&
    (
      execution.provider?.kind === 'mcp' ||
      execution.provider?.id === 'web' ||
      execution.provider?.id === 'browser_control' ||
      execution.name === 'web_search' ||
      execution.name === 'web_fetch' ||
      execution.name.startsWith('browser_')
    ));
}

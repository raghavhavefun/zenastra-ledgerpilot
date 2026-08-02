// src/utils/helpers.ts
// Shared helper functions for tool modules

import { TallyConnectionError, TallyResponseError } from './client.mjs';

/**
 * Build a standard MCP tool result
 */
export function result(data: object) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
}

/**
 * Handle errors uniformly across all tools
 */
export function handleError(err: unknown) {
  if (err instanceof TallyConnectionError) {
    return result({
      status: 'connection_error',
      message: 'TallyPrime is not running or XML server not enabled.',
      fix: 'Go to F1 → Settings → Advanced Configuration → Enable HTTP Server on port 9000',
    });
  }
  if (err instanceof TallyResponseError) {
    return result({
      status: 'tally_rejection',
      message: err.message,
      raw_response_excerpt: err.rawXml?.substring(0, 400),
    });
  }
  return result({
    status: 'internal_error',
    message: String(err),
  });
}

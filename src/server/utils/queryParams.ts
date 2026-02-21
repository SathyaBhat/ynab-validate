/**
 * Utility functions for safely extracting query parameters
 */

// Express ParsedQs type (query string parameters can be nested objects)
type QueryValue = string | string[] | Record<string, any> | undefined;

/**
 * Extract a single string value from a query parameter
 * Handles Express ParsedQs type: string | string[] | ParsedQs | undefined
 */
export function getQueryString(value: QueryValue, defaultValue = ''): string {
  if (typeof value === 'string') {
    return value;
  }
  if (Array.isArray(value)) {
    const first = value[0];
    return typeof first === 'string' ? first : defaultValue;
  }
  return defaultValue;
}

/**
 * Parse an integer from a query parameter with a default value
 */
export function getQueryInt(
  value: QueryValue,
  defaultValue: number,
  min?: number,
  max?: number,
): number {
  const str = getQueryString(value);
  const parsed = parseInt(str, 10);

  if (isNaN(parsed)) {
    return defaultValue;
  }

  let result = parsed;

  if (min !== undefined) {
    result = Math.max(result, min);
  }

  if (max !== undefined) {
    result = Math.min(result, max);
  }

  return result;
}

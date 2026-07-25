/** RFC 4122 UUID matcher (versions 1–5). */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Whether a string is a well-formed UUID.
 *
 * Used to reject malformed ids before they reach a `uuid`-typed SQL column,
 * where Postgres would otherwise raise (500) instead of a clean 400/404.
 */
export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

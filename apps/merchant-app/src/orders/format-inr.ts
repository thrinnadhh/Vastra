/**
 * Re-exports the authoritative formatPaiseAsInr from @vastra/formatting.
 *
 * Existing consumers within merchant-app import from this path.
 * New code should import directly from '@vastra/formatting'.
 */
export { formatPaiseAsInr } from '@vastra/formatting';

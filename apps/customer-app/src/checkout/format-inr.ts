/**
 * Re-exports the authoritative formatPaiseAsInr from @vastra/formatting.
 *
 * Existing consumers within customer-app import from this path.
 * New code should import directly from '@vastra/formatting'.
 */
export { formatPaiseAsInr } from '@vastra/formatting';

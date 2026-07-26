/**
 * Authoritative currency, distance, and price-range formatting for Vastra.
 *
 * Rules:
 * - Money is always stored as integer paise (non-negative).
 * - Currency display uses the Indian numbering system (₹ prefix).
 * - Distance is shown in metres when < 1 km, else kilometres to 1 decimal.
 */

// ---------------------------------------------------------------------------
// Currency
// ---------------------------------------------------------------------------

/**
 * Format an integer paise value as Indian Rupees with 2 decimal places.
 *
 * Uses deterministic manual Indian digit grouping (no Intl dependency)
 * to guarantee consistent output across all JavaScript runtimes.
 *
 * @example formatPaiseAsInr(0)          → '₹0.00'
 * @example formatPaiseAsInr(123_456)    → '₹1,234.56'
 * @example formatPaiseAsInr(12_34_56_789) → '₹12,34,567.89'
 */
export function formatPaiseAsInr(paise: number): string {
  if (!Number.isSafeInteger(paise) || paise < 0) {
    throw new TypeError('Money must be a non-negative integer number of paise');
  }

  const rupees = Math.floor(paise / 100);
  const remainingPaise = paise % 100;

  return `₹${groupIndian(rupees)}.${String(remainingPaise).padStart(2, '0')}`;
}

/**
 * Format an integer paise value as Indian Rupees without decimals.
 *
 * Used in discovery / catalogue contexts where sub-rupee precision
 * is unnecessary and a compact display is preferred.
 *
 * @example formatPaiseAsInrCompact(50_000) → '₹500'
 * @example formatPaiseAsInrCompact(12_34_56_789) → '₹12,34,567'
 */
export function formatPaiseAsInrCompact(paise: number): string {
  if (!Number.isSafeInteger(paise) || paise < 0) {
    throw new TypeError('Money must be a non-negative integer number of paise');
  }

  const rupees = Math.floor(paise / 100);
  return `₹${groupIndian(rupees)}`;
}

/**
 * Apply Indian digit grouping to a non-negative integer.
 *
 * Indian grouping: rightmost 3 digits, then groups of 2.
 * 1234567 → "12,34,567"
 */
function groupIndian(value: number): string {
  const digits = String(value);
  if (digits.length <= 3) return digits;

  const lastThree = digits.slice(-3);
  const leading = digits.slice(0, -3);
  const groupedLeading = leading.replace(/\B(?=(\d{2})+(?!\d))/gu, ',');
  return `${groupedLeading},${lastThree}`;
}

// ---------------------------------------------------------------------------
// Distance
// ---------------------------------------------------------------------------

export interface FormatDistanceOptions {
  /** Append directional suffix ("away"). Defaults to true. */
  readonly suffix?: boolean;
}

/**
 * Format a distance in metres for human display.
 *
 * - Below 1 km → rounded metres (e.g. "350 m away")
 * - At or above 1 km → 1-decimal kilometres (e.g. "2.3 km away")
 * - When distanceMeters is null → "Distance pending"
 *
 * @example formatDistance(350)         → '350 m away'
 * @example formatDistance(2300)        → '2.3 km away'
 * @example formatDistance(350, { suffix: false }) → '350 m'
 * @example formatDistance(null)        → 'Distance pending'
 */
export function formatDistance(
  distanceMeters: number | null,
  options?: FormatDistanceOptions,
): string {
  if (distanceMeters === null) return 'Distance pending';

  const suffix = options?.suffix !== false ? ' away' : '';

  if (distanceMeters < 1000) {
    return `${String(Math.round(distanceMeters))} m${suffix}`;
  }

  return `${(distanceMeters / 1000).toFixed(1)} km${suffix}`;
}

// ---------------------------------------------------------------------------
// Price Range
// ---------------------------------------------------------------------------

/**
 * Format a min/max paise price range for product display.
 *
 * Uses compact (no-decimal) formatting for catalogue contexts.
 *
 * @example formatPriceRange(50_000, 50_000) → '₹500'
 * @example formatPriceRange(50_000, 100_000) → '₹500–₹1,000'
 * @example formatPriceRange(null, null)      → 'Price unavailable'
 */
export function formatPriceRange(minPaise: number | null, maxPaise: number | null): string {
  if (minPaise === null) {
    return 'Price unavailable';
  }

  if (maxPaise !== null && maxPaise !== minPaise) {
    return `${formatPaiseAsInrCompact(minPaise)}–${formatPaiseAsInrCompact(maxPaise)}`;
  }

  return formatPaiseAsInrCompact(minPaise);
}

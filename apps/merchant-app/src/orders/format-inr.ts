export function formatPaiseAsInr(paise: number): string {
  if (!Number.isSafeInteger(paise) || paise < 0) {
    throw new TypeError('Money must be a non-negative integer number of paise');
  }

  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: paise % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(paise / 100);
}

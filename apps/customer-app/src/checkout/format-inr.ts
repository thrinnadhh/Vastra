export function formatPaiseAsInr(paise: number): string {
  if (!Number.isSafeInteger(paise) || paise < 0) {
    throw new TypeError('Money must be a non-negative integer number of paise');
  }

  const rupees = Math.floor(paise / 100);
  const remainingPaise = paise % 100;
  const digits = String(rupees);
  const lastThree = digits.slice(-3);
  const leading = digits.slice(0, -3);
  const groupedLeading = leading.replace(/\B(?=(\d{2})+(?!\d))/gu, ',');
  const groupedRupees = leading.length === 0 ? lastThree : `${groupedLeading},${lastThree}`;

  return `₹${groupedRupees}.${String(remainingPaise).padStart(2, '0')}`;
}

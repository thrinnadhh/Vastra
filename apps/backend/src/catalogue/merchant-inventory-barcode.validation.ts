const MAX_BARCODE_LENGTH = 255;

export class MerchantInventoryBarcodeValidationError extends Error {
  public constructor() {
    super('Merchant inventory barcode is invalid');
    this.name = 'MerchantInventoryBarcodeValidationError';
  }
}

function containsControlCharacter(value: string): boolean {
  for (const character of value) {
    const codePoint = character.codePointAt(0);

    if (codePoint === undefined || codePoint <= 31 || codePoint === 127) {
      return true;
    }
  }

  return false;
}

export function parseMerchantInventoryBarcode(value: unknown): string {
  if (typeof value !== 'string') {
    throw new MerchantInventoryBarcodeValidationError();
  }

  const barcode = value.trim();

  if (
    barcode.length === 0 ||
    barcode.length > MAX_BARCODE_LENGTH ||
    containsControlCharacter(barcode)
  ) {
    throw new MerchantInventoryBarcodeValidationError();
  }

  return barcode;
}

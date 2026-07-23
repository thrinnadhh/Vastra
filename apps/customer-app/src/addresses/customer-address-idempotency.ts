type CryptoLike = Readonly<{ randomUUID?: () => string }>;

export function createCustomerAddressIdempotencyKey(): string {
  const randomUuid = (globalThis.crypto as CryptoLike | undefined)?.randomUUID;
  if (randomUuid !== undefined) return randomUuid.call(globalThis.crypto);

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/gu, (character) => {
    const random = Math.floor(Math.random() * 16);
    const value = character === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

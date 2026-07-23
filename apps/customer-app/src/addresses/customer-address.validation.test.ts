import { EMPTY_CUSTOMER_ADDRESS_DRAFT } from './customer-address.types';
import { validateCustomerAddressDraft } from './customer-address.validation';

const VALID = {
  ...EMPTY_CUSTOMER_ADDRESS_DRAFT,
  recipientName: 'Customer',
  phoneNumber: '+919000000001',
  line1: '12 Temple Road',
  area: 'Tiruchanur',
  city: 'Tirupati',
  postalCode: '517501',
  latitude: '13.6288',
  longitude: '79.4192',
};

describe('validateCustomerAddressDraft', () => {
  it('normalizes a valid Indian address without inventing an id or serviceability', () => {
    expect(validateCustomerAddressDraft(VALID)).toEqual({
      input: {
        label: null,
        recipientName: 'Customer',
        phoneNumber: '+919000000001',
        line1: '12 Temple Road',
        line2: null,
        landmark: null,
        area: 'Tiruchanur',
        city: 'Tirupati',
        state: 'Andhra Pradesh',
        postalCode: '517501',
        countryCode: 'IN',
        latitude: 13.6288,
        longitude: 79.4192,
        isDefault: false,
      },
      fieldErrors: {},
    });
  });

  it('returns field-level errors for invalid input', () => {
    const result = validateCustomerAddressDraft({
      ...VALID,
      phoneNumber: '12',
      postalCode: 'abc',
      latitude: '100',
      longitude: '',
    });
    expect(result.input).toBeNull();
    expect(result.fieldErrors.phoneNumber).toBeDefined();
    expect(result.fieldErrors.postalCode).toBeDefined();
    expect(result.fieldErrors.latitude).toBeDefined();
    expect(result.fieldErrors.longitude).toBeDefined();
  });
});

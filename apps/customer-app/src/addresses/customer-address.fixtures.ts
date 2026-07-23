import type { CustomerAddress } from './customer-address.types';

export const CUSTOMER_ADDRESS_FIXTURE: CustomerAddress = {
  id: '11111111-1111-4111-8111-111111111111',
  label: 'Home',
  recipientName: 'Vastra Customer',
  phoneNumber: '+919000000001',
  line1: '12 Temple Road',
  line2: null,
  landmark: 'Near the park',
  area: 'Tiruchanur',
  city: 'Tirupati',
  state: 'Andhra Pradesh',
  postalCode: '517501',
  countryCode: 'IN',
  latitude: 13.6288,
  longitude: 79.4192,
  isDefault: true,
  serviceability: 'SERVICEABLE',
  createdAt: '2026-07-22T10:00:00.000Z',
  updatedAt: '2026-07-22T10:00:00.000Z',
};

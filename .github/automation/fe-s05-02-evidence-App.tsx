import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { CustomerAddressesScreen } from './src/addresses/customer-addresses.screen';
import { CUSTOMER_ADDRESS_FIXTURE } from './src/addresses/customer-address.fixtures';
import type {
  CustomerAddress,
  CustomerAddressFailure,
  CustomerAddressMutationResult,
  CustomerAddressPort,
  DeleteCustomerAddressResult,
  SaveCustomerAddressInput,
} from './src/addresses/customer-address.types';

const SECOND_ADDRESS: CustomerAddress = {
  ...CUSTOMER_ADDRESS_FIXTURE,
  id: '22222222-2222-4222-8222-222222222222',
  label: 'Office',
  line1: '18 Renigunta Road',
  area: 'Near RTC Bus Stand',
  isDefault: false,
};

const scenario =
  new URLSearchParams(globalThis.location?.search ?? '').get('scenario') ?? 'success';

function failed(failureKind: CustomerAddressFailure['failureKind']): CustomerAddressFailure {
  return { kind: 'FAILURE', failureKind, fieldErrors: {}, requiresRefresh: false };
}

class EvidenceAddressPort implements CustomerAddressPort {
  private listCount = 0;

  public async list() {
    this.listCount += 1;
    switch (scenario) {
      case 'loading':
        return await new Promise<never>(() => undefined);
      case 'empty':
        return { kind: 'SUCCESS' as const, addresses: [] };
      case 'error':
        return failed('UNAVAILABLE');
      case 'offline':
        return failed('OFFLINE');
      case 'unauthorized':
        return failed('UNAUTHORIZED');
      case 'session-expired':
        return failed('SESSION_EXPIRED');
      case 'stale':
        return this.listCount === 1
          ? { kind: 'SUCCESS' as const, addresses: [CUSTOMER_ADDRESS_FIXTURE, SECOND_ADDRESS] }
          : failed('OFFLINE');
      default:
        return {
          kind: 'SUCCESS' as const,
          addresses: [CUSTOMER_ADDRESS_FIXTURE, SECOND_ADDRESS],
        };
    }
  }

  public async create(
    _input: SaveCustomerAddressInput,
    _idempotencyKey: string,
  ): Promise<CustomerAddressMutationResult> {
    return failed('UNAVAILABLE');
  }

  public async update(
    _addressId: string,
    _input: SaveCustomerAddressInput,
    _idempotencyKey: string,
  ): Promise<CustomerAddressMutationResult> {
    return failed('UNAVAILABLE');
  }

  public async remove(
    _addressId: string,
    _idempotencyKey: string,
  ): Promise<DeleteCustomerAddressResult> {
    return failed('UNAVAILABLE');
  }

  public async setDefault(
    _addressId: string,
    _idempotencyKey: string,
  ): Promise<CustomerAddressMutationResult> {
    return failed('UNAVAILABLE');
  }
}

export default function AddressEvidenceApp() {
  const port = useMemo(() => new EvidenceAddressPort(), []);
  return (
    <View style={styles.page}>
      <View style={styles.shell}>
        <CustomerAddressesScreen
          addressPort={port}
          mode="CHECKOUT"
          selectedAddressId={CUSTOMER_ADDRESS_FIXTURE.id}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, minHeight: '100vh', alignItems: 'center', backgroundColor: '#E9EDF3' },
  shell: { width: '100%', maxWidth: 760, minHeight: '100vh', backgroundColor: '#F7F8FA' },
});

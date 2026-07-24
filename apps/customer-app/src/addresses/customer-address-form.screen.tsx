import { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { createCustomerAddressIdempotencyKey } from './customer-address-idempotency';
import type {
  CustomerAddress,
  CustomerAddressDraft,
  CustomerAddressField,
  CustomerAddressFieldErrors,
  CustomerAddressPort,
} from './customer-address.types';
import { EMPTY_CUSTOMER_ADDRESS_DRAFT } from './customer-address.types';
import { validateCustomerAddressDraft } from './customer-address.validation';

const NOOP_SECURITY_FAILURE = (kind: 'SESSION_EXPIRED' | 'UNAUTHORIZED'): void => {
  void kind;
};

interface CustomerAddressFormScreenProps {
  readonly address: CustomerAddress | null;
  readonly addressPort: CustomerAddressPort;
  readonly onCancel: () => void;
  readonly onSaved: (address: CustomerAddress) => void;
  readonly onSecurityFailure?: (kind: 'SESSION_EXPIRED' | 'UNAUTHORIZED') => void;
  readonly createIdempotencyKey?: () => string;
}

const toDraft = (address: CustomerAddress | null): CustomerAddressDraft =>
  address === null
    ? EMPTY_CUSTOMER_ADDRESS_DRAFT
    : {
        label: address.label ?? '',
        recipientName: address.recipientName,
        phoneNumber: address.phoneNumber,
        line1: address.line1,
        line2: address.line2 ?? '',
        landmark: address.landmark ?? '',
        area: address.area,
        city: address.city,
        state: address.state,
        postalCode: address.postalCode,
        latitude: String(address.latitude),
        longitude: String(address.longitude),
        isDefault: address.isDefault,
      };

function failureMessage(kind: string): string {
  switch (kind) {
    case 'OFFLINE':
      return 'You appear to be offline. Your address details are still here; reconnect and try again.';
    case 'SESSION_EXPIRED':
      return 'Your session expired. Sign in again, then return to save this address.';
    case 'UNAUTHORIZED':
      return 'This account is not allowed to change this address.';
    case 'CONFLICT':
      return 'The address changed elsewhere. Review the latest information and try again.';
    case 'VALIDATION':
      return 'Some address details need correction.';
    default:
      return 'The address could not be saved. Your input has been preserved.';
  }
}

function FormField({
  field,
  label,
  value,
  error,
  onChange,
  keyboardType,
  multiline = false,
}: {
  readonly field: CustomerAddressField;
  readonly label: string;
  readonly value: string;
  readonly error: string | undefined;
  readonly onChange: (value: string) => void;
  readonly keyboardType?: 'default' | 'phone-pad' | 'number-pad' | 'decimal-pad';
  readonly multiline?: boolean;
}) {
  const errorId = `${field}-error`;
  return (
    <View style={styles.field}>
      <Text nativeID={`${field}-label`} style={styles.label}>
        {label}
      </Text>
      <TextInput
        accessibilityLabel={label}
        accessibilityState={{ disabled: false }}
        aria-describedby={error === undefined ? undefined : errorId}
        keyboardType={keyboardType}
        multiline={multiline}
        onChangeText={onChange}
        style={[
          styles.input,
          multiline ? styles.multiline : null,
          error === undefined ? null : styles.inputError,
        ]}
        value={value}
      />
      {error === undefined ? null : (
        <Text accessibilityLiveRegion="polite" nativeID={errorId} style={styles.errorText}>
          {error}
        </Text>
      )}
    </View>
  );
}

export function CustomerAddressFormScreen({
  address,
  addressPort,
  onCancel,
  onSaved,
  onSecurityFailure = NOOP_SECURITY_FAILURE,
  createIdempotencyKey = createCustomerAddressIdempotencyKey,
}: CustomerAddressFormScreenProps) {
  const [draft, setDraft] = useState<CustomerAddressDraft>(() => toDraft(address));
  const [fieldErrors, setFieldErrors] = useState<CustomerAddressFieldErrors>({});
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setSubmitting] = useState(false);
  const activeSubmissionKey = useRef<string | null>(null);

  const change = <Field extends CustomerAddressField>(
    field: Field,
    value: CustomerAddressDraft[Field],
  ) => {
    setDraft((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => {
      if (current[field] === undefined) return current;
      return Object.fromEntries(
        Object.entries(current).filter(([candidate]) => candidate !== field),
      );
    });
    setMessage(null);
  };

  const submit = async (): Promise<void> => {
    if (isSubmitting) return;
    const validation = validateCustomerAddressDraft(draft);
    if (validation.input === null) {
      setFieldErrors(validation.fieldErrors);
      setMessage('Correct the highlighted address fields.');
      return;
    }

    const key = activeSubmissionKey.current ?? createIdempotencyKey();
    activeSubmissionKey.current = key;
    setSubmitting(true);
    setMessage(null);
    const result =
      address === null
        ? await addressPort.create(validation.input, key)
        : await addressPort.update(address.id, validation.input, key);
    setSubmitting(false);

    if (result.kind === 'SUCCESS') {
      activeSubmissionKey.current = null;
      onSaved(result.address);
      return;
    }

    if (result.failureKind === 'SESSION_EXPIRED' || result.failureKind === 'UNAUTHORIZED') {
      activeSubmissionKey.current = null;
      setDraft(EMPTY_CUSTOMER_ADDRESS_DRAFT);
      setFieldErrors({});
      setMessage(failureMessage(result.failureKind));
      onSecurityFailure(result.failureKind);
      return;
    }
    if (Object.keys(result.fieldErrors).length > 0) setFieldErrors(result.fieldErrors);
    if (result.failureKind === 'CONFLICT' || result.failureKind === 'NOT_FOUND') {
      activeSubmissionKey.current = null;
    }
    setMessage(failureMessage(result.failureKind));
  };

  return (
    <ScrollView
      accessibilityLabel={
        address === null ? 'Add delivery address form' : 'Edit delivery address form'
      }
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <Text accessibilityRole="header" style={styles.title}>
        {address === null ? 'Add delivery address' : 'Edit delivery address'}
      </Text>
      <Text style={styles.intro}>
        Vastra sends these coordinates to the server for serviceability. The server remains the
        source of truth.
      </Text>

      <FormField
        field="label"
        label="Address label"
        value={draft.label}
        error={fieldErrors.label}
        onChange={(value) => {
          change('label', value);
        }}
      />
      <FormField
        field="recipientName"
        label="Recipient name *"
        value={draft.recipientName}
        error={fieldErrors.recipientName}
        onChange={(value) => {
          change('recipientName', value);
        }}
      />
      <FormField
        field="phoneNumber"
        label="Phone number *"
        value={draft.phoneNumber}
        error={fieldErrors.phoneNumber}
        keyboardType="phone-pad"
        onChange={(value) => {
          change('phoneNumber', value);
        }}
      />
      <FormField
        field="line1"
        label="Address line 1 *"
        value={draft.line1}
        error={fieldErrors.line1}
        multiline
        onChange={(value) => {
          change('line1', value);
        }}
      />
      <FormField
        field="line2"
        label="Address line 2"
        value={draft.line2}
        error={fieldErrors.line2}
        multiline
        onChange={(value) => {
          change('line2', value);
        }}
      />
      <FormField
        field="landmark"
        label="Landmark"
        value={draft.landmark}
        error={fieldErrors.landmark}
        onChange={(value) => {
          change('landmark', value);
        }}
      />
      <FormField
        field="area"
        label="Area *"
        value={draft.area}
        error={fieldErrors.area}
        onChange={(value) => {
          change('area', value);
        }}
      />
      <FormField
        field="city"
        label="City *"
        value={draft.city}
        error={fieldErrors.city}
        onChange={(value) => {
          change('city', value);
        }}
      />
      <FormField
        field="state"
        label="State *"
        value={draft.state}
        error={fieldErrors.state}
        onChange={(value) => {
          change('state', value);
        }}
      />
      <FormField
        field="postalCode"
        label="Postal code *"
        value={draft.postalCode}
        error={fieldErrors.postalCode}
        keyboardType="number-pad"
        onChange={(value) => {
          change('postalCode', value);
        }}
      />
      <FormField
        field="latitude"
        label="Latitude *"
        value={draft.latitude}
        error={fieldErrors.latitude}
        keyboardType="decimal-pad"
        onChange={(value) => {
          change('latitude', value);
        }}
      />
      <FormField
        field="longitude"
        label="Longitude *"
        value={draft.longitude}
        error={fieldErrors.longitude}
        keyboardType="decimal-pad"
        onChange={(value) => {
          change('longitude', value);
        }}
      />

      <View style={styles.switchRow}>
        <View style={styles.switchCopy}>
          <Text style={styles.label}>Make default address</Text>
          <Text style={styles.helper}>
            The backend will update the previous default atomically.
          </Text>
        </View>
        <Switch
          accessibilityLabel="Make default address"
          onValueChange={(value) => {
            change('isDefault', value);
          }}
          value={draft.isDefault}
        />
      </View>

      {message === null ? null : (
        <Text accessibilityLiveRegion="assertive" style={styles.message}>
          {message}
        </Text>
      )}

      <Pressable
        accessibilityLabel={address === null ? 'Save new address' : 'Save address changes'}
        accessibilityRole="button"
        accessibilityState={{ disabled: isSubmitting, busy: isSubmitting }}
        disabled={isSubmitting}
        onPress={() => void submit()}
        style={[styles.primary, isSubmitting ? styles.disabled : null]}
      >
        <Text style={styles.primaryText}>{isSubmitting ? 'Saving address…' : 'Save address'}</Text>
      </Pressable>
      <Pressable
        accessibilityLabel="Cancel address editing"
        accessibilityRole="button"
        disabled={isSubmitting}
        onPress={onCancel}
        style={styles.secondary}
      >
        <Text style={styles.secondaryText}>Cancel</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, paddingBottom: 48, backgroundColor: '#FFFFFF' },
  title: { color: '#101828', fontSize: 26, fontWeight: '800' },
  intro: { marginTop: 8, marginBottom: 14, color: '#667085', fontSize: 14, lineHeight: 20 },
  field: { marginTop: 14 },
  label: { color: '#344054', fontSize: 14, fontWeight: '700' },
  input: {
    minHeight: 48,
    marginTop: 6,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#D0D5DD',
    borderRadius: 10,
    color: '#101828',
    backgroundColor: '#FFFFFF',
  },
  multiline: { minHeight: 72, paddingTop: 12, textAlignVertical: 'top' },
  inputError: { borderColor: '#B42318' },
  errorText: { marginTop: 4, color: '#B42318', fontSize: 13 },
  switchRow: {
    marginTop: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  switchCopy: { flex: 1 },
  helper: { marginTop: 3, color: '#667085', fontSize: 12, lineHeight: 17 },
  message: { marginTop: 18, color: '#B42318', fontSize: 14, fontWeight: '700' },
  primary: {
    minHeight: 50,
    marginTop: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: '#8E3B46',
  },
  disabled: { opacity: 0.55 },
  primaryText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  secondary: {
    minHeight: 48,
    marginTop: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D0D5DD',
  },
  secondaryText: { color: '#344054', fontSize: 16, fontWeight: '700' },
});

import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import {
  CUSTOMER_GENDER_CATEGORIES,
  mergeSupportedPreferenceDraft,
  parseCommaSeparatedSizes,
  parseRupeesToPaise,
  validatePreferenceDraft,
  type CustomerGenderCategory,
  type CustomerPreferenceDraft,
  type CustomerPreferenceSnapshot,
  type CustomerPreferencesPort,
  type CustomerProfileIdentity,
} from './customer-profile-preferences.types';

const EMPTY_PREFERENCES: CustomerPreferenceSnapshot = {
  genderCategories: [],
  styleTags: [],
  occasionTags: [],
  preferredColours: [],
  preferredSizes: [],
  minPricePaise: null,
  maxPricePaise: null,
  updatedAt: null,
};

const createDraft = (preferences: CustomerPreferenceSnapshot): CustomerPreferenceDraft => ({
  genderCategories: preferences.genderCategories,
  preferredSizes: preferences.preferredSizes,
  minPricePaise: preferences.minPricePaise,
  maxPricePaise: preferences.maxPricePaise,
});

export function CustomerProfilePreferencesScreen({
  identity,
  preferencesPort,
  onContinue,
}: {
  readonly identity: CustomerProfileIdentity;
  readonly preferencesPort: CustomerPreferencesPort;
  readonly onContinue: () => void;
}) {
  const [existing, setExisting] = useState<CustomerPreferenceSnapshot>(EMPTY_PREFERENCES);
  const [draft, setDraft] = useState<CustomerPreferenceDraft>(createDraft(EMPTY_PREFERENCES));
  const [sizesInput, setSizesInput] = useState('');
  const [minimumRupees, setMinimumRupees] = useState('');
  const [maximumRupees, setMaximumRupees] = useState('');
  const [state, setState] = useState<'LOADING' | 'READY' | 'SAVING'>('LOADING');
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    void preferencesPort.load().then((result) => {
      if (!active) {
        return;
      }

      if (result.kind === 'UNAVAILABLE') {
        setState('READY');
        setMessage('Preferences could not be loaded. You can skip and edit them later.');
        return;
      }

      const loaded = result.preferences;
      setExisting(loaded);
      setDraft(createDraft(loaded));
      setSizesInput(loaded.preferredSizes.join(', '));
      setMinimumRupees(loaded.minPricePaise === null ? '' : String(loaded.minPricePaise / 100));
      setMaximumRupees(loaded.maxPricePaise === null ? '' : String(loaded.maxPricePaise / 100));
      setState('READY');
    });

    return () => {
      active = false;
    };
  }, [preferencesPort]);

  const toggleCategory = (category: CustomerGenderCategory): void => {
    setDraft((current) => ({
      ...current,
      genderCategories: current.genderCategories.includes(category)
        ? current.genderCategories.filter((value) => value !== category)
        : [...current.genderCategories, category],
    }));
  };

  const save = async (): Promise<void> => {
    if (state !== 'READY') {
      return;
    }

    const minPricePaise = parseRupeesToPaise(minimumRupees);
    const maxPricePaise = parseRupeesToPaise(maximumRupees);
    if (minPricePaise === undefined || maxPricePaise === undefined) {
      setMessage('Enter budget amounts in rupees with no more than two decimal places.');
      return;
    }

    const nextDraft: CustomerPreferenceDraft = {
      ...draft,
      preferredSizes: parseCommaSeparatedSizes(sizesInput),
      minPricePaise,
      maxPricePaise,
    };
    const validationMessage = validatePreferenceDraft(nextDraft);
    if (validationMessage !== null) {
      setMessage(validationMessage);
      return;
    }

    setState('SAVING');
    setMessage(null);
    const result = await preferencesPort.save(mergeSupportedPreferenceDraft(nextDraft, existing));
    if (result.kind === 'UNAVAILABLE') {
      setState('READY');
      setMessage('Preferences were not saved. Try again or skip for now.');
      return;
    }

    onContinue();
  };

  const isBusy = state !== 'READY';

  return (
    <View style={styles.screen}>
      <Text accessibilityRole="header" style={styles.title}>
        Your Vastra profile
      </Text>
      <Text style={styles.identity}>{identity.fullName ?? 'Customer profile'}</Text>
      <Text style={styles.note}>
        Your verified account details remain server-owned. Shopping preferences are optional and
        editable later.
      </Text>
      {identity.fullName === null ? (
        <Text accessibilityLiveRegion="polite" style={styles.contractNotice}>
          Name editing is not available until Vastra exposes the approved profile update contract.
          You can continue without creating a false saved profile.
        </Text>
      ) : null}

      <Text style={styles.sectionTitle}>Who are you shopping for?</Text>
      <View style={styles.options}>
        {CUSTOMER_GENDER_CATEGORIES.map((category) => {
          const selected = draft.genderCategories.includes(category);
          return (
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: selected, disabled: isBusy }}
              disabled={isBusy}
              key={category}
              onPress={() => {
                toggleCategory(category);
              }}
              style={[styles.option, selected ? styles.optionSelected : null]}
            >
              <Text style={selected ? styles.optionTextSelected : styles.optionText}>
                {category}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.sectionTitle}>Preferred sizes</Text>
      <TextInput
        accessibilityLabel="Preferred sizes"
        editable={!isBusy}
        onChangeText={setSizesInput}
        placeholder="M, L, XL"
        style={styles.input}
        value={sizesInput}
      />

      <Text style={styles.sectionTitle}>Optional budget per item</Text>
      <TextInput
        accessibilityLabel="Minimum budget in rupees"
        editable={!isBusy}
        keyboardType="decimal-pad"
        onChangeText={setMinimumRupees}
        placeholder="Minimum ₹"
        style={styles.input}
        value={minimumRupees}
      />
      <TextInput
        accessibilityLabel="Maximum budget in rupees"
        editable={!isBusy}
        keyboardType="decimal-pad"
        onChangeText={setMaximumRupees}
        placeholder="Maximum ₹"
        style={styles.input}
        value={maximumRupees}
      />

      {message === null ? null : (
        <Text accessibilityLiveRegion="polite" style={styles.message}>
          {message}
        </Text>
      )}

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: isBusy }}
        disabled={isBusy}
        onPress={() => {
          void save();
        }}
        style={[styles.primary, isBusy ? styles.disabled : null]}
      >
        <Text style={styles.primaryText}>
          {state === 'SAVING' ? 'Saving…' : 'Save and continue'}
        </Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: state === 'SAVING' }}
        disabled={state === 'SAVING'}
        onPress={onContinue}
        style={styles.secondary}
      >
        <Text style={styles.secondaryText}>Skip for now</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: 24, backgroundColor: '#FFF8F2' },
  title: { color: '#241B16', fontSize: 28, fontWeight: '700' },
  identity: { marginTop: 8, color: '#3B3029', fontSize: 16, fontWeight: '600' },
  note: { marginTop: 10, color: '#665A52', fontSize: 14, lineHeight: 20 },
  contractNotice: {
    marginTop: 12,
    padding: 12,
    borderRadius: 10,
    color: '#6A4B00',
    backgroundColor: '#FFF0C2',
    lineHeight: 20,
  },
  sectionTitle: { marginTop: 24, color: '#241B16', fontSize: 17, fontWeight: '700' },
  options: { marginTop: 10, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  option: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#B8AAA0',
    borderRadius: 12,
  },
  optionSelected: { backgroundColor: '#8E3B46', borderColor: '#8E3B46' },
  optionText: { color: '#3B3029', fontWeight: '600' },
  optionTextSelected: { color: '#FFFFFF', fontWeight: '700' },
  input: {
    minHeight: 48,
    marginTop: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#B8AAA0',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
  },
  message: { marginTop: 12, color: '#A12032', lineHeight: 20 },
  primary: {
    minHeight: 48,
    marginTop: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: '#8E3B46',
  },
  disabled: { opacity: 0.55 },
  primaryText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  secondary: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { color: '#6B2D38', fontWeight: '700' },
});

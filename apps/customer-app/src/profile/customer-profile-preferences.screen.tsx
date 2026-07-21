import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import {
  CUSTOMER_GENDER_CATEGORIES,
  parseRupeesToPaise,
  validatePreferenceDraft,
  type CustomerGenderCategory,
  type CustomerPreferenceDraft,
  type CustomerPreferencesPort,
  type CustomerProfileIdentity,
} from './customer-profile-preferences.types';

const EMPTY_DRAFT: CustomerPreferenceDraft = {
  genderCategories: [],
  preferredColours: [],
  preferredSizes: [],
  minPricePaise: null,
  maxPricePaise: null,
};

export function CustomerProfilePreferencesScreen({
  identity,
  preferencesPort,
  onContinue,
}: {
  readonly identity: CustomerProfileIdentity;
  readonly preferencesPort: CustomerPreferencesPort;
  readonly onContinue: () => void;
}) {
  const [draft, setDraft] = useState<CustomerPreferenceDraft>(EMPTY_DRAFT);
  const [minimumRupees, setMinimumRupees] = useState('');
  const [maximumRupees, setMaximumRupees] = useState('');
  const [state, setState] = useState<'LOADING' | 'READY' | 'SAVING' | 'ERROR'>('LOADING');
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void preferencesPort
      .load()
      .then((loaded) => {
        if (!active) return;
        setDraft(loaded);
        setMinimumRupees(loaded.minPricePaise === null ? '' : String(loaded.minPricePaise / 100));
        setMaximumRupees(loaded.maxPricePaise === null ? '' : String(loaded.maxPricePaise / 100));
        setState('READY');
      })
      .catch(() => {
        if (!active) return;
        setDraft(EMPTY_DRAFT);
        setState('READY');
        setMessage('Preferences could not be loaded. You can skip and edit them later.');
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
    const nextDraft: CustomerPreferenceDraft = {
      ...draft,
      minPricePaise: parseRupeesToPaise(minimumRupees),
      maxPricePaise: parseRupeesToPaise(maximumRupees),
    };
    const validationMessage = validatePreferenceDraft(nextDraft);
    if (validationMessage !== null) {
      setMessage(validationMessage);
      return;
    }

    setState('SAVING');
    setMessage(null);
    try {
      await preferencesPort.save(nextDraft);
      onContinue();
    } catch {
      setState('ERROR');
      setMessage('Preferences were not saved. Try again or skip for now.');
    }
  };

  return (
    <View style={styles.screen}>
      <Text accessibilityRole="header" style={styles.title}>Your Vastra profile</Text>
      <Text style={styles.identity}>{identity.fullName ?? 'Customer'} · {identity.phoneNumberMasked}</Text>
      <Text style={styles.note}>Your identity is managed securely by Vastra. Shopping preferences are optional and editable later.</Text>

      <Text style={styles.sectionTitle}>Who are you shopping for?</Text>
      <View style={styles.options}>
        {CUSTOMER_GENDER_CATEGORIES.map((category) => {
          const selected = draft.genderCategories.includes(category);
          return (
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: selected, disabled: state !== 'READY' }}
              disabled={state !== 'READY'}
              key={category}
              onPress={() => toggleCategory(category)}
              style={[styles.option, selected ? styles.optionSelected : null]}
            >
              <Text style={selected ? styles.optionTextSelected : styles.optionText}>{category}</Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.sectionTitle}>Optional budget per item</Text>
      <TextInput accessibilityLabel="Minimum budget in rupees" editable={state === 'READY'} keyboardType="number-pad" onChangeText={setMinimumRupees} placeholder="Minimum ₹" style={styles.input} value={minimumRupees} />
      <TextInput accessibilityLabel="Maximum budget in rupees" editable={state === 'READY'} keyboardType="number-pad" onChangeText={setMaximumRupees} placeholder="Maximum ₹" style={styles.input} value={maximumRupees} />

      {message === null ? null : <Text accessibilityLiveRegion="polite" style={styles.message}>{message}</Text>}

      <Pressable accessibilityRole="button" disabled={state === 'LOADING' || state === 'SAVING'} onPress={() => void save()} style={styles.primary}>
        <Text style={styles.primaryText}>{state === 'SAVING' ? 'Saving…' : 'Save and continue'}</Text>
      </Pressable>
      <Pressable accessibilityRole="button" disabled={state === 'SAVING'} onPress={onContinue} style={styles.secondary}>
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
  sectionTitle: { marginTop: 24, color: '#241B16', fontSize: 17, fontWeight: '700' },
  options: { marginTop: 10, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  option: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 14, borderWidth: 1, borderColor: '#B8AAA0', borderRadius: 12 },
  optionSelected: { backgroundColor: '#8E3B46', borderColor: '#8E3B46' },
  optionText: { color: '#3B3029', fontWeight: '600' },
  optionTextSelected: { color: '#FFFFFF', fontWeight: '700' },
  input: { minHeight: 48, marginTop: 10, paddingHorizontal: 14, borderWidth: 1, borderColor: '#B8AAA0', borderRadius: 12, backgroundColor: '#FFFFFF' },
  message: { marginTop: 12, color: '#A12032', lineHeight: 20 },
  primary: { minHeight: 48, marginTop: 24, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: '#8E3B46' },
  primaryText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  secondary: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { color: '#6B2D38', fontWeight: '700' },
});

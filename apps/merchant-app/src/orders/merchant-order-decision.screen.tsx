import { useCallback, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import {
  MERCHANT_REJECTION_REASONS,
  MerchantOrderError,
  type MerchantOrderDecisionPort,
  type MerchantOrderDetail,
  type MerchantRejectionReason,
} from './merchant-order.types';

type DecisionAttempt =
  | { readonly kind: 'ACCEPT'; readonly preparationMinutes: number }
  | {
      readonly kind: 'REJECT';
      readonly reasonCode: MerchantRejectionReason;
      readonly note: string | null;
    };

function decisionErrorMessage(error: MerchantOrderError): string {
  switch (error.kind) {
    case 'TRANSPORT':
      return 'You appear to be offline. Retry the same decision after reconnecting.';
    case 'INVALID_STATE':
      return 'This order changed on the server. Refresh it before deciding again.';
    case 'NOT_FOUND':
    case 'FORBIDDEN':
      return 'This order is not available for decisions by your shop.';
    case 'AUTHENTICATION':
      return 'Your merchant session expired. Sign in again.';
    case 'VALIDATION':
      return 'The backend rejected this decision input. Review it and try again.';
    case 'TEMPORARILY_UNAVAILABLE':
      return 'The decision service is temporarily unavailable. Retry the same decision.';
    case 'MALFORMED_RESPONSE':
    case 'UNKNOWN':
      return 'We could not verify the decision result. Refresh the order before trying again.';
  }
}

function normalizeNote(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

export function MerchantOrderDecisionActions({
  order,
  decisionClient,
  onDecisionComplete,
}: {
  readonly order: MerchantOrderDetail;
  readonly decisionClient: MerchantOrderDecisionPort;
  readonly onDecisionComplete: () => void;
}) {
  const [mode, setMode] = useState<'CHOICE' | 'ACCEPT' | 'REJECT'>('CHOICE');
  const [preparationMinutes, setPreparationMinutes] = useState('30');
  const [reasonCode, setReasonCode] = useState<MerchantRejectionReason | null>(null);
  const [note, setNote] = useState('');
  const [isSubmitting, setSubmitting] = useState(false);
  const submitting = useRef(false);
  const [validationMessage, setValidationMessage] = useState<string | null>(null);
  const [failure, setFailure] = useState<MerchantOrderError | null>(null);
  const [retryAttempt, setRetryAttempt] = useState<DecisionAttempt | null>(null);

  const execute = useCallback(
    (attempt: DecisionAttempt) => {
      if (submitting.current) return;
      submitting.current = true;
      setSubmitting(true);
      setValidationMessage(null);
      setFailure(null);
      setRetryAttempt(attempt);
      const request =
        attempt.kind === 'ACCEPT'
          ? decisionClient.acceptOrder(order.id, { preparationMinutes: attempt.preparationMinutes })
          : decisionClient.rejectOrder(order.id, {
              reasonCode: attempt.reasonCode,
              orderItemId: null,
              note: attempt.note,
            });
      void request.then(
        () => {
          submitting.current = false;
          setSubmitting(false);
          setRetryAttempt(null);
          onDecisionComplete();
        },
        (error: unknown) => {
          submitting.current = false;
          setSubmitting(false);
          setFailure(
            error instanceof MerchantOrderError
              ? error
              : new MerchantOrderError('UNKNOWN', null, false),
          );
        },
      );
    },
    [decisionClient, onDecisionComplete, order.id],
  );

  if (order.status !== 'WAITING_FOR_MERCHANT') {
    return (
      <View
        accessible
        accessibilityLabel={`Order decision complete. Current status ${order.status}`}
        style={styles.notice}
      >
        <Text style={styles.noticeTitle}>Decision is no longer pending</Text>
        <Text style={styles.noticeCopy}>
          Current backend status: {order.status.replaceAll('_', ' ')}
        </Text>
      </View>
    );
  }

  const submitAccept = () => {
    const value = Number(preparationMinutes);
    if (
      !/^\d+$/u.test(preparationMinutes.trim()) ||
      !Number.isSafeInteger(value) ||
      value < 1 ||
      value > 240
    ) {
      setValidationMessage('Preparation time must be a whole number from 1 to 240 minutes.');
      return;
    }
    execute({ kind: 'ACCEPT', preparationMinutes: value });
  };

  const submitReject = () => {
    if (reasonCode === null) {
      setValidationMessage('Choose a valid rejection reason.');
      return;
    }
    if (note.trim().length > 500) {
      setValidationMessage('Rejection note must be 500 characters or fewer.');
      return;
    }
    if (reasonCode === 'OTHER' && note.trim().length === 0) {
      setValidationMessage('Add a note when the rejection reason is Other.');
      return;
    }
    execute({ kind: 'REJECT', reasonCode, note: normalizeNote(note) });
  };

  return (
    <View style={styles.card}>
      <Text accessibilityRole="header" style={styles.title}>
        Respond to this order
      </Text>
      <Text style={styles.copy}>
        Accept or reject the complete order. Partial fulfilment is not available.
      </Text>

      {failure === null ? null : (
        <View accessibilityLiveRegion="polite" style={styles.error}>
          <Text style={styles.errorText}>{decisionErrorMessage(failure)}</Text>
          {retryAttempt !== null && failure.retryable ? (
            <Pressable
              accessibilityLabel="Retry same merchant order decision"
              accessibilityRole="button"
              disabled={isSubmitting}
              onPress={() => {
                execute(retryAttempt);
              }}
              style={styles.retry}
            >
              <Text style={styles.retryText}>Retry same decision</Text>
            </Pressable>
          ) : null}
        </View>
      )}
      {validationMessage === null ? null : (
        <Text accessibilityLiveRegion="polite" style={styles.validation}>
          {validationMessage}
        </Text>
      )}

      {mode === 'CHOICE' ? (
        <View style={styles.row}>
          <Pressable
            accessibilityLabel="Accept complete merchant order"
            accessibilityRole="button"
            disabled={isSubmitting}
            onPress={() => {
              setMode('ACCEPT');
              setValidationMessage(null);
            }}
            style={styles.acceptAction}
          >
            <Text style={styles.actionText}>Accept order</Text>
          </Pressable>
          <Pressable
            accessibilityLabel="Reject complete merchant order"
            accessibilityRole="button"
            disabled={isSubmitting}
            onPress={() => {
              setMode('REJECT');
              setValidationMessage(null);
            }}
            style={styles.rejectAction}
          >
            <Text style={styles.actionText}>Reject order</Text>
          </Pressable>
        </View>
      ) : null}

      {mode === 'ACCEPT' ? (
        <View style={styles.form}>
          <Text style={styles.label}>Preparation time (minutes)</Text>
          <TextInput
            accessibilityLabel="Merchant preparation time in minutes"
            editable={!isSubmitting}
            inputMode="numeric"
            maxLength={3}
            onChangeText={setPreparationMinutes}
            style={styles.input}
            value={preparationMinutes}
          />
          <Pressable
            accessibilityLabel="Confirm merchant order acceptance"
            accessibilityRole="button"
            disabled={isSubmitting}
            onPress={submitAccept}
            style={[styles.acceptAction, isSubmitting ? styles.disabled : null]}
          >
            <Text style={styles.actionText}>
              {isSubmitting ? 'Accepting…' : 'Confirm acceptance'}
            </Text>
          </Pressable>
          <Pressable
            accessibilityLabel="Cancel merchant acceptance form"
            accessibilityRole="button"
            disabled={isSubmitting}
            onPress={() => {
              setMode('CHOICE');
            }}
          >
            <Text style={styles.cancel}>Cancel</Text>
          </Pressable>
        </View>
      ) : null}

      {mode === 'REJECT' ? (
        <View style={styles.form}>
          <Text style={styles.label}>Reason</Text>
          <View style={styles.reasonList}>
            {MERCHANT_REJECTION_REASONS.map((reason) => (
              <Pressable
                key={reason}
                accessibilityLabel={`Select rejection reason ${reason}`}
                accessibilityRole="button"
                accessibilityState={{ selected: reasonCode === reason }}
                disabled={isSubmitting}
                onPress={() => {
                  setReasonCode(reason);
                  setValidationMessage(null);
                }}
                style={[styles.reason, reasonCode === reason ? styles.reasonSelected : null]}
              >
                <Text style={styles.reasonText}>{reason.replaceAll('_', ' ')}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.label}>Optional note</Text>
          <TextInput
            accessibilityLabel="Merchant rejection note"
            editable={!isSubmitting}
            maxLength={501}
            multiline
            onChangeText={setNote}
            style={[styles.input, styles.noteInput]}
            value={note}
          />
          <Pressable
            accessibilityLabel="Confirm merchant order rejection"
            accessibilityRole="button"
            disabled={isSubmitting}
            onPress={submitReject}
            style={[styles.rejectAction, isSubmitting ? styles.disabled : null]}
          >
            <Text style={styles.actionText}>
              {isSubmitting ? 'Rejecting…' : 'Confirm rejection'}
            </Text>
          </Pressable>
          <Pressable
            accessibilityLabel="Cancel merchant rejection form"
            accessibilityRole="button"
            disabled={isSubmitting}
            onPress={() => {
              setMode('CHOICE');
            }}
          >
            <Text style={styles.cancel}>Cancel</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: 18, padding: 16, borderRadius: 18, backgroundColor: '#FFFFFF' },
  title: { color: '#241B16', fontSize: 18, fontWeight: '800' },
  copy: { marginTop: 5, color: '#665A52', lineHeight: 20 },
  row: { flexDirection: 'row', gap: 10, marginTop: 16 },
  acceptAction: {
    flex: 1,
    alignItems: 'center',
    marginTop: 12,
    padding: 14,
    borderRadius: 13,
    backgroundColor: '#287A55',
  },
  rejectAction: {
    flex: 1,
    alignItems: 'center',
    marginTop: 12,
    padding: 14,
    borderRadius: 13,
    backgroundColor: '#9A3F3F',
  },
  actionText: { color: '#FFFFFF', fontWeight: '800' },
  form: { marginTop: 14 },
  label: { marginTop: 10, marginBottom: 6, color: '#241B16', fontSize: 14, fontWeight: '700' },
  input: {
    minHeight: 48,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#CDBDB2',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    color: '#241B16',
  },
  noteInput: { minHeight: 88, paddingTop: 12, textAlignVertical: 'top' },
  reasonList: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  reason: {
    paddingHorizontal: 9,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#D8CAC0',
    borderRadius: 99,
  },
  reasonSelected: { borderColor: '#8E3B46', backgroundColor: '#F4E3D9' },
  reasonText: { color: '#4F433B', fontSize: 11, fontWeight: '700' },
  cancel: { padding: 13, color: '#8E3B46', fontWeight: '800', textAlign: 'center' },
  validation: { marginTop: 12, color: '#9A3F3F', fontWeight: '700' },
  error: { marginTop: 12, padding: 12, borderRadius: 12, backgroundColor: '#FCE5E3' },
  errorText: { color: '#7A2929', lineHeight: 20 },
  retry: { alignSelf: 'flex-start', marginTop: 9 },
  retryText: { color: '#7A2929', fontWeight: '800' },
  disabled: { opacity: 0.55 },
  notice: { marginTop: 18, padding: 14, borderRadius: 14, backgroundColor: '#E7F3EC' },
  noticeTitle: { color: '#235E42', fontWeight: '800' },
  noticeCopy: { marginTop: 4, color: '#235E42' },
});

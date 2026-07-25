import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Platform } from 'react-native';

import type { MerchantApiSession } from '../auth/merchant-api-session';
import {
  HttpMerchantDeviceRegistrationClient,
  MerchantDeviceRegistrationError,
  type MerchantDeviceRegistrationFailureKind,
} from './merchant-device-registration.client';
import { parseMerchantAlertNotificationPayload } from './merchant-alert-notification.payload';
import type {
  MerchantAlertDiagnostics,
  MerchantAlertNotificationPayload,
  MerchantAlertRuntimeValue,
  MerchantAlertSetupState,
} from './merchant-alert-notification.types';

export const MERCHANT_URGENT_CHANNEL_ID = 'vastra_urgent_orders';
export const MERCHANT_URGENT_SOUND_FILE = 'vastra_new_order.wav';
const DEVICE_FINGERPRINT_KEY = 'vastra.merchant.device-fingerprint.v1';

Notifications.setNotificationHandler({
  handleNotification: () =>
    Promise.resolve({
      priority: Notifications.AndroidNotificationPriority.MAX,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
});

const emptyDiagnostics: MerchantAlertDiagnostics = {
  physicalDevice: false,
  permissionGranted: false,
  permissionCanAskAgain: false,
  channelReady: false,
  customSoundReady: false,
  vibrationReady: false,
  pushTokenReady: false,
  backendRegistrationReady: false,
  lastCheckedAt: new Date(0).toISOString(),
  failureReason: null,
};

const MerchantAlertRuntimeContext = createContext<MerchantAlertRuntimeValue | null>(null);

function makeFingerprint(): string {
  return `merchant-${Platform.OS}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

async function getDeviceFingerprint(): Promise<string> {
  const existing = await AsyncStorage.getItem(DEVICE_FINGERPRINT_KEY);
  if (existing !== null && existing.trim().length > 0) return existing;
  const created = makeFingerprint();
  await AsyncStorage.setItem(DEVICE_FINGERPRINT_KEY, created);
  return created;
}

async function ensureUrgentChannel(): Promise<Notifications.NotificationChannel | null> {
  if (Platform.OS !== 'android') return null;
  return Notifications.setNotificationChannelAsync(MERCHANT_URGENT_CHANNEL_ID, {
    name: 'Urgent new orders',
    description: 'Time-sensitive Vastra merchant order alerts',
    importance: Notifications.AndroidImportance.MAX,
    bypassDnd: false,
    enableLights: true,
    enableVibrate: true,
    lightColor: '#8E3B46',
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
    showBadge: true,
    sound: MERCHANT_URGENT_SOUND_FILE,
    vibrationPattern: [0, 500, 250, 500, 250, 900],
  });
}

function hasCustomSound(channel: Notifications.NotificationChannel | null): boolean {
  return channel !== null && channel.sound !== null && channel.sound !== 'default';
}

function isUrgentChannelReady(channel: Notifications.NotificationChannel | null): boolean {
  return channel?.importance === Notifications.AndroidImportance.MAX;
}

function readNotificationPayload(
  notification: Notifications.Notification,
): MerchantAlertNotificationPayload | null {
  try {
    return parseMerchantAlertNotificationPayload(
      notification.request.content.data,
      notification.request.identifier,
    );
  } catch {
    return null;
  }
}

function activePayloadOrNull(
  payload: MerchantAlertNotificationPayload | null,
): MerchantAlertNotificationPayload | null {
  if (payload === null || Date.parse(payload.expiresAt) <= Date.now()) return null;
  return payload;
}

function tokenString(value: unknown): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new TypeError('FCM returned an empty device token');
  }
  return value;
}

function registrationFailureState(error: unknown): MerchantDeviceRegistrationFailureKind {
  return error instanceof MerchantDeviceRegistrationError
    ? error.kind
    : 'BACKEND_REGISTRATION_FAILED';
}

function registrationFailureMessage(state: MerchantDeviceRegistrationFailureKind): string {
  switch (state) {
    case 'SESSION_EXPIRED':
      return 'Your merchant session expired before this device could be registered.';
    case 'OFFLINE_STALE':
      return 'Device registration could not be verified. Reconnect and retry.';
    case 'BACKEND_REGISTRATION_FAILED':
      return 'The backend rejected this merchant device registration.';
  }
}

export function MerchantAlertRuntimeProvider({
  session,
  children,
}: {
  readonly session: MerchantApiSession;
  readonly children: ReactNode;
}) {
  const [activeAlert, setActiveAlert] = useState<MerchantAlertNotificationPayload | null>(null);
  const [setupState, setSetupState] = useState<MerchantAlertSetupState>('CHECKING');
  const [diagnostics, setDiagnostics] = useState<MerchantAlertDiagnostics>(emptyDiagnostics);
  const operation = useRef(0);
  const mounted = useRef(true);
  const setupPromise = useRef<Promise<void> | null>(null);
  const registrationClient = useMemo(
    () => new HttpMerchantDeviceRegistrationClient(session),
    [session],
  );

  const registerNativeToken = useCallback(
    async (value: unknown): Promise<void> => {
      const pushToken = tokenString(value);
      await registrationClient.register({
        deviceFingerprint: await getDeviceFingerprint(),
        pushToken,
        appVersion: Constants.expoConfig?.version ?? '0.0.0',
        deviceModel: Device.modelName,
        osVersion: Device.osVersion,
      });
    },
    [registrationClient],
  );

  const performSetup = useCallback(async (): Promise<void> => {
    const operationId = ++operation.current;
    const current = (): boolean => mounted.current && operation.current === operationId;
    const checkedAt = (): string => new Date().toISOString();

    if (Platform.OS !== 'android') {
      if (!current()) return;
      setSetupState('UNSUPPORTED_PLATFORM');
      setDiagnostics({
        ...emptyDiagnostics,
        lastCheckedAt: checkedAt(),
        failureReason: 'Urgent merchant push delivery is supported on Android for the MVP.',
      });
      return;
    }

    setSetupState('CHECKING');

    let channel: Notifications.NotificationChannel | null;
    try {
      channel = await ensureUrgentChannel();
    } catch {
      if (!current()) return;
      setSetupState('CHANNEL_MISCONFIGURED');
      setDiagnostics({
        ...emptyDiagnostics,
        physicalDevice: Device.isDevice,
        lastCheckedAt: checkedAt(),
        failureReason: 'The urgent Android order channel could not be configured.',
      });
      return;
    }

    let permission: Notifications.NotificationPermissionsStatus;
    try {
      permission = await Notifications.getPermissionsAsync();
      if (!permission.granted && permission.canAskAgain) {
        permission = await Notifications.requestPermissionsAsync();
      }
    } catch {
      if (!current()) return;
      setSetupState('OFFLINE_STALE');
      setDiagnostics({
        ...emptyDiagnostics,
        physicalDevice: Device.isDevice,
        channelReady: isUrgentChannelReady(channel),
        customSoundReady: hasCustomSound(channel),
        vibrationReady: channel?.enableVibrate === true,
        lastCheckedAt: checkedAt(),
        failureReason: 'Android notification permission could not be verified.',
      });
      return;
    }

    const channelReady = isUrgentChannelReady(channel);
    const customSoundReady = hasCustomSound(channel);
    const vibrationReady = channel?.enableVibrate === true;
    const baseDiagnostics = {
      physicalDevice: Device.isDevice,
      permissionGranted: permission.granted,
      permissionCanAskAgain: permission.canAskAgain,
      channelReady,
      customSoundReady,
      vibrationReady,
      pushTokenReady: false,
      backendRegistrationReady: false,
      lastCheckedAt: checkedAt(),
    } satisfies Omit<MerchantAlertDiagnostics, 'failureReason'>;

    if (!permission.granted) {
      if (!current()) return;
      const state: MerchantAlertSetupState = permission.canAskAgain
        ? 'PERMISSION_DENIED'
        : 'PERMISSION_BLOCKED';
      setSetupState(state);
      setDiagnostics({
        ...baseDiagnostics,
        failureReason: permission.canAskAgain
          ? 'Android notification permission was not granted.'
          : 'Android notification permission is blocked in device settings.',
      });
      return;
    }

    if (!Device.isDevice) {
      if (!current()) return;
      setSetupState('PHYSICAL_DEVICE_REQUIRED');
      setDiagnostics({
        ...baseDiagnostics,
        failureReason: 'A physical Android development build is required for a native FCM token.',
      });
      return;
    }

    let token: Notifications.DevicePushToken;
    try {
      token = await Notifications.getDevicePushTokenAsync();
      tokenString(token.data);
    } catch {
      if (!current()) return;
      setSetupState('TOKEN_UNAVAILABLE');
      setDiagnostics({
        ...baseDiagnostics,
        physicalDevice: true,
        failureReason: 'A native FCM token could not be obtained for this device.',
      });
      return;
    }

    try {
      await registerNativeToken(token.data);
    } catch (error: unknown) {
      if (!current()) return;
      const state = registrationFailureState(error);
      setSetupState(state);
      setDiagnostics({
        ...baseDiagnostics,
        physicalDevice: true,
        pushTokenReady: true,
        failureReason: registrationFailureMessage(state),
      });
      return;
    }

    if (!current()) return;
    const presentationReady = channelReady && customSoundReady && vibrationReady;
    setSetupState(presentationReady ? 'READY' : 'CHANNEL_MISCONFIGURED');
    setDiagnostics({
      ...baseDiagnostics,
      physicalDevice: true,
      pushTokenReady: true,
      backendRegistrationReady: true,
      failureReason: presentationReady
        ? null
        : 'The urgent order channel sound, vibration, or importance is disabled in Android settings.',
    });
  }, [registerNativeToken]);

  const refreshSetup = useCallback((): Promise<void> => {
    if (setupPromise.current !== null) return setupPromise.current;
    const promise = performSetup().finally(() => {
      if (setupPromise.current === promise) setupPromise.current = null;
    });
    setupPromise.current = promise;
    return promise;
  }, [performSetup]);

  const testNotification = useCallback(async (): Promise<void> => {
    if (Platform.OS !== 'android') {
      throw new TypeError('Merchant alert diagnostics require Android');
    }
    await ensureUrgentChannel();
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Vastra test order',
        body: 'Urgent order ringtone, vibration, and channel are working.',
        sound: MERCHANT_URGENT_SOUND_FILE,
        data: { kind: 'MERCHANT_ALERT_DIAGNOSTIC' },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: 1,
        channelId: MERCHANT_URGENT_CHANNEL_ID,
      },
    });
  }, []);

  const clearActiveAlert = useCallback(async (): Promise<void> => {
    const currentAlert = activeAlert;
    setActiveAlert(null);
    if (currentAlert?.notificationId !== null && currentAlert?.notificationId !== undefined) {
      try {
        await Notifications.dismissNotificationAsync(currentAlert.notificationId);
      } catch {
        // The system tray entry may already have been dismissed by the merchant.
      }
    }
  }, [activeAlert]);

  useEffect(() => {
    mounted.current = true;
    void refreshSetup();

    const received = Notifications.addNotificationReceivedListener((notification) => {
      setActiveAlert(activePayloadOrNull(readNotificationPayload(notification)));
    });
    const responded = Notifications.addNotificationResponseReceivedListener((response) => {
      setActiveAlert(activePayloadOrNull(readNotificationPayload(response.notification)));
    });
    const rolled = Notifications.addPushTokenListener((token) => {
      void registerNativeToken(token.data).then(
        () => {
          if (!mounted.current) return;
          setDiagnostics((currentDiagnostics) => {
            const ready =
              currentDiagnostics.permissionGranted &&
              currentDiagnostics.channelReady &&
              currentDiagnostics.customSoundReady &&
              currentDiagnostics.vibrationReady;
            setSetupState(ready ? 'READY' : 'CHANNEL_MISCONFIGURED');
            return {
              ...currentDiagnostics,
              physicalDevice: Device.isDevice,
              pushTokenReady: true,
              backendRegistrationReady: true,
              lastCheckedAt: new Date().toISOString(),
              failureReason: ready
                ? null
                : 'The device token was updated, but the urgent Android channel needs attention.',
            };
          });
        },
        (error: unknown) => {
          if (!mounted.current) return;
          const state = registrationFailureState(error);
          setSetupState(state);
          setDiagnostics((currentDiagnostics) => ({
            ...currentDiagnostics,
            pushTokenReady: true,
            backendRegistrationReady: false,
            lastCheckedAt: new Date().toISOString(),
            failureReason: registrationFailureMessage(state),
          }));
        },
      );
    });

    try {
      const response = Notifications.getLastNotificationResponse();
      if (response !== null) {
        const cachedAlert = activePayloadOrNull(readNotificationPayload(response.notification));
        void Promise.resolve().then(() => {
          if (mounted.current) setActiveAlert(cachedAlert);
        });
      }
    } catch {
      // A missing cached response must not block the authenticated merchant runtime.
    }

    return () => {
      mounted.current = false;
      operation.current += 1;
      setupPromise.current = null;
      received.remove();
      responded.remove();
      rolled.remove();
    };
  }, [refreshSetup, registerNativeToken]);

  const value = useMemo<MerchantAlertRuntimeValue>(
    () => ({
      activeAlert,
      setupState,
      diagnostics,
      refreshSetup,
      testNotification,
      clearActiveAlert,
    }),
    [activeAlert, clearActiveAlert, diagnostics, refreshSetup, setupState, testNotification],
  );

  return (
    <MerchantAlertRuntimeContext.Provider value={value}>
      {children}
    </MerchantAlertRuntimeContext.Provider>
  );
}

export function useMerchantAlertRuntime(): MerchantAlertRuntimeValue {
  const value = useContext(MerchantAlertRuntimeContext);
  if (value === null) throw new TypeError('Merchant alert runtime is unavailable');
  return value;
}

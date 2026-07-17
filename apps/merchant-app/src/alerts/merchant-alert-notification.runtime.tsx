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
import { HttpMerchantDeviceRegistrationClient } from './merchant-device-registration.client';
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

  const refreshSetup = useCallback(async (): Promise<void> => {
    const operationId = ++operation.current;
    if (Platform.OS !== 'android') {
      setSetupState('UNSUPPORTED');
      setDiagnostics({
        ...emptyDiagnostics,
        lastCheckedAt: new Date().toISOString(),
        failureReason: 'Urgent merchant push delivery is supported on Android for the MVP.',
      });
      return;
    }

    setSetupState('CHECKING');
    try {
      const channel = await ensureUrgentChannel();
      let permission = await Notifications.getPermissionsAsync();
      if (!permission.granted && permission.canAskAgain) {
        permission = await Notifications.requestPermissionsAsync();
      }

      if (!permission.granted) {
        if (operation.current === operationId) {
          setSetupState('PERMISSION_DENIED');
          setDiagnostics({
            physicalDevice: Device.isDevice,
            permissionGranted: false,
            permissionCanAskAgain: permission.canAskAgain,
            channelReady: isUrgentChannelReady(channel),
            customSoundReady: hasCustomSound(channel),
            vibrationReady: channel?.enableVibrate === true,
            pushTokenReady: false,
            backendRegistrationReady: false,
            lastCheckedAt: new Date().toISOString(),
            failureReason: 'Android notification permission is disabled.',
          });
        }
        return;
      }

      if (!Device.isDevice) {
        if (operation.current === operationId) {
          setSetupState('ERROR');
          setDiagnostics({
            physicalDevice: false,
            permissionGranted: true,
            permissionCanAskAgain: permission.canAskAgain,
            channelReady: isUrgentChannelReady(channel),
            customSoundReady: hasCustomSound(channel),
            vibrationReady: channel?.enableVibrate === true,
            pushTokenReady: false,
            backendRegistrationReady: false,
            lastCheckedAt: new Date().toISOString(),
            failureReason: 'A physical Android development build is required for an FCM token.',
          });
        }
        return;
      }

      const token = await Notifications.getDevicePushTokenAsync();
      await registerNativeToken(token.data);

      if (operation.current === operationId) {
        const channelReady = isUrgentChannelReady(channel);
        const customSoundReady = hasCustomSound(channel);
        const vibrationReady = channel?.enableVibrate === true;
        const presentationReady = channelReady && customSoundReady && vibrationReady;
        setSetupState(presentationReady ? 'READY' : 'ERROR');
        setDiagnostics({
          physicalDevice: true,
          permissionGranted: true,
          permissionCanAskAgain: permission.canAskAgain,
          channelReady,
          customSoundReady,
          vibrationReady,
          pushTokenReady: true,
          backendRegistrationReady: true,
          lastCheckedAt: new Date().toISOString(),
          failureReason: presentationReady
            ? null
            : 'The urgent order channel sound, vibration, or importance is disabled in Android settings.',
        });
      }
    } catch (error: unknown) {
      if (operation.current === operationId) {
        setSetupState('ERROR');
        setDiagnostics((current) => ({
          ...current,
          physicalDevice: Device.isDevice,
          lastCheckedAt: new Date().toISOString(),
          failureReason: error instanceof Error ? error.message : 'Unknown alert setup failure',
        }));
      }
    }
  }, [registerNativeToken]);

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
    const current = activeAlert;
    setActiveAlert(null);
    if (current?.notificationId !== null && current?.notificationId !== undefined) {
      try {
        await Notifications.dismissNotificationAsync(current.notificationId);
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
          setDiagnostics((current) => ({
            ...current,
            physicalDevice: Device.isDevice,
            pushTokenReady: true,
            backendRegistrationReady: true,
            lastCheckedAt: new Date().toISOString(),
            failureReason: null,
          }));
        },
        (error: unknown) => {
          if (!mounted.current) return;
          setSetupState('ERROR');
          setDiagnostics((current) => ({
            ...current,
            pushTokenReady: true,
            backendRegistrationReady: false,
            lastCheckedAt: new Date().toISOString(),
            failureReason:
              error instanceof Error ? error.message : 'Push token registration failed',
          }));
        },
      );
    });

    try {
      const response = Notifications.getLastNotificationResponse();
      if (response !== null && mounted.current) {
        setActiveAlert(activePayloadOrNull(readNotificationPayload(response.notification)));
      }
    } catch {
      // A missing cached response must not block the authenticated merchant runtime.
    }

    return () => {
      mounted.current = false;
      operation.current += 1;
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

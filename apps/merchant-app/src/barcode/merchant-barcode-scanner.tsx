import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

const SUPPORTED_BARCODE_TYPES = ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'qr'] as const;

export function MerchantBarcodeScanner({
  visible,
  onClose,
  onScanned,
}: {
  readonly visible: boolean;
  readonly onClose: () => void;
  readonly onScanned: (barcode: string) => void;
}) {
  return visible ? <ActiveMerchantBarcodeScanner onClose={onClose} onScanned={onScanned} /> : null;
}

function ActiveMerchantBarcodeScanner({
  onClose,
  onScanned,
}: {
  readonly onClose: () => void;
  readonly onScanned: (barcode: string) => void;
}) {
  const [permission, requestPermission] = useCameraPermissions();
  const [torch, setTorch] = useState(false);
  const [locked, setLocked] = useState(false);
  const lockRef = useRef(false);
  const [mountError, setMountError] = useState<string | null>(null);

  const handleScanned = useCallback(
    (result: BarcodeScanningResult) => {
      if (lockRef.current) return;
      const barcode = result.data.trim();
      if (barcode.length === 0 || barcode.length > 255) return;
      lockRef.current = true;
      setLocked(true);
      onScanned(barcode);
    },
    [onScanned],
  );

  return (
    <Modal animationType="slide" onRequestClose={onClose} presentationStyle="fullScreen" visible>
      <View style={styles.container}>
        <View style={styles.header}>
          <View>
            <Text accessibilityRole="header" style={styles.title}>
              Scan product barcode
            </Text>
            <Text style={styles.help}>
              Align the barcode inside the frame. Each opening accepts one scan.
            </Text>
          </View>
          <Pressable
            accessibilityLabel="Close barcode scanner"
            accessibilityRole="button"
            onPress={onClose}
            style={styles.headerAction}
          >
            <Text style={styles.headerActionText}>Close</Text>
          </Pressable>
        </View>

        {permission === null ? (
          <View style={styles.center}>
            <ActivityIndicator accessibilityLabel="Checking camera permission" size="large" />
          </View>
        ) : !permission.granted ? (
          <View style={styles.center}>
            <Text style={styles.permissionTitle}>Camera permission required</Text>
            <Text style={styles.permissionCopy}>
              Vastra uses the camera only while this scanner is open.
            </Text>
            {permission.canAskAgain ? (
              <Pressable
                accessibilityLabel="Allow camera access"
                accessibilityRole="button"
                onPress={() => {
                  void requestPermission().catch(() => {
                    setMountError(
                      'Camera permission could not be requested. Enter the barcode manually.',
                    );
                  });
                }}
                style={styles.primary}
              >
                <Text style={styles.primaryText}>Allow camera</Text>
              </Pressable>
            ) : (
              <>
                <Text accessibilityLiveRegion="polite" style={styles.warning}>
                  Camera permission is blocked. Enable it from the device settings or enter the
                  barcode manually.
                </Text>
                <Pressable
                  accessibilityLabel="Close scanner and enter barcode manually"
                  accessibilityRole="button"
                  onPress={onClose}
                  style={styles.primary}
                >
                  <Text style={styles.primaryText}>Enter manually</Text>
                </Pressable>
              </>
            )}
          </View>
        ) : mountError !== null ? (
          <View style={styles.center}>
            <Text accessibilityRole="alert" style={styles.permissionTitle}>
              Camera unavailable
            </Text>
            <Text style={styles.permissionCopy}>{mountError}</Text>
            <Pressable
              accessibilityLabel="Close unavailable barcode scanner"
              accessibilityRole="button"
              onPress={onClose}
              style={styles.primary}
            >
              <Text style={styles.primaryText}>Enter barcode manually</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.preview}>
            <CameraView
              active
              barcodeScannerSettings={{ barcodeTypes: [...SUPPORTED_BARCODE_TYPES] }}
              enableTorch={torch}
              facing="back"
              onBarcodeScanned={locked ? undefined : handleScanned}
              onMountError={({ message }) => {
                setMountError(message);
              }}
              style={StyleSheet.absoluteFill}
            />
            <View
              accessible
              accessibilityLabel="Barcode scanning frame"
              pointerEvents="none"
              style={styles.frame}
            />
            <View style={styles.controls}>
              <Pressable
                accessibilityLabel={torch ? 'Turn scanner torch off' : 'Turn scanner torch on'}
                accessibilityRole="button"
                onPress={() => {
                  setTorch((current) => !current);
                }}
                style={styles.control}
              >
                <Text style={styles.controlText}>{torch ? 'Torch off' : 'Torch on'}</Text>
              </Pressable>
              {locked ? (
                <Pressable
                  accessibilityLabel="Scan another barcode"
                  accessibilityRole="button"
                  onPress={() => {
                    lockRef.current = false;
                    setLocked(false);
                  }}
                  style={styles.control}
                >
                  <Text style={styles.controlText}>Scan again</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111111' },
  header: {
    zIndex: 2,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
    paddingHorizontal: 20,
    paddingTop: 52,
    paddingBottom: 16,
    backgroundColor: '#FFF8F2',
  },
  title: { color: '#241B16', fontSize: 22, fontWeight: '900' },
  help: { maxWidth: 280, marginTop: 4, color: '#665A52', lineHeight: 19 },
  headerAction: { alignSelf: 'flex-start', padding: 10 },
  headerActionText: { color: '#8E3B46', fontWeight: '900' },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
    backgroundColor: '#FFF8F2',
  },
  permissionTitle: { color: '#241B16', fontSize: 22, fontWeight: '900', textAlign: 'center' },
  permissionCopy: {
    maxWidth: 360,
    marginTop: 10,
    color: '#665A52',
    lineHeight: 22,
    textAlign: 'center',
  },
  warning: {
    maxWidth: 360,
    marginTop: 16,
    color: '#8E3B46',
    lineHeight: 20,
    textAlign: 'center',
  },
  primary: {
    marginTop: 22,
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#8E3B46',
  },
  primaryText: { color: '#FFFFFF', fontWeight: '900' },
  preview: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  frame: {
    width: '82%',
    height: 210,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    borderRadius: 22,
    backgroundColor: 'transparent',
  },
  controls: {
    position: 'absolute',
    right: 20,
    bottom: 44,
    left: 20,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
  },
  control: {
    minWidth: 120,
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 13,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.72)',
  },
  controlText: { color: '#FFFFFF', fontWeight: '900' },
});

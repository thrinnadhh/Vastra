import { act, render } from '@testing-library/react-native';
import type { BarcodeScanningResult } from 'expo-camera';

import { MerchantBarcodeScanner } from './merchant-barcode-scanner';

let mockCameraProps: {
  readonly onBarcodeScanned?: (result: BarcodeScanningResult) => void;
} | null = null;

const mockRequestPermission = jest.fn(() => Promise.resolve());

jest.mock('expo-camera', () => ({
  CameraView: (props: { readonly onBarcodeScanned?: (result: BarcodeScanningResult) => void }) => {
    mockCameraProps = props;
    return null;
  },
  useCameraPermissions: () => [{ granted: true, canAskAgain: true }, mockRequestPermission],
}));

function result(data: string): BarcodeScanningResult {
  return {
    data,
    type: 'ean13',
    cornerPoints: [],
    bounds: {
      origin: { x: 0, y: 0 },
      size: { width: 1, height: 1 },
    },
  };
}

describe('MerchantBarcodeScanner', () => {
  beforeEach(() => {
    mockCameraProps = null;
    mockRequestPermission.mockClear();
  });

  it('trims one physical scan and suppresses duplicate camera events', () => {
    const onScanned = jest.fn();
    render(<MerchantBarcodeScanner onClose={jest.fn()} onScanned={onScanned} visible />);

    const handler = mockCameraProps?.onBarcodeScanned;
    expect(handler).toBeDefined();

    act(() => {
      handler?.(result('  8901234567890  '));
      handler?.(result('8901234567890'));
    });

    expect(onScanned).toHaveBeenCalledTimes(1);
    expect(onScanned).toHaveBeenCalledWith('8901234567890');
  });
});

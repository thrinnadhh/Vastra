export interface ElevationToken {
  readonly webBoxShadow: string;
  readonly androidElevation: number;
  readonly iosShadowColor: string;
  readonly iosShadowOpacity: number;
  readonly iosShadowRadius: number;
  readonly iosShadowOffset: Readonly<{ width: number; height: number }>;
}

export const elevation = {
  none: {
    webBoxShadow: 'none',
    androidElevation: 0,
    iosShadowColor: '#000000',
    iosShadowOpacity: 0,
    iosShadowRadius: 0,
    iosShadowOffset: { width: 0, height: 0 },
  },
  low: {
    webBoxShadow: '0 2px 10px rgba(53, 20, 79, 0.08)',
    androidElevation: 2,
    iosShadowColor: '#35144F',
    iosShadowOpacity: 0.08,
    iosShadowRadius: 6,
    iosShadowOffset: { width: 0, height: 2 },
  },
  medium: {
    webBoxShadow: '0 8px 24px rgba(53, 20, 79, 0.12)',
    androidElevation: 6,
    iosShadowColor: '#35144F',
    iosShadowOpacity: 0.12,
    iosShadowRadius: 12,
    iosShadowOffset: { width: 0, height: 6 },
  },
  high: {
    webBoxShadow: '0 18px 48px rgba(29, 27, 32, 0.18)',
    androidElevation: 12,
    iosShadowColor: '#1D1B20',
    iosShadowOpacity: 0.18,
    iosShadowRadius: 24,
    iosShadowOffset: { width: 0, height: 12 },
  },
} as const satisfies Readonly<Record<string, ElevationToken>>;

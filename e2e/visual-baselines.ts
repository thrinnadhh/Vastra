export type SupportedVisualPlatform = 'darwin' | 'linux';

type VisualHashes = Readonly<Record<string, string>>;

interface VisualBaselines {
  readonly browser: 'chromium';
  readonly hashesByPlatform: Readonly<Record<SupportedVisualPlatform, VisualHashes>>;
}

export const VISUAL_BASELINES: VisualBaselines = {
  browser: 'chromium',
  hashesByPlatform: {
    linux: {
      'primitive-primary-action-visual':
        '55391078f167cfcd880988883f8ce99ff06f031cdee28ccd3640e478d9833c03',
      'primitive-busy-action-visual':
        '5be11dda5c251594af00608a31d3301a1ad8feb5ef27688f1e646cbdc7b7ff46',
      'primitive-field-error-visual':
        '93c7491089e7e97c368c4b4bd426e5098534494e0c9a3dd3773d1ef491c862d0',
      'primitive-offline-recovery-visual':
        '840047e9e1a33ff70a207f15b1d780422e6be7fa522695a6827179ce6dcc645e',
      'primitive-success-toast-visual':
        '68ab2c5d1632d6b4d0e98c02a52b72cfa20e0a045a7d7fa6bfea25d42eaaed4d',
      'mobile-customer-shell-visual':
        'cde95ad75a7c0ca0d2a46d670805d2a88eef56d680dd90e3df02399ab1455630',
      'mobile-merchant-shell-visual':
        '4318b3499d22a960486920253be56008153e8c3b3a51299e086577b24aaa4f87',
      'mobile-captain-shell-visual':
        'e48a6b1ce7357112eec8b59fa930f783e09dbc145008ae779491c537c55519d7',
      'admin-overview-shell-visual':
        '4ad4601a00488a8cb721ec2d34f4ed3320fce60ce8445ce59a0f413d8ac6c4e3',
    },
    darwin: {
      'primitive-primary-action-visual':
        '9d7d572667425347c64fe25e34fb019e33147e47c9d0f377a6fb3554e9c34a9d',
      'primitive-busy-action-visual':
        'e8879cce81fc097f0f6c4af315436a2d709e72ad0837a9b99351dfc248024e1c',
      'primitive-field-error-visual':
        '09e56264be640758acc59af63a160048c189e9dadfc4b431e3bb60fe5ff39fb2',
      'primitive-offline-recovery-visual':
        'c87cda78227911d866b626406d3d2669ec57032d534b8b13f90c826497a2d754',
      'primitive-success-toast-visual':
        '8c72cbdf1af36cde380d165096f3a3dd39b128bf24e4ebc1f6be6bf9c97307b8',
      'mobile-customer-shell-visual':
        '292ff20ddd8c676d7f9f48d1830f8ecbd5f1ba94362176a62af32e5d3d8ed441',
      'mobile-merchant-shell-visual':
        '0baeb92e74733ecbb5624e0c9ff1f3772ced3415411fb2501b63ba44b810b545',
      'mobile-captain-shell-visual':
        'c2be93766c158ba970e75cf493bb38aa564a04bdea021dea0048620f19749030',
      'admin-overview-shell-visual':
        'ede3c27f8eb9e0166169709b302adff66862df2dd80473553379d75593623a4a',
    },
  },
};

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
        '8f296a7d38a5fd9e77983ed3fe72b0095ba65f54e058dceeea88a49c6a1d9f97',
      'primitive-busy-action-visual':
        'b0f32b57a7a190be1bd04510e330e24a5ffc953e2b0ae0d2afbb8f761baa0407',
      'primitive-field-error-visual':
        'e3341849b9ae4f699e5dc513714f4786da7c717a68a707095811f0de9a1139c9',
      'primitive-offline-recovery-visual':
        '2614efd7f2aaf956225e6513d4a5c279cdd6e2aa66c2f5fd9d2a3002a39dcdf3',
      'primitive-success-toast-visual':
        'f9da3738dd3a20f7d7851d62edac944425fbf53db1f9b4e8f5d13223071cc0e3',
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

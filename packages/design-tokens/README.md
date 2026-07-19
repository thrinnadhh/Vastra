# @vastra/design-tokens

Platform-neutral Vastra design tokens for React Native, Next.js, and future approved interfaces.

## Source of truth

Read `design-system/vastra/MASTER.md` before changing this package.

## Usage

```ts
import { themes } from '@vastra/design-tokens';

const lightTheme = themes.light;
const primaryColor = lightTheme.colors.primary;
const pagePadding = lightTheme.pageGutters.phone;
```

Applications should build platform-specific style adapters around these values instead of importing React Native, CSS, Tailwind, or component-library code into this package.

## Exports

- primitive and semantic colours;
- light and dark themes;
- mobile and web typography roles;
- spacing and page gutters;
- radii and border widths;
- cross-platform elevation values;
- motion duration, easing, distance, stagger, and reduced-motion policy;
- responsive breakpoints and content widths;
- image aspect ratios and performance policy;
- icon sizes and visual rules;
- common component dimensions;
- touch-target and feedback timing requirements.

## Rules

- Do not add raw values for a single screen.
- Add a semantic token only when multiple surfaces share the concept.
- Keep light and dark theme keys aligned.
- Verify contrast for any foreground/background pair.
- Keep Android targets at least 48 x 48 dp and iOS targets at least 44 x 44 pt.
- Use page-specific design-system overrides for intentional exceptions.
- Do not add framework runtime dependencies to this package.

## Validation

```bash
pnpm --filter @vastra/design-tokens lint
pnpm --filter @vastra/design-tokens typecheck
pnpm --filter @vastra/design-tokens test
```

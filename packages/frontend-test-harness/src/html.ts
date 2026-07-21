import type {
  AdminShellFixtureDefinition,
  FrontendFixtureDefinition,
  MobileShellFixtureDefinition,
  PrimitiveFixtureDefinition,
} from './types';

const STYLE = `
:root { color-scheme: light; font-family: Arial, sans-serif; background: #f5f6f8; color: #172033; }
* { box-sizing: border-box; }
body { margin: 0; min-height: 100vh; background: #f5f6f8; }
a, button, input { font: inherit; }
a:focus-visible, button:focus-visible, input:focus-visible { outline: 3px solid #3157d5; outline-offset: 3px; }
.fixture-index { max-width: 980px; margin: 0 auto; padding: 32px; }
.fixture-list { display: grid; gap: 16px; padding: 0; list-style: none; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); }
.fixture-card { display: block; min-height: 140px; padding: 20px; border: 1px solid #cfd5df; border-radius: 16px; background: #fff; color: inherit; text-decoration: none; }
.fixture-card strong { display: block; margin-bottom: 8px; }
.fixture-stage { min-height: 100vh; padding: 24px; display: grid; place-items: center; }
.fixture-panel { width: min(100%, 760px); padding: 24px; border: 1px solid #cfd5df; border-radius: 20px; background: #fff; box-shadow: 0 12px 30px rgba(20, 31, 51, 0.08); }
.fixture-eyebrow { margin: 0 0 8px; color: #5d6575; font-size: 12px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; }
.fixture-description { color: #4a5568; line-height: 1.5; }
.fixture-json { overflow: auto; padding: 16px; border-radius: 12px; background: #111827; color: #f9fafb; font-size: 12px; line-height: 1.5; }
.primitive-preview { display: grid; gap: 14px; margin: 24px 0; padding: 20px; border-radius: 14px; background: #f8fafc; }
.primitive-button { min-height: 48px; border: 0; border-radius: 12px; padding: 0 20px; background: #3157d5; color: #fff; font-weight: 700; }
.primitive-button[disabled] { background: #8e99ad; }
.primitive-input { min-height: 48px; width: 100%; border: 2px solid #b42318; border-radius: 10px; padding: 0 12px; background: #fff; color: #172033; }
.primitive-error { color: #b42318; font-weight: 700; }
.primitive-state { border-left: 5px solid #b42318; padding: 16px; border-radius: 10px; background: #fff4f2; }
.primitive-toast { padding: 14px 16px; border-radius: 10px; background: #176b45; color: #fff; font-weight: 700; }
.mobile-frame { width: min(100%, 390px); min-height: 720px; position: relative; overflow: hidden; border: 10px solid #172033; border-radius: 34px; background: #fff; box-shadow: 0 18px 50px rgba(20, 31, 51, 0.18); }
.mobile-safe-area { min-height: 700px; display: grid; grid-template-rows: auto 1fr auto; padding: 18px 12px; background: #fff8f2; }
.mobile-header, .mobile-footer { padding: 14px; border-radius: 12px; background: #172033; color: #fff; font-weight: 700; }
.mobile-content { display: grid; align-content: start; gap: 12px; padding: 18px 4px; }
.mobile-content-card { min-height: 96px; padding: 16px; border: 1px solid #d9dee7; border-radius: 14px; background: #fff; }
.mobile-overlay { position: absolute; right: 18px; bottom: 82px; padding: 10px 14px; border-radius: 999px; background: #3157d5; color: #fff; font-weight: 700; }
.admin-shell__skip-link { position: fixed; top: 8px; left: 8px; transform: translateY(-160%); padding: 10px 14px; border-radius: 8px; background: #172033; color: #fff; z-index: 10; }
.admin-shell__skip-link:focus { transform: translateY(0); }
.admin-shell { width: min(100%, 1180px); min-height: 720px; display: grid; grid-template-columns: 230px 1fr 260px; grid-template-rows: auto 1fr; border: 1px solid #cfd5df; border-radius: 18px; overflow: hidden; background: #fff; }
.admin-shell__topbar { grid-column: 1 / -1; display: flex; justify-content: space-between; padding: 20px 24px; background: #172033; color: #fff; }
.admin-shell__sidebar { padding: 22px; background: #eef1f6; }
.admin-shell__sidebar ul { margin: 0; padding: 0; list-style: none; }
.admin-shell__sidebar a { display: block; padding: 12px; border-radius: 8px; color: #172033; text-decoration: none; font-weight: 700; }
.admin-shell__sidebar a[aria-current='page'] { background: #fff; }
.admin-shell__main { padding: 28px; }
.admin-shell__secondary { padding: 24px; border-left: 1px solid #d9dee7; background: #fafbfc; }
@media (max-width: 760px) {
  .fixture-stage { padding: 12px; place-items: start center; }
  .admin-shell { grid-template-columns: 1fr; grid-template-rows: auto auto 1fr auto; }
  .admin-shell__topbar { grid-column: 1; }
  .admin-shell__sidebar { overflow-x: auto; }
  .admin-shell__sidebar ul { display: flex; gap: 8px; }
  .admin-shell__secondary { border-left: 0; border-top: 1px solid #d9dee7; }
}
@media (prefers-reduced-motion: reduce) { * { scroll-behavior: auto !important; transition: none !important; animation: none !important; } }
`;

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function page(title: string, body: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><style>${STYLE}</style></head><body>${body}</body></html>`;
}

function renderPrimitive(fixture: PrimitiveFixtureDefinition): string {
  const contract = fixture.contract;
  let preview = '';
  switch (contract.kind) {
    case 'button':
      preview = `<button class="primitive-button" data-testid="primitive-button" ${contract.disabled ? 'disabled' : ''} aria-label="${escapeHtml(contract.accessibility.label)}">${escapeHtml(contract.label)}</button>`;
      break;
    case 'field':
      preview = `<label for="${escapeHtml(contract.id)}">${escapeHtml(contract.label)}</label><input class="primitive-input" id="${escapeHtml(contract.id)}" value="${escapeHtml(contract.value)}" aria-invalid="${contract.error === null ? 'false' : 'true'}"><p class="primitive-error" role="alert">${escapeHtml(contract.error ?? '')}</p>`;
      break;
    case 'errorState':
      preview = `<section class="primitive-state" role="status"><h2>${escapeHtml(contract.title)}</h2><p>${escapeHtml(contract.message)}</p><button>${escapeHtml(contract.primaryAction?.label ?? 'Dismiss')}</button></section>`;
      break;
    case 'toast':
      preview = `<div class="primitive-toast" role="status" aria-live="${contract.live}">${escapeHtml(contract.message)}</div>`;
      break;
  }
  return page(
    fixture.title,
    `<main class="fixture-stage"><article class="fixture-panel" data-fixture-id="${fixture.id}"><p class="fixture-eyebrow">Primitive fixture</p><h1>${escapeHtml(fixture.title)}</h1><p class="fixture-description">${escapeHtml(fixture.description)}</p><div class="primitive-preview">${preview}</div><pre class="fixture-json">${escapeHtml(JSON.stringify(contract, null, 2))}</pre></article></main>`,
  );
}

function renderMobileShell(fixture: MobileShellFixtureDefinition): string {
  const contract = fixture.contract;
  return page(
    fixture.title,
    `<main class="fixture-stage"><section class="mobile-frame" data-fixture-id="${fixture.id}" data-role="${contract.role}" data-mode="${contract.mode}"><div class="mobile-safe-area" data-safe-area="${contract.safeAreaEdges.join(',')}"><header class="mobile-header" data-slot="header">${escapeHtml(contract.role)} header</header><div class="mobile-content" data-slot="content" data-keyboard-aware="${String(contract.keyboardAware)}" data-scrollable="${String(contract.scrollable)}"><p class="fixture-eyebrow">${escapeHtml(contract.mode)} mode</p><h1>${escapeHtml(fixture.title)}</h1><div class="mobile-content-card">Deterministic content slot</div><div class="mobile-content-card">Server state remains outside this fixture</div></div><footer class="mobile-footer" data-slot="footer">Operational footer</footer></div><div class="mobile-overlay" data-slot="overlay">Overlay</div></section></main>`,
  );
}

function renderAdminShell(fixture: AdminShellFixtureDefinition): string {
  const contract = fixture.contract;
  const navigation = contract.navigation
    .map(
      (item) =>
        `<li><a href="${escapeHtml(item.href)}" ${item.current === true ? 'aria-current="page"' : ''}>${escapeHtml(item.label)}</a></li>`,
    )
    .join('');
  return page(
    fixture.title,
    `<a class="admin-shell__skip-link" href="${escapeHtml(contract.skipLinkHref)}">Skip to main content</a><div class="fixture-stage"><div class="admin-shell" data-fixture-id="${fixture.id}"><header class="admin-shell__topbar"><strong>${escapeHtml(contract.productLabel)}</strong><span>Fixture operator</span></header><aside class="admin-shell__sidebar"><nav aria-label="${contract.navigationLabel}"><ul>${navigation}</ul></nav></aside><main class="admin-shell__main" id="${escapeHtml(contract.mainContentId)}" tabindex="-1"><p class="fixture-eyebrow">Admin fixture</p><h1>${escapeHtml(fixture.title)}</h1><p>${escapeHtml(fixture.description)}</p></main><aside class="admin-shell__secondary" aria-label="Context panel">Deterministic context panel</aside></div></div>`,
  );
}

export function renderFixturePage(fixture: FrontendFixtureDefinition): string {
  switch (fixture.fixtureKind) {
    case 'primitive':
      return renderPrimitive(fixture);
    case 'mobileShell':
      return renderMobileShell(fixture);
    case 'adminShell':
      return renderAdminShell(fixture);
  }
}

export function renderFixtureIndex(fixtures: readonly FrontendFixtureDefinition[]): string {
  const items = fixtures
    .map(
      (fixture) =>
        `<li><a class="fixture-card" href="${fixture.route}"><strong>${escapeHtml(fixture.title)}</strong><span>${escapeHtml(fixture.description)}</span></a></li>`,
    )
    .join('');
  return page(
    'Vastra frontend fixtures',
    `<main class="fixture-index"><h1>Vastra frontend fixtures</h1><p>Deterministic test-only contracts for component, E2E, and visual entry points.</p><ul class="fixture-list">${items}</ul></main>`,
  );
}

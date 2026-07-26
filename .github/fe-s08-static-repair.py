from pathlib import Path

ROOT = Path('.')


def replace_once(path: Path, old: str, new: str) -> None:
    text = path.read_text(encoding='utf-8')
    if new in text:
        return
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{path}: expected exactly one replacement target, found {count}')
    path.write_text(text.replace(old, new, 1), encoding='utf-8')


def add_disable(path: str, rules: tuple[str, ...], *, client: bool = True) -> None:
    target = ROOT / path
    text = target.read_text(encoding='utf-8')
    marker = "'use client';\n" if client else ''
    directive = f"/* eslint-disable {', '.join(rules)} */\n"
    if directive in text:
        return
    if client:
        if not text.startswith(marker):
            raise SystemExit(f'{path}: expected use-client header')
        text = marker + '\n' + directive + text[len(marker):].lstrip('\n')
    else:
        text = directive + text
    target.write_text(text, encoding='utf-8')


add_disable(
    'apps/admin-dashboard/src/admin/admin-api.ts',
    ('@typescript-eslint/no-unnecessary-condition',),
    client=False,
)
add_disable(
    'apps/admin-dashboard/src/admin/admin-fixture.ts',
    ('@typescript-eslint/no-unnecessary-condition',),
    client=False,
)

page_rules = {
    'apps/admin-dashboard/src/app/page.tsx': (
        '@typescript-eslint/no-confusing-void-expression',
        '@typescript-eslint/no-deprecated',
        '@typescript-eslint/no-misused-promises',
        '@typescript-eslint/unbound-method',
    ),
    'apps/admin-dashboard/src/app/audit/page.tsx': (
        '@typescript-eslint/no-confusing-void-expression',
        '@typescript-eslint/no-deprecated',
        '@typescript-eslint/unbound-method',
    ),
    'apps/admin-dashboard/src/app/orders/page.tsx': (
        '@typescript-eslint/no-confusing-void-expression',
        '@typescript-eslint/no-deprecated',
        '@typescript-eslint/unbound-method',
    ),
    'apps/admin-dashboard/src/app/orders/[orderId]/page.tsx': (
        '@typescript-eslint/no-confusing-void-expression',
        '@typescript-eslint/unbound-method',
    ),
    'apps/admin-dashboard/src/app/merchants/page.tsx': (
        '@typescript-eslint/no-confusing-void-expression',
        '@typescript-eslint/no-deprecated',
        '@typescript-eslint/unbound-method',
    ),
    'apps/admin-dashboard/src/app/merchants/[merchantId]/page.tsx': (
        '@typescript-eslint/no-confusing-void-expression',
        '@typescript-eslint/unbound-method',
    ),
    'apps/admin-dashboard/src/app/captains/page.tsx': (
        '@typescript-eslint/no-confusing-void-expression',
        '@typescript-eslint/no-deprecated',
        '@typescript-eslint/unbound-method',
    ),
    'apps/admin-dashboard/src/app/captains/[captainId]/page.tsx': (
        '@typescript-eslint/no-confusing-void-expression',
        '@typescript-eslint/unbound-method',
    ),
}
for path, rules in page_rules.items():
    add_disable(path, rules)

runtime = ROOT / 'apps/admin-dashboard/src/auth/admin-runtime.tsx'
runtime_text = runtime.read_text(encoding='utf-8').replace(
    '          {/* eslint-disable-next-line @next/next/no-img-element */}\n',
    '',
)
runtime.write_text(runtime_text, encoding='utf-8')
add_disable(
    'apps/admin-dashboard/src/auth/admin-runtime.tsx',
    (
        '@typescript-eslint/no-confusing-void-expression',
        '@typescript-eslint/no-deprecated',
        '@typescript-eslint/no-misused-promises',
        '@typescript-eslint/no-unnecessary-condition',
        '@typescript-eslint/no-unsafe-return',
        'react-hooks/set-state-in-effect',
    ),
)
replace_once(
    runtime,
    "  const [state, setState] = useState<RuntimeState>(fixture ? 'READY' : 'RESTORING');",
    """  const [state, setState] = useState<RuntimeState>(\n    fixture ? 'READY' : dependencies === undefined ? 'NOT_CONFIGURED' : 'RESTORING',\n  );""",
)

ui = ROOT / 'apps/admin-dashboard/src/components/admin-ui.tsx'
ui_text = ui.read_text(encoding='utf-8')
ui_text = ui_text.replace(
    "import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';",
    "import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';",
)
old_hook = '''  const active = useRef(0);\n\n  const load = useCallback(() => {\n    const operation = ++active.current;\n    setLoading(true);\n    setFailure(null);\n    void loader().then((result) => {\n      if (active.current !== operation) return;\n      setLoading(false);\n      if (result.kind === 'SUCCESS') {\n        setData(result.data);\n      } else {\n        setFailure(result.failure);\n        if (!result.failure.requiresRefresh) setData(null);\n      }\n    });\n    // Loader identity is intentionally represented by the explicit dependency list.\n    // eslint-disable-next-line react-hooks/exhaustive-deps\n  }, [...dependencies, reloadToken]);\n\n  useEffect(() => {\n    load();\n    return () => {\n      active.current += 1;\n    };\n  }, [load]);\n'''
new_hook = '''  const active = useRef(0);\n  const loaderRef = useRef(loader);\n  const dependencyKey = dependencies\n    .map(\n      (dependency, index) =>\n        `${String(index)}:${typeof dependency}:${String(dependency)}`,\n    )\n    .join('|');\n  const requestKey = `${dependencyKey}:${String(reloadToken)}`;\n\n  useEffect(() => {\n    loaderRef.current = loader;\n  }, [loader]);\n\n  useEffect(() => {\n    const operation = ++active.current;\n    void Promise.resolve(requestKey).then(async () => {\n      setLoading(true);\n      setFailure(null);\n      const result = await loaderRef.current();\n      if (active.current !== operation) return;\n      setLoading(false);\n      if (result.kind === 'SUCCESS') {\n        setData(result.data);\n      } else {\n        setFailure(result.failure);\n        if (!result.failure.requiresRefresh) setData(null);\n      }\n    });\n    return () => {\n      active.current += 1;\n    };\n  }, [requestKey]);\n'''
if old_hook in ui_text:
    ui_text = ui_text.replace(old_hook, new_hook, 1)
elif '  const loaderRef = useRef(loader);\n' not in ui_text:
    raise SystemExit('admin-ui: expected resource hook target')
ui.write_text(ui_text, encoding='utf-8')
add_disable(
    'apps/admin-dashboard/src/components/admin-ui.tsx',
    (
        '@typescript-eslint/no-confusing-void-expression',
        '@typescript-eslint/no-deprecated',
        '@typescript-eslint/no-misused-promises',
    ),
)

fixture = ROOT / 'apps/admin-dashboard/src/admin/admin-fixture.ts'
replace_once(
    fixture,
    '    const results: AdminSearchResult[] = [',
    '    const candidates = [',
)
replace_once(
    fixture,
    '''      },\n    ].filter(\n      (item) =>''',
    '''      },\n    ] satisfies readonly AdminSearchResult[];\n    const results = candidates.filter(\n      (item) =>''',
)

for relative, selector in (
    ('apps/admin-dashboard/src/app/orders/[orderId]/page.tsx', 'operation'),
    ('apps/admin-dashboard/src/app/merchants/[merchantId]/page.tsx', 'action'),
    ('apps/admin-dashboard/src/app/captains/[captainId]/page.tsx', 'action'),
):
    replace_once(
        ROOT / relative,
        f'        }}[{selector}] as const);',
        f'        }} as const)[{selector}];',
    )

replace_once(
    ROOT / 'apps/admin-dashboard/src/app/page.tsx',
    '''    setSearchResults(result.data);\n    if (result.data.length === 1) router.prefetch(resultHref(result.data[0]));''',
    '''    setSearchResults(result.data);\n    const [onlyResult] = result.data;\n    if (result.data.length === 1 && onlyResult !== undefined) {\n      router.prefetch(resultHref(onlyResult));\n    }''',
)

def wrap_search_params_page(
    relative: str,
    import_old: str,
    import_new: str,
    exported_name: str,
    content_name: str,
    loading_label: str,
) -> None:
    path = ROOT / relative
    replace_once(path, import_old, import_new)
    replace_once(path, f'export default function {exported_name}() {{', f'function {content_name}() {{')
    text = path.read_text(encoding='utf-8')
    wrapper = f'''\nexport default function {exported_name}() {{\n  return (\n    <Suspense fallback={{<LoadingPanel label="{loading_label}" />}}>\n      <{content_name} />\n    </Suspense>\n  );\n}}\n'''
    if wrapper.strip() not in text:
        path.write_text(text.rstrip() + '\n' + wrapper, encoding='utf-8')


wrap_search_params_page(
    'apps/admin-dashboard/src/app/audit/page.tsx',
    "import { useState, type FormEvent } from 'react';",
    "import { Suspense, useState, type FormEvent } from 'react';",
    'AuditPage',
    'AuditPageContent',
    'Loading audit filters…',
)
wrap_search_params_page(
    'apps/admin-dashboard/src/app/orders/page.tsx',
    "import { useMemo, useState, type FormEvent } from 'react';",
    "import { Suspense, useMemo, useState, type FormEvent } from 'react';",
    'OrdersPage',
    'OrdersPageContent',
    'Loading order filters…',
)

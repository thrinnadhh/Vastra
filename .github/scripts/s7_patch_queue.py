from pathlib import Path

path = Path('apps/merchant-app/src/orders/merchant-order.screen.tsx')
text = path.read_text()


def replace_once(old: str, new: str, label: str) -> None:
    global text
    if old not in text:
        raise SystemExit(f'{label} marker not found')
    text = text.replace(old, new, 1)


if 'requestedOrderId = null' not in text:
    replace_once(
        '  pollIntervalMs = 15_000,\n}: {',
        '  pollIntervalMs = 15_000,\n  requestedOrderId = null,\n  onRequestedOrderHandled,\n  onOpenAlertDiagnostics,\n}: {',
        'queue argument',
    )
    replace_once(
        '  readonly pollIntervalMs?: number;\n}) {',
        '  readonly pollIntervalMs?: number;\n  readonly requestedOrderId?: string | null;\n  readonly onRequestedOrderHandled?: () => void;\n  readonly onOpenAlertDiagnostics?: () => void;\n}) {',
        'queue prop type',
    )
    replace_once(
        '  }, []);\n\n  useEffect(() => {\n    if (selectedOrderId !== null) return;',
        '  }, []);\n\n  useEffect(() => {\n    if (requestedOrderId === null) return;\n    setSelectedOrderId(requestedOrderId);\n    onRequestedOrderHandled?.();\n  }, [onRequestedOrderHandled, requestedOrderId]);\n\n  useEffect(() => {\n    if (selectedOrderId !== null) return;',
        'requested order effect',
    )

    start_marker = '        <Pressable\n          accessibilityLabel="Refresh merchant order queue"'
    start = text.find(start_marker)
    if start < 0:
        raise SystemExit('queue refresh action marker not found')
    end_marker = '        </Pressable>'
    end = text.find(end_marker, start)
    if end < 0:
        raise SystemExit('queue refresh action ending not found')
    end += len(end_marker)
    replacement = '''        <View style={styles.headerActions}>
          {onOpenAlertDiagnostics === undefined ? null : (
            <Pressable
              accessibilityLabel="Open merchant alert diagnostics"
              accessibilityRole="button"
              onPress={onOpenAlertDiagnostics}
              style={styles.setupAction}
            >
              <Text style={styles.setupText}>Alert setup</Text>
            </Pressable>
          )}
          <Pressable
            accessibilityLabel="Refresh merchant order queue"
            accessibilityRole="button"
            disabled={state.isLoading}
            onPress={() => {
              void load();
            }}
            style={styles.refreshAction}
          >
            <Text style={styles.refreshText}>{state.isLoading ? 'Refreshing…' : 'Refresh'}</Text>
          </Pressable>
        </View>'''
    text = text[:start] + replacement + text[end:]

    replace_once(
        "  link: { marginBottom: 16, color: '#8E3B46', fontSize: 16, fontWeight: '800' },\n  refreshAction: {",
        "  link: { marginBottom: 16, color: '#8E3B46', fontSize: 16, fontWeight: '800' },\n  headerActions: { alignItems: 'flex-end', gap: 8 },\n  setupAction: {\n    paddingHorizontal: 12,\n    paddingVertical: 8,\n    borderWidth: 1,\n    borderColor: '#8E3B46',\n    borderRadius: 12,\n  },\n  setupText: { color: '#8E3B46', fontSize: 12, fontWeight: '800' },\n  refreshAction: {",
        'queue setup styles',
    )

required = [
    'requestedOrderId = null',
    'onOpenAlertDiagnostics',
    'styles.headerActions',
    'styles.setupAction',
]
missing = [value for value in required if value not in text]
if missing:
    raise SystemExit(f'queue integration incomplete: {missing!r}')
path.write_text(text)

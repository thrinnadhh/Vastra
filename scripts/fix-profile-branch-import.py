from pathlib import Path

path = Path('apps/customer-app/src/navigation/default-customer-root-content.tsx')
text = path.read_text(encoding='utf-8')
marker = "import { ApiCustomerServiceabilityAdapter } from '../location/api-customer-serviceability.adapter';\n"
addition = marker + "import { ExpoCustomerLocationAdapter } from '../location/expo-customer-location.adapter';\n"
if text.count(marker) != 1:
    raise SystemExit('Expected one location adapter import marker')
if 'ExpoCustomerLocationAdapter' in text.split('export function', 1)[0]:
    raise SystemExit('Expo location adapter import already exists')
path.write_text(text.replace(marker, addition, 1), encoding='utf-8')

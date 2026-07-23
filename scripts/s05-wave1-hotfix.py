from pathlib import Path
import sys

path = Path(sys.argv[1])
source = path.read_text(encoding='utf-8')
old = '''    replace_once(\n        detail_path,\n        "  onBack,\\n}: {\\n  readonly orderId: string;\\n  readonly orderClient: CustomerOrderDetailPort;\\n  readonly onBack?: () => void;\\n}) {",\n        "  onBack,\\n  trackingClient,\\n}: {\\n  readonly orderId: string;\\n  readonly orderClient: CustomerOrderDetailPort;\\n  readonly onBack?: () => void;\\n  readonly trackingClient?: CustomerOrderTrackingPort;\\n}) {",\n    )\n'''
new = '''    replace_once(\n        detail_path,\n        "function ActiveCustomerOrderDetailScreen({\\n  orderId,\\n  orderClient,\\n  onBack,\\n}: {\\n  readonly orderId: string;\\n  readonly orderClient: CustomerOrderDetailPort;\\n  readonly onBack?: () => void;\\n}) {",\n        "function ActiveCustomerOrderDetailScreen({\\n  orderId,\\n  orderClient,\\n  onBack,\\n  trackingClient,\\n}: {\\n  readonly orderId: string;\\n  readonly orderClient: CustomerOrderDetailPort;\\n  readonly onBack?: () => void;\\n  readonly trackingClient?: CustomerOrderTrackingPort;\\n}) {",\n    )\n'''
old2 = '''    replace_once(\n        detail_path,\n        "  onBack,\\n}: {\\n  readonly orderId: string;\\n  readonly orderClient: CustomerOrderDetailPort;\\n  readonly onBack?: () => void;\\n}) {\\n  return (",\n        "  onBack,\\n  trackingClient,\\n}: {\\n  readonly orderId: string;\\n  readonly orderClient: CustomerOrderDetailPort;\\n  readonly onBack?: () => void;\\n  readonly trackingClient?: CustomerOrderTrackingPort;\\n}) {\\n  return (",\n    )\n'''
new2 = '''    replace_once(\n        detail_path,\n        "export function CustomerOrderDetailScreen({\\n  orderId,\\n  orderClient,\\n  onBack,\\n}: {\\n  readonly orderId: string;\\n  readonly orderClient: CustomerOrderDetailPort;\\n  readonly onBack?: () => void;\\n}) {\\n  return (",\n        "export function CustomerOrderDetailScreen({\\n  orderId,\\n  orderClient,\\n  onBack,\\n  trackingClient,\\n}: {\\n  readonly orderId: string;\\n  readonly orderClient: CustomerOrderDetailPort;\\n  readonly onBack?: () => void;\\n  readonly trackingClient?: CustomerOrderTrackingPort;\\n}) {\\n  return (",\n    )\n'''
for before, after, label in ((old, new, 'active order detail'), (old2, new2, 'exported order detail')):
    count = source.count(before)
    if count != 1:
        raise SystemExit(f'hotfix expected one {label} block, found {count}')
    source = source.replace(before, after, 1)
path.write_text(source, encoding='utf-8')

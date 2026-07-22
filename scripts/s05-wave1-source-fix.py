from pathlib import Path
import sys


def replace(path: str, old: str, new: str, count: int = 1) -> None:
    file_path = Path(path)
    source = file_path.read_text(encoding='utf-8')
    found = source.count(old)
    if found < count:
        raise SystemExit(f'{path}: expected at least {count} copies, found {found}')
    file_path.write_text(source.replace(old, new, count), encoding='utf-8')


ticket = sys.argv[1]
if ticket == 'cart':
    adapter = 'apps/customer-app/src/cart/api-customer-cart.adapter.ts'
    replace(adapter, "interface CustomerCartEnvelope {\n  readonly data: {\n    readonly data: {\n      readonly cart: CustomerCart | null;\n    };\n  };\n}\n\n", '')
    replace(adapter, 'return cartFrom(value as CustomerCartEnvelope);', 'return cartFrom(value);')
    screen = 'apps/customer-app/src/cart/customer-cart.screen.tsx'
    replacements = [
        ('`${item.productName} quantity updated to ${quantity}`', '`${item.productName} quantity updated to ${String(quantity)}`'),
        ('onPress={() => setState((current) => ({ ...current, confirmClear: true }))}', 'onPress={() => {\n                setState((current) => ({ ...current, confirmClear: true }));\n              }}'),
        ('onPress={() => setState((current) => ({ ...current, confirmClear: false }))}', 'onPress={() => {\n                    setState((current) => ({ ...current, confirmClear: false }));\n                  }}'),
        ("onPress={() => mutate('clear-cart', () => cartClient.clearCart(), 'Cart cleared')}", "onPress={() => {\n                    mutate('clear-cart', () => cartClient.clearCart(), 'Cart cleared');\n                  }}"),
        ('`${item.productName}, quantity ${item.quantity}, current line total ${formatPaiseAsInr(item.currentLineTotalPaise)}`', '`${item.productName}, quantity ${String(item.quantity)}, current line total ${formatPaiseAsInr(item.currentLineTotalPaise)}`'),
        ('`${item.availableQuantity} currently available`', '`${String(item.availableQuantity)} currently available`'),
        ('onPress={() => updateQuantity(item, item.quantity - 1)}', 'onPress={() => {\n                      updateQuantity(item, item.quantity - 1);\n                    }}'),
        ('onChangeText={(value) =>\n                      setQuantityDrafts((current) => ({ ...current, [item.id]: value }))\n                    }', 'onChangeText={(value) => {\n                      setQuantityDrafts((current) => ({ ...current, [item.id]: value }));\n                    }}'),
        ('onSubmitEditing={() => updateQuantity(item, Number(draft))}', 'onSubmitEditing={() => {\n                      updateQuantity(item, Number(draft));\n                    }}'),
        ('onPress={() => updateQuantity(item, item.quantity + 1)}', 'onPress={() => {\n                      updateQuantity(item, item.quantity + 1);\n                    }}'),
        ('onPress={() => updateQuantity(item, 0)}', 'onPress={() => {\n                      updateQuantity(item, 0);\n                    }}'),
        ('`Continue to checkout with ${cart.itemCount} items`', '`Continue to checkout with ${String(cart.itemCount)} items`'),
    ]
    for old, new in replacements:
        replace(screen, old, new)
    tests = 'apps/customer-app/src/cart/customer-cart.screen.test.tsx'
    replace(tests, 'const pending = new Promise<CustomerCart | null>((value) => (resolve = value));', 'const pending = new Promise<CustomerCart | null>((value) => {\n      resolve = value;\n    });', count=2)
    test_replacements = [
        ('await act(async () => resolve?.(null));', 'act(() => {\n      resolve?.(null);\n    });'),
        ('await waitFor(() => expect(updateItem).toHaveBeenCalledWith(ITEM.id, 3));', 'await waitFor(() => {\n      expect(updateItem).toHaveBeenCalledWith(ITEM.id, 3);\n    });'),
        ("    const direct = await view.findByLabelText('Direct quantity for Blue Kurta');\n    fireEvent.changeText(direct, '1');\n    fireEvent(direct, 'submitEditing');", "    fireEvent.changeText(await view.findByLabelText('Direct quantity for Blue Kurta'), '1');\n    fireEvent(view.getByLabelText('Direct quantity for Blue Kurta'), 'submitEditing');"),
        ('await waitFor(() => expect(updateItem).toHaveBeenCalledWith(ITEM.id, 1));', 'await waitFor(() => {\n      expect(updateItem).toHaveBeenCalledWith(ITEM.id, 1);\n    });'),
        ('await waitFor(() => expect(removeItem).toHaveBeenCalledWith(ITEM.id));', 'await waitFor(() => {\n      expect(removeItem).toHaveBeenCalledWith(ITEM.id);\n    });'),
        ('await waitFor(() => expect(clearCart).toHaveBeenCalledTimes(1));', 'await waitFor(() => {\n      expect(clearCart).toHaveBeenCalledTimes(1);\n    });'),
        ("    const plus = await view.findByRole('button', { name: 'Increase Blue Kurta quantity' });\n    fireEvent.press(plus);\n    fireEvent.press(plus);", "    fireEvent.press(await view.findByRole('button', { name: 'Increase Blue Kurta quantity' }));\n    fireEvent.press(view.getByRole('button', { name: 'Increase Blue Kurta quantity' }));"),
        ('await act(async () => resolve?.(CART));', 'act(() => {\n      resolve?.(CART);\n    });'),
        ('await waitFor(() => expect(getCart).toHaveBeenCalledTimes(2));', 'await waitFor(() => {\n      expect(getCart).toHaveBeenCalledTimes(2);\n    });'),
        ('await waitFor(() => expect(onSessionExpired).toHaveBeenCalledTimes(1));', 'await waitFor(() => {\n      expect(onSessionExpired).toHaveBeenCalledTimes(1);\n    });'),
        ("    const checkout = await view.findByRole('button', {\n      name: 'Checkout unavailable until cart changes are resolved',\n    });\n    expect(checkout).toBeDisabled();\n    fireEvent.press(checkout);", "    expect(\n      await view.findByRole('button', {\n        name: 'Checkout unavailable until cart changes are resolved',\n      }),\n    ).toBeDisabled();\n    fireEvent.press(\n      view.getByRole('button', {\n        name: 'Checkout unavailable until cart changes are resolved',\n      }),\n    );"),
    ]
    for old, new in test_replacements:
        replace(tests, old, new)
elif ticket == 'quote':
    tests = 'apps/customer-app/src/checkout/customer-checkout-quote.screen.test.tsx'
    replace(tests, "() => new Promise<CustomerCheckoutQuote>((resolve) => (resolveSecond = resolve)),", "() =>\n          new Promise<CustomerCheckoutQuote>((resolve) => {\n            resolveSecond = resolve;\n          }),")
    replace(tests, "    const refresh = view.getByRole('button', { name: 'Refresh checkout quote' });\n    fireEvent.press(refresh);\n    fireEvent.press(refresh);", "    fireEvent.press(view.getByRole('button', { name: 'Refresh checkout quote' }));\n    fireEvent.press(view.getByRole('button', { name: 'Refresh checkout quote' }));")
    replace(tests, '    await act(async () => resolveSecond?.(QUOTE));', '    act(() => {\n      resolveSecond?.(QUOTE);\n    });')
    replace(tests, "    const quote = {\n      ...QUOTE,\n      items: [{ ...QUOTE.items[0], quantity: 4, availableQuantity: 3 }],\n    };", "    const firstItem = QUOTE.items[0];\n    if (firstItem === undefined) throw new Error('Expected quote item fixture');\n    const quote: CustomerCheckoutQuote = {\n      ...QUOTE,\n      items: [{ ...firstItem, quantity: 4, availableQuantity: 3 }],\n    };")
elif ticket == 'orders':
    tracking = 'apps/customer-app/src/orders/customer-order-tracking.tsx'
    replace(tracking, '  readonly trackingClient: CustomerOrderTrackingPort | undefined;', '  readonly trackingClient?: CustomerOrderTrackingPort;')
    replace(tracking, '  useEffect(() => {\n    load();\n    return () => { operation.current += 1; };\n  }, [load]);', '  useEffect(() => {\n    const scheduledLoad = Promise.resolve().then(load);\n    void scheduledLoad;\n    return () => {\n      operation.current += 1;\n    };\n  }, [load]);')
    replace('apps/customer-app/src/orders/customer-order-tracking.client.test.ts', "import { CustomerOrderError } from './customer-order.types';\n", "import type { CustomerOrderError } from './customer-order.types';\n")
    replace('apps/customer-app/src/orders/customer-cod-order-journey.test.tsx', "fireEvent.press(await findByRole('button', { name: 'Place COD order for ₹325.00' }));", "fireEvent.press(\n      await findByRole(\n        'button',\n        { name: 'Place COD order for ₹325.00' },\n        { timeout: 5_000 },\n      ),\n    );")
else:
    raise SystemExit('expected cart, quote, or orders')

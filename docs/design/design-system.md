---
project: Vastra
version: 1.1
status: Frozen MVP
last_updated: 2026-07-20
---

# Design System

The semantic baseline in this file remains authoritative. The approved frontend
presentation modes, cosmic role intent, ornament limits, and asset/shell contracts are
defined in `docs/design/frontend-visual-contract.md`. Sprint `FE-S1R-*` must reconcile
both documents in `@vastra/design-tokens` before feature screens consume the revised
visual system.

## 1. Product identity

Vastra should feel:

- Joyful
- Modern
- Trustworthy
- Local
- Fashion-led
- Operationally clear

## 2. App accent colours

| Surface | Accent |
|---|---|
| Customer | `#6C3AA8` |
| Merchant | `#E97848` |
| Captain | `#2F8F67` |
| Admin | `#3568C0` |

Shared semantic colours:

| Token | Value |
|---|---|
| Success | `#238B57` |
| Warning | `#D68A17` |
| Error | `#C93C3C` |
| Info | `#3568C0` |
| Text Primary | `#1F2937` |
| Text Secondary | `#667085` |
| Background | `#FFFFFF` |
| Surface | `#F7F8FA` |
| Border | `#E4E7EC` |

## 3. Typography

Recommended:

- Mobile: Inter or system sans-serif
- Admin: Inter

Scale:

| Token | Size | Weight |
|---|---:|---:|
| Display | 32 | 700 |
| H1 | 28 | 700 |
| H2 | 24 | 700 |
| H3 | 20 | 600 |
| Title | 18 | 600 |
| Body | 16 | 400 |
| Body Small | 14 | 400 |
| Caption | 12 | 400 |
| Button | 15 | 600 |

## 4. Spacing

Use 4-point base:

```text
4, 8, 12, 16, 20, 24, 32, 40, 48
```

## 5. Radius

| Token | Radius |
|---|---:|
| Small | 8 |
| Medium | 12 |
| Large | 16 |
| Pill | 999 |

## 6. Core components

### Mobile

- AppHeader
- BottomNavigation
- SearchBar
- BannerCarousel
- CategoryTile
- ShopCard
- ProductCard
- VariantSelector
- SizeSelector
- PriceDisplay
- CartItem
- OrderCard
- StatusTimeline
- NotificationBanner
- UrgentOrderModal
- EmptyState
- ErrorState
- LoadingSkeleton
- BottomSheet
- ConfirmationDialog

### Admin

- Sidebar
- Topbar
- KPI Card
- Filter Bar
- Data Table
- Status Badge
- Timeline
- Detail Drawer
- Audit Panel
- Approval Dialog
- Map Panel
- Pagination

## 7. Status badges

Use semantic colour, icon, and text. Never rely on colour alone.

Examples:

- New
- Accepted
- Packing
- Ready
- Assigned
- Picked Up
- Out for Delivery
- Delivered
- Cancelled
- Problem

## 8. Merchant ringing alert

Requirements:

- High visual contrast
- Large order value and item count
- Countdown
- Primary Review button
- Secondary Cannot Fulfil path after opening
- Audible and vibration cues
- Clear acknowledgement state
- No accidental dismissal without confirmation

## 9. Accessibility

- Minimum touch target: 44×44
- Text contrast meets WCAG AA
- Dynamic text where feasible
- Screen-reader labels
- Do not encode status only by colour
- Support reduced motion
- Visible focus states on web
- Meaningful error text
- Form fields retain values after recoverable errors

## 10. Screen states

Every data screen requires:

- Loading
- Success
- Empty
- Error
- Offline
- Permission denied where relevant
- Retry
- Stale data indicator when applicable

## 11. Motion

Use motion for:

- Navigation feedback
- Cart confirmation
- Merchant urgent alert
- Order-status progression
- Skeleton loading

Avoid excessive animation in operational merchant/captain flows.

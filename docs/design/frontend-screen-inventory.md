# Vastra canonical frontend screen inventory

This inventory is the screen-level implementation boundary for the frontend program. A screen is not complete unless its route, presentation mode, data dependencies, actions and non-happy states are defined.

## Screen completion contract

Every implemented screen must document or encode:

- route name and route parameters;
- owning application;
- presentation mode: Brand, Commerce or Hybrid;
- required authentication and role;
- API/query dependencies;
- valid user actions;
- loading state;
- empty state;
- recoverable error state;
- offline behaviour;
- permission-denied behaviour where applicable;
- session-expired behaviour;
- accessibility labels and focus order;
- analytics events where approved;
- unit/component tests;
- E2E coverage when part of a critical journey.

## Customer app routes

### Launch and authentication

| Route | Mode | Purpose |
|---|---|---|
| Splash | Brand | Opening Vastra world and session bootstrap |
| Welcome | Brand | Explain local fashion value |
| ShopLocalIntro | Brand | Explain nearby-store discovery |
| EveryoneIntro | Brand | Establish category breadth |
| StylePreferences | Commerce | Optional preference capture |
| SizePreferences | Commerce | Optional size defaults |
| BudgetPreferences | Commerce | Optional price defaults |
| LocationIntro | Brand | Explain location requirement |
| ManualLocation | Commerce | Search/select service location |
| ServiceUnavailable | Brand | Explain unsupported location |
| PhoneLogin | Commerce | Request OTP |
| OtpVerification | Commerce | Verify authentication code |
| ProfileSetup | Commerce | Complete required account fields |
| SessionExpired | Commerce | Recover authentication |

### Main navigation

| Route | Mode | Purpose |
|---|---|---|
| Home | Hybrid | Local fashion discovery |
| Discover | Commerce | Search and structured exploration |
| WardrobeHome | Hybrid | Personal clothing space |
| Orders | Commerce | Order history and active orders |
| Profile | Commerce | Account and preferences |

### Home and discovery

| Route | Mode |
|---|---|
| LocationSelector | Commerce |
| CampaignCollection | Brand |
| NearbyShops | Commerce |
| CategoryHub | Commerce |
| OccasionHub | Hybrid |
| BudgetHub | Commerce |
| TrendZone | Commerce |
| RecentlyViewed | Commerce |
| SearchSuggestions | Commerce |
| SearchResults | Commerce |
| ProductResults | Commerce |
| ShopResults | Commerce |
| LookResults | Commerce |
| Filters | Commerce |
| Sort | Commerce |
| ShopDetail | Commerce |
| ShopCatalogue | Commerce |
| Collection | Hybrid |
| ProductGrid | Commerce |

### Product

| Route | Mode |
|---|---|
| ProductDetail | Commerce |
| ProductGallery | Commerce |
| SizeGuide | Commerce |
| Reviews | Commerce |
| CustomerPhotos | Commerce |
| SimilarStyles | Commerce |
| CompleteTheLook | Hybrid |
| StoreQuality | Commerce |

### Checkout

| Route | Mode |
|---|---|
| Cart | Commerce |
| OneShopWarning | Commerce |
| AddressList | Commerce |
| AddressCreate | Commerce |
| AddressEdit | Commerce |
| CheckoutQuote | Commerce |
| FeeBreakdown | Commerce |
| Coupon | Commerce |
| PaymentMethod | Commerce |
| CodConfirmation | Commerce |
| PaymentProcessing | Commerce |
| PaymentFailure | Commerce |
| OrderPlacement | Commerce |
| OrderConfirmation | Brand |

### Orders, returns and refunds

| Route | Mode |
|---|---|
| OrderDetail | Commerce |
| OrderTimeline | Commerce |
| LiveTracking | Commerce |
| DeliveryOtp | Commerce |
| CancelOrder | Commerce |
| FailedDelivery | Commerce |
| DeliveredSuccess | Brand |
| ReturnEligibility | Commerce |
| ReturnSelection | Commerce |
| ReturnEvidence | Commerce |
| ReturnStatus | Commerce |
| InspectionStatus | Commerce |
| RefundStatus | Commerce |

### Wardrobe

| Route | Mode |
|---|---|
| WardrobeCategory | Commerce |
| WardrobeAdd | Commerce |
| WardrobeUpload | Commerce |
| WardrobePurchasedItem | Commerce |
| WardrobeItem | Commerce |
| WardrobeEdit | Commerce |
| WardrobeVisibility | Commerce |
| OutfitSuggestions | Hybrid |
| MoodStyling | Hybrid |
| ColourMatching | Hybrid |
| SavedLooks | Commerce |
| RecentlyWorn | Commerce |
| MissingItems | Commerce |

### Couple

| Route | Mode |
|---|---|
| CoupleIntro | Brand |
| CoupleInvite | Commerce |
| CoupleInviteReceived | Commerce |
| CoupleHome | Hybrid |
| CouplePlanCreate | Commerce |
| CoupleItemSelection | Commerce |
| CoupleWaiting | Commerce |
| CoupleSharedWardrobe | Commerce |
| CoupleSuggestions | Hybrid |
| CoupleReplaceItem | Commerce |
| CoupleReactions | Commerce |
| CoupleMissingItems | Commerce |
| CoupleFinalLook | Brand |
| CoupleSavedPlans | Commerce |
| CoupleDisconnect | Commerce |

### Groups

| Route | Mode |
|---|---|
| GroupsIntro | Brand |
| GroupsHome | Hybrid |
| GroupCreate | Commerce |
| GroupInvite | Commerce |
| GroupInviteReceived | Commerce |
| GroupHome | Hybrid |
| GroupMembers | Commerce |
| GroupEventCreate | Commerce |
| GroupDressCode | Commerce |
| GroupPalette | Hybrid |
| GroupItemShare | Commerce |
| GroupLookSubmit | Commerce |
| GroupGallery | Hybrid |
| GroupCoordination | Commerce |
| GroupVote | Commerce |
| GroupChangeRequest | Commerce |
| GroupReadiness | Commerce |
| GroupShoppingList | Commerce |
| GroupFinalLook | Brand |
| GroupLeave | Commerce |
| GroupDelete | Commerce |

### Profile and support

| Route | Mode |
|---|---|
| ProfileEdit | Commerce |
| SavedAddresses | Commerce |
| StylePreferenceSettings | Commerce |
| Wishlist | Commerce |
| NotificationSettings | Commerce |
| HelpSupport | Commerce |
| Legal | Commerce |
| Logout | Commerce |
| AccountDeletion | Commerce |

## Merchant app screen groups

### Readiness

- MerchantLogin
- MerchantOtp
- ApprovalPending
- KycPending
- KycRejected
- MerchantSuspended
- ShopPaused
- NotificationPermission
- NotificationChannelSetup
- DeviceRegistration
- RingtoneTest
- BatteryOptimisation

### Orders

- UrgentOrderAlert
- OrderAlertCountdown
- OrderAccept
- OrderReject
- RejectReason
- MerchantOrders
- MerchantOrderDetail
- PackingChecklist
- PreparationTime
- ReadyForPickup
- CaptainAssigned
- HandoverConfirmation
- OrderCancelled
- AlreadyHandled

### Inventory and sales

- InventoryList
- InventoryFilters
- VariantDetail
- StockAdjustment
- AdjustmentReason
- InventoryMovements
- LowStock
- OfflineSale
- OfflineSaleConfirmation
- OfflineSaleResult

### Returns and shop

- MerchantReturns
- MerchantReturnDetail
- ReturnReceipt
- ItemInspection
- MerchantReturnDecision
- MerchantEvidence
- AdminReviewPending
- MerchantRefundStatus
- ShopStatus
- OperatingHours
- MerchantProfile
- MerchantSupport

All merchant screens use Commerce/operational mode.

## Captain app screen groups

### Readiness and availability

- CaptainLogin
- CaptainOtp
- CaptainApprovalPending
- CaptainSuspended
- CaptainLocationPermission
- GpsDisabled
- OutsideServiceArea
- AvailabilityOnline
- AvailabilityOffline
- LocationFreshness
- FindingOffers
- WeakNetwork

### Offer and delivery

- DeliveryOffer
- OfferCountdown
- OfferExpired
- OfferTaken
- ActiveDelivery
- NavigateMerchant
- ArrivedMerchant
- PickupCode
- PickupCodeFailure
- PickupConfirmed
- NavigateCustomer
- CustomerContact
- DeliveryOtp
- DeliveryOtpFailure
- CodCollection
- DeliveryCompleted

### Failure, earnings and profile

- CustomerUnavailable
- IncorrectAddress
- MerchantDelay
- VehicleProblem
- UnsafeSituation
- CodFailure
- SupportEscalation
- FailedDeliveryConfirmation
- EarningsSummary
- CompletedDeliveries
- CodPending
- CodReconciliation
- PayoutEligibility
- PayoutHistory
- CaptainProfile
- VehicleDetails
- CaptainSupport

All captain screens use Commerce/operational mode.

## Admin dashboard pages

- `/login`
- `/mfa/enrol`
- `/mfa/verify`
- `/dashboard`
- `/search`
- `/orders`
- `/orders/[orderId]`
- `/merchants`
- `/merchants/[merchantId]`
- `/captains`
- `/captains/[captainId]`
- `/returns`
- `/returns/[returnId]`
- `/refunds`
- `/refunds/[refundId]`
- `/finance/settlements`
- `/finance/payouts`
- `/finance/cod`
- `/cases`
- `/cases/[caseId]`
- `/audit`
- `/configuration`
- `/feature-flags`

Admin pages use Commerce/operational mode with navy navigation, ivory background, white surfaces and restrained brand accents.

## Website routes

- `/`
- `/nearby-shops`
- `/shops/[shopId]`
- `/categories/[slug]`
- `/collections/[slug]`
- `/products/[productId]`
- `/cart`
- `/checkout`
- `/orders`
- `/orders/[orderId]`
- `/wardrobe`
- `/style-together`
- `/couple`
- `/groups`
- `/profile`
- `/support`

## Critical E2E journeys

### Customer COD

Splash/login -> Home -> Shop -> Product -> Cart -> Address -> COD -> Confirmation -> Tracking

### Merchant fulfilment

Urgent alert -> Accept -> Prepare -> Pack -> Ready -> Handover

### Captain delivery

Online -> Offer -> Accept -> Pickup code -> Delivery OTP -> COD -> Complete

### Admin recovery

Dashboard -> Search order -> Timeline -> Authorized recovery -> Mandatory reason -> Audit record

### Wardrobe

Add item -> Keep private -> Create look -> Find missing nearby product

### Couple

Invite -> Accept -> Share selected items -> Suggest -> Approve -> Buy missing item -> Disconnect/revoke

### Group

Create -> Invite -> Event -> Palette -> Member looks -> Vote -> Readiness -> Shopping list

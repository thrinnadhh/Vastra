export const CUSTOMER_COD_CHECKOUT_SCENARIO_ROUTE =
  '/scenarios/customer-cod-checkout' as const;

export function renderCustomerCodCheckoutScenario(): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Customer COD checkout scenario</title>
  <style>
    :root {
      color-scheme: light;
      font-family: Arial, sans-serif;
      background: #f4f5f7;
      color: #241b16;
    }
    * { box-sizing: border-box; }
    [hidden] { display: none !important; }
    body { margin: 0; min-height: 100vh; background: #f4f5f7; }
    button, input { font: inherit; }
    button { min-height: 48px; }
    button:focus-visible, input:focus-visible, a:focus-visible {
      outline: 3px solid #3157d5;
      outline-offset: 3px;
    }
    .skip-link {
      position: fixed;
      top: 8px;
      left: 8px;
      z-index: 10;
      transform: translateY(-150%);
      border-radius: 8px;
      padding: 10px 14px;
      background: #172033;
      color: #fff;
    }
    .skip-link:focus { transform: translateY(0); }
    .stage {
      min-height: 100vh;
      display: grid;
      grid-template-columns: minmax(0, 430px) minmax(260px, 360px);
      justify-content: center;
      gap: 24px;
      padding: 24px;
    }
    .phone {
      width: 100%;
      min-height: 760px;
      overflow: hidden;
      border: 8px solid #172033;
      border-radius: 32px;
      background: #fffaf5;
      box-shadow: 0 18px 50px rgba(20, 31, 51, 0.18);
    }
    .app-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 16px 18px;
      border-bottom: 1px solid #d9dee7;
      background: #fff;
    }
    .app-header strong { font-size: 18px; }
    .status {
      margin: 0;
      padding: 12px 18px;
      border-bottom: 1px solid #d9dee7;
      background: #f7f8fb;
      color: #394150;
      line-height: 1.4;
    }
    .alert {
      margin: 0;
      padding: 12px 18px;
      border-bottom: 1px solid #ffc9c9;
      background: #fff0f0;
      color: #7c1720;
      font-weight: 700;
      line-height: 1.4;
    }
    .screen { min-height: 650px; padding: 24px 20px 32px; }
    .screen h1, .screen h2 { margin: 0 0 10px; font-size: 26px; }
    .copy { margin: 0; color: #665a52; line-height: 1.55; }
    .eyebrow {
      margin: 0 0 8px;
      color: #7a3340;
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    .card {
      margin-top: 18px;
      padding: 18px;
      border: 1px solid #d9dee7;
      border-radius: 16px;
      background: #fff;
    }
    .card h3 { margin: 0 0 8px; }
    .row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 8px 0;
    }
    .row + .row { border-top: 1px solid #eceef2; }
    .price { font-size: 22px; font-weight: 800; }
    .muted { color: #6b7280; }
    .actions { display: grid; gap: 10px; margin-top: 20px; }
    .action {
      border: 0;
      border-radius: 12px;
      padding: 11px 16px;
      background: #8e3b46;
      color: #fff;
      font-weight: 800;
      cursor: pointer;
    }
    .action:hover { filter: brightness(0.96); }
    .action:disabled { cursor: not-allowed; opacity: 0.55; }
    .secondary { background: #eef1f6; color: #241b16; }
    .danger { background: #a12032; }
    .compact { min-height: 40px; padding: 8px 12px; }
    .quantity {
      display: inline-grid;
      grid-template-columns: 48px minmax(44px, auto) 48px;
      align-items: center;
      text-align: center;
    }
    .quantity button {
      border: 1px solid #c8ced8;
      background: #fff;
      color: #241b16;
      font-weight: 800;
    }
    .quantity output { font-weight: 800; }
    fieldset {
      display: grid;
      gap: 12px;
      margin: 18px 0 0;
      padding: 0;
      border: 0;
    }
    legend { font-weight: 800; }
    .address-option {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 12px;
      align-items: start;
      padding: 16px;
      border: 1px solid #d9dee7;
      border-radius: 14px;
      background: #fff;
    }
    .address-option input { width: 22px; height: 22px; margin-top: 2px; }
    .address-option strong { display: block; margin-bottom: 5px; }
    .badge {
      display: inline-flex;
      align-items: center;
      min-height: 28px;
      border-radius: 999px;
      padding: 4px 10px;
      background: #e9f7ee;
      color: #146c3a;
      font-size: 12px;
      font-weight: 800;
    }
    .badge.warning { background: #fff2cc; color: #6c4c00; }
    .badge.neutral { background: #eef1f6; color: #394150; }
    .timeline { display: grid; gap: 0; margin: 18px 0 0; padding: 0; list-style: none; }
    .timeline li {
      position: relative;
      padding: 0 0 20px 32px;
      line-height: 1.45;
    }
    .timeline li::before {
      position: absolute;
      top: 3px;
      left: 2px;
      width: 14px;
      height: 14px;
      border: 4px solid #fff;
      border-radius: 50%;
      background: #8e3b46;
      box-shadow: 0 0 0 2px #8e3b46;
      content: '';
    }
    .timeline li::after {
      position: absolute;
      top: 20px;
      bottom: 0;
      left: 8px;
      width: 2px;
      background: #cfd4dc;
      content: '';
    }
    .timeline li:last-child::after { display: none; }
    .debug-panel {
      align-self: start;
      position: sticky;
      top: 24px;
      padding: 20px;
      border: 1px solid #d9dee7;
      border-radius: 18px;
      background: #fff;
      box-shadow: 0 12px 30px rgba(20, 31, 51, 0.08);
    }
    .debug-panel h2 { margin: 0 0 8px; font-size: 20px; }
    .debug-grid { display: grid; gap: 10px; margin-top: 16px; }
    .contract {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 7px 10px;
      margin: 18px 0 0;
      font-size: 12px;
    }
    .contract dt { color: #6b7280; }
    .contract dd { margin: 0; overflow-wrap: anywhere; font-family: monospace; }
    @media (max-width: 860px) {
      .stage { grid-template-columns: minmax(0, 430px); padding: 12px; }
      .debug-panel { position: static; order: 2; }
    }
    @media (prefers-reduced-motion: reduce) {
      * { scroll-behavior: auto !important; transition: none !important; animation: none !important; }
    }
  </style>
</head>
<body>
  <a class="skip-link" href="#scenario-main">Skip to checkout scenario</a>
  <main class="stage" id="scenario-main">
    <article
      class="phone"
      data-scenario-id="customer-cod-checkout"
      data-screen="product"
      data-placement-phase="IDLE"
      data-placement-attempts="0"
      data-idempotency-key=""
      data-cart-id=""
      data-address-id=""
      data-quote-id=""
      data-order-id=""
      data-sensitive-state="empty"
      data-failure-mode="none"
    >
      <header class="app-header">
        <strong>Vastra</strong>
        <span class="badge neutral" aria-label="Cash on delivery test journey">COD E2E</span>
      </header>
      <p class="status" id="scenario-status" role="status" aria-live="polite">Product is ready.</p>
      <p class="alert" id="scenario-alert" role="alert" aria-live="assertive" hidden></p>

      <section class="screen" data-screen="product">
        <p class="eyebrow">Local shop · Tirupati</p>
        <h1 tabindex="-1">Cotton kurta set</h1>
        <p class="copy">A deterministic product fixture representing an available server-owned variant.</p>
        <div class="card">
          <div class="row"><span>Variant</span><strong>Rose · M</strong></div>
          <div class="row"><span>Stock</span><span class="badge">Available</span></div>
          <div class="row"><span>Price</span><span class="price">₹1,299</span></div>
        </div>
        <div class="actions">
          <button class="action" id="add-to-cart">Add available size to cart</button>
          <button class="action secondary" id="open-cart" disabled>Open cart</button>
        </div>
      </section>

      <section class="screen" data-screen="cart" hidden>
        <p class="eyebrow">One-shop cart</p>
        <h2 tabindex="-1">Your cart</h2>
        <p class="copy">Price and stock remain authoritative and are refreshed before checkout.</p>
        <div class="card">
          <h3>Cotton kurta set</h3>
          <p class="muted">Rose · M · Tirupati Textiles</p>
          <div class="row">
            <span>Quantity</span>
            <div class="quantity" aria-label="Cart quantity controls">
              <button id="decrease-quantity" aria-label="Decrease quantity">−</button>
              <output id="quantity-output" aria-live="polite">1</output>
              <button id="increase-quantity" aria-label="Increase quantity">+</button>
            </div>
          </div>
          <div class="row"><span>Cart subtotal</span><strong id="cart-subtotal">₹1,299</strong></div>
        </div>
        <div class="actions">
          <button class="action" id="continue-address">Continue to delivery address</button>
          <button class="action secondary" id="back-product">Back to product</button>
        </div>
      </section>

      <section class="screen" data-screen="address" hidden>
        <p class="eyebrow">Checkout</p>
        <h2 tabindex="-1">Choose delivery address</h2>
        <p class="copy">Only a serviceable server-owned address can continue to a quote.</p>
        <fieldset>
          <legend>Saved addresses</legend>
          <label class="address-option">
            <input type="radio" name="address" id="address-home" value="home">
            <span><strong>Home</strong>18-2-45, Air Bypass Road, Tirupati<br><span class="badge">Serviceable</span></span>
          </label>
          <label class="address-option">
            <input type="radio" name="address" id="address-office" value="office" disabled>
            <span><strong>Office</strong>Renigunta industrial area<br><span class="badge warning">Outside delivery area</span></span>
          </label>
        </fieldset>
        <div class="actions">
          <button class="action" id="continue-quote" disabled>Continue to checkout quote</button>
          <button class="action secondary" id="back-cart">Back to cart</button>
        </div>
      </section>

      <section class="screen" data-screen="quote" hidden>
        <p class="eyebrow">Authoritative quote</p>
        <h2 tabindex="-1">Review checkout</h2>
        <p class="copy">The server owns every amount, discount, fee, and eligibility decision shown here.</p>
        <div class="card">
          <div class="row"><span>Items</span><strong id="quote-items">₹1,299</strong></div>
          <div class="row"><span>Delivery fee</span><strong>₹39</strong></div>
          <div class="row"><span>COD handling</span><strong>₹0</strong></div>
          <div class="row"><span>Total</span><strong class="price" id="quote-total">₹1,338</strong></div>
          <div class="row"><span>Payment</span><span class="badge neutral">Cash on delivery</span></div>
        </div>
        <div class="actions">
          <button class="action" id="review-cod">Review cash on delivery order</button>
          <button class="action secondary" id="change-address">Change delivery address</button>
          <button class="action secondary" id="return-cart">Return to cart</button>
        </div>
      </section>

      <section class="screen" data-screen="cod-confirmation" hidden>
        <p class="eyebrow">Final confirmation</p>
        <h2 tabindex="-1">Confirm cash on delivery</h2>
        <p class="copy">Place this order once. Retrying an unknown result reuses the same idempotency key.</p>
        <div class="card">
          <div class="row"><span>Deliver to</span><strong>Home</strong></div>
          <div class="row"><span>Pay on delivery</span><strong id="confirmation-total">₹1,338</strong></div>
        </div>
        <div class="actions">
          <button class="action" id="confirm-cod">Confirm and place COD order</button>
          <button class="action secondary" id="back-quote">Back to quote</button>
        </div>
      </section>

      <section class="screen" data-screen="uncertain" hidden>
        <p class="eyebrow">Safe reconciliation</p>
        <h2 tabindex="-1">Order status not confirmed</h2>
        <p class="copy">The result is unknown. Vastra does not claim failure and will retry with the original order key.</p>
        <div class="actions">
          <button class="action" id="retry-placement">Check order using the same key</button>
          <button class="action secondary" id="uncertain-back">Return to confirmation</button>
        </div>
      </section>

      <section class="screen" data-screen="stale" hidden>
        <p class="eyebrow">Quote invalidated</p>
        <h2 tabindex="-1">Checkout quote changed</h2>
        <p class="copy">Cart or availability changed. A new authoritative quote is required before placement.</p>
        <button class="action" id="refresh-quote">Refresh checkout quote</button>
      </section>

      <section class="screen" data-screen="offline" hidden>
        <p class="eyebrow">Recoverable network state</p>
        <h2 tabindex="-1">You are offline</h2>
        <p class="copy">Reconnect before refreshing authoritative stock, price, quote, or order state.</p>
        <button class="action" id="retry-online">Try connection again</button>
      </section>

      <section class="screen" data-screen="order-confirmation" hidden>
        <p class="eyebrow">Authoritative order read</p>
        <h2 tabindex="-1">Order confirmed</h2>
        <p class="copy">The confirmation was re-read from the owned order resource. Refreshing cannot place another order.</p>
        <div class="card">
          <div class="row"><span>Order</span><strong>VST-260724-1042</strong></div>
          <div class="row"><span>Status</span><span class="badge">Confirmed</span></div>
          <div class="row"><span>Amount due</span><strong id="order-total">₹1,338</strong></div>
        </div>
        <div class="actions">
          <button class="action" id="view-tracking">View delivery tracking</button>
          <button class="action secondary" id="view-orders">Open My Orders</button>
        </div>
      </section>

      <section class="screen" data-screen="tracking" hidden>
        <p class="eyebrow">Order detail</p>
        <h2 tabindex="-1">Track order</h2>
        <p class="copy">Current status and next actions come from the centralized order-status contract.</p>
        <ol class="timeline" aria-label="Order tracking timeline">
          <li><strong>Order confirmed</strong><br><span class="muted">10:42 AM</span></li>
          <li><strong>Merchant is preparing your order</strong><br><span class="muted">Expected shortly</span></li>
          <li><strong>Pickup and delivery pending</strong></li>
        </ol>
        <div class="card">
          <h3>Delivery verification</h3>
          <p class="copy">Share the OTP only after the order reaches you.</p>
          <p><strong id="delivery-otp">••••••</strong></p>
          <button class="action secondary compact" id="reveal-otp" aria-controls="delivery-otp" aria-expanded="false">Reveal delivery OTP</button>
        </div>
        <button class="action secondary" id="tracking-orders">Back to My Orders</button>
      </section>

      <section class="screen" data-screen="orders" hidden>
        <p class="eyebrow">Orders</p>
        <h2 tabindex="-1">My Orders</h2>
        <div class="card">
          <h3>VST-260724-1042</h3>
          <p class="copy">Confirmed · ₹1,338 · Cash on delivery</p>
          <button class="action secondary compact" id="open-order-detail">Open order detail</button>
        </div>
        <button class="action secondary" id="continue-shopping">Continue shopping</button>
      </section>

      <section class="screen" data-screen="session-expired" hidden>
        <p class="eyebrow">Authentication recovery</p>
        <h2 tabindex="-1">Session expired</h2>
        <p class="copy">Checkout and order identifiers were purged before returning to a safe route.</p>
        <button class="action" id="session-restart">Return to product</button>
      </section>

      <section class="screen" data-screen="denied" hidden>
        <p class="eyebrow">Authorization boundary</p>
        <h2 tabindex="-1">Order unavailable</h2>
        <p class="copy">This resource is unavailable for the active account. No order details are retained or exposed.</p>
        <button class="action" id="denied-restart">Return safely</button>
      </section>
    </article>

    <aside class="debug-panel" aria-label="Failure injection controls">
      <h2>Deterministic controls</h2>
      <p class="copy">These controls inject failure states without calling external providers.</p>
      <div class="debug-grid">
        <button class="action secondary" id="inject-offline">Inject offline state</button>
        <button class="action secondary" id="inject-stale">Inject stale quote on placement</button>
        <button class="action secondary" id="inject-uncertain">Inject unknown placement result</button>
        <button class="action danger" id="expire-session">Expire session and purge state</button>
        <button class="action danger" id="deny-access">Deny order access and purge state</button>
        <button class="action secondary" id="reset-scenario">Reset scenario</button>
      </div>
      <dl class="contract" aria-label="Transaction contract state">
        <dt>screen</dt><dd id="debug-screen">product</dd>
        <dt>phase</dt><dd id="debug-phase">IDLE</dd>
        <dt>attempts</dt><dd id="debug-attempts">0</dd>
        <dt>cartId</dt><dd id="debug-cart">—</dd>
        <dt>addressId</dt><dd id="debug-address">—</dd>
        <dt>quoteId</dt><dd id="debug-quote">—</dd>
        <dt>orderId</dt><dd id="debug-order">—</dd>
        <dt>idempotency</dt><dd id="debug-key">—</dd>
      </dl>
    </aside>
  </main>

  <script>
    (() => {
      const CART_ID = '20000000-0000-4000-8000-000000000001';
      const ADDRESS_ID = '10000000-0000-4000-8000-000000000001';
      const ORDER_ID = '40000000-0000-4000-8000-000000000001';
      const IDEMPOTENCY_KEY = '50000000-0000-4000-8000-000000000001';
      const root = document.querySelector('[data-scenario-id="customer-cod-checkout"]');
      const screens = Array.from(document.querySelectorAll('[data-screen]'));
      const status = document.getElementById('scenario-status');
      const alert = document.getElementById('scenario-alert');
      const openCart = document.getElementById('open-cart');
      const continueQuote = document.getElementById('continue-quote');
      const confirmCod = document.getElementById('confirm-cod');
      const quantityOutput = document.getElementById('quantity-output');
      const debug = {
        screen: document.getElementById('debug-screen'),
        phase: document.getElementById('debug-phase'),
        attempts: document.getElementById('debug-attempts'),
        cart: document.getElementById('debug-cart'),
        address: document.getElementById('debug-address'),
        quote: document.getElementById('debug-quote'),
        order: document.getElementById('debug-order'),
        key: document.getElementById('debug-key'),
      };

      let currentScreen = 'product';
      let previousScreen = 'product';
      let quantity = 1;
      let quoteVersion = 0;
      let placementAttempts = 0;
      let submitting = false;
      let failureMode = 'none';
      let cartId = '';
      let addressId = '';
      let quoteId = '';
      let orderId = '';
      let idempotencyKey = '';
      let placementPhase = 'IDLE';

      const byId = (id) => document.getElementById(id);
      const money = (value) => '₹' + value.toLocaleString('en-IN');
      const subtotal = () => 1299 * quantity;
      const total = () => subtotal() + 39;

      const updateDebug = () => {
        root.dataset.screen = currentScreen;
        root.dataset.placementPhase = placementPhase;
        root.dataset.placementAttempts = String(placementAttempts);
        root.dataset.idempotencyKey = idempotencyKey;
        root.dataset.cartId = cartId;
        root.dataset.addressId = addressId;
        root.dataset.quoteId = quoteId;
        root.dataset.orderId = orderId;
        root.dataset.sensitiveState = cartId === '' && addressId === '' && quoteId === '' && orderId === '' ? 'empty' : 'populated';
        root.dataset.failureMode = failureMode;
        debug.screen.textContent = currentScreen;
        debug.phase.textContent = placementPhase;
        debug.attempts.textContent = String(placementAttempts);
        debug.cart.textContent = cartId || '—';
        debug.address.textContent = addressId || '—';
        debug.quote.textContent = quoteId || '—';
        debug.order.textContent = orderId || '—';
        debug.key.textContent = idempotencyKey || '—';
      };

      const announce = (message) => {
        status.textContent = message;
        updateDebug();
      };

      const warn = (message) => {
        alert.textContent = message;
        alert.hidden = false;
        updateDebug();
      };

      const clearWarning = () => {
        alert.hidden = true;
        alert.textContent = '';
      };

      const showScreen = (name) => {
        previousScreen = currentScreen;
        currentScreen = name;
        screens.forEach((screen) => {
          screen.hidden = screen.dataset.screen !== name;
        });
        clearWarning();
        const heading = document.querySelector('[data-screen="' + name + '"] h1, [data-screen="' + name + '"] h2');
        if (heading !== null) heading.focus();
        updateDebug();
      };

      const updateTotals = () => {
        const subtotalText = money(subtotal());
        const totalText = money(total());
        byId('cart-subtotal').textContent = subtotalText;
        byId('quote-items').textContent = subtotalText;
        byId('quote-total').textContent = totalText;
        byId('confirmation-total').textContent = totalText;
        byId('order-total').textContent = totalText;
        quantityOutput.textContent = String(quantity);
      };

      const invalidateQuote = (message) => {
        quoteId = '';
        orderId = '';
        placementPhase = 'IDLE';
        submitting = false;
        confirmCod.disabled = false;
        announce(message);
      };

      const loadQuote = () => {
        quoteVersion += 1;
        quoteId = '30000000-0000-4000-8000-' + String(quoteVersion).padStart(12, '0');
        if (idempotencyKey === '') idempotencyKey = IDEMPOTENCY_KEY;
        placementPhase = 'IDLE';
        showScreen('quote');
        announce('Authoritative checkout quote loaded.');
      };

      const completePlacement = () => {
        orderId = ORDER_ID;
        placementPhase = 'SUCCEEDED';
        submitting = false;
        confirmCod.disabled = false;
        failureMode = 'none';
        showScreen('order-confirmation');
        announce('Order confirmed from the authoritative order read.');
      };

      const placeOrder = () => {
        if (submitting || placementPhase === 'SUCCEEDED') return;
        submitting = true;
        placementAttempts += 1;
        placementPhase = placementAttempts === 1 ? 'SUBMITTING' : 'RECONCILING';
        confirmCod.disabled = true;
        announce(placementPhase === 'SUBMITTING' ? 'Placing COD order once.' : 'Reconciling with the original order key.');

        window.setTimeout(() => {
          if (failureMode === 'uncertain') {
            submitting = false;
            placementPhase = 'UNCERTAIN';
            confirmCod.disabled = false;
            failureMode = 'none';
            showScreen('uncertain');
            warn('The placement result is unknown. No failure is claimed.');
            announce('Unknown placement result retained for safe reconciliation.');
            return;
          }
          if (failureMode === 'stale') {
            submitting = false;
            placementPhase = 'FAILED';
            confirmCod.disabled = false;
            failureMode = 'none';
            quoteId = '';
            showScreen('stale');
            warn('The previous quote is no longer valid.');
            announce('Stale quote rejected before order creation.');
            return;
          }
          completePlacement();
        }, 40);
      };

      const purgeSensitiveState = () => {
        cartId = '';
        addressId = '';
        quoteId = '';
        orderId = '';
        idempotencyKey = '';
        placementAttempts = 0;
        placementPhase = 'IDLE';
        submitting = false;
        failureMode = 'none';
        confirmCod.disabled = false;
        continueQuote.disabled = true;
        openCart.disabled = true;
        byId('address-home').checked = false;
        updateDebug();
      };

      const reset = () => {
        purgeSensitiveState();
        quantity = 1;
        quoteVersion = 0;
        updateTotals();
        showScreen('product');
        announce('Product is ready.');
      };

      byId('add-to-cart').addEventListener('click', () => {
        cartId = CART_ID;
        openCart.disabled = false;
        announce('Available variant added to the one-shop cart.');
      });
      openCart.addEventListener('click', () => {
        showScreen('cart');
        announce('Authoritative cart opened.');
      });
      byId('back-product').addEventListener('click', () => {
        showScreen('product');
        announce('Returned to product detail.');
      });
      byId('increase-quantity').addEventListener('click', () => {
        quantity = Math.min(3, quantity + 1);
        updateTotals();
        invalidateQuote('Cart quantity changed and any previous quote was invalidated.');
      });
      byId('decrease-quantity').addEventListener('click', () => {
        quantity = Math.max(1, quantity - 1);
        updateTotals();
        invalidateQuote('Cart quantity changed and any previous quote was invalidated.');
      });
      byId('continue-address').addEventListener('click', () => {
        showScreen('address');
        announce('Saved addresses loaded.');
      });
      byId('back-cart').addEventListener('click', () => {
        showScreen('cart');
        announce('Returned to cart.');
      });
      byId('address-home').addEventListener('change', () => {
        addressId = ADDRESS_ID;
        quoteId = '';
        orderId = '';
        placementPhase = 'IDLE';
        continueQuote.disabled = false;
        announce('Serviceable delivery address selected.');
      });
      continueQuote.addEventListener('click', loadQuote);
      byId('review-cod').addEventListener('click', () => {
        showScreen('cod-confirmation');
        announce('COD confirmation is ready.');
      });
      byId('change-address').addEventListener('click', () => {
        quoteId = '';
        placementPhase = 'IDLE';
        showScreen('address');
        announce('Quote invalidated because the delivery address is changing.');
      });
      byId('return-cart').addEventListener('click', () => {
        quoteId = '';
        placementPhase = 'IDLE';
        showScreen('cart');
        announce('Quote invalidated because the cart is being edited.');
      });
      byId('back-quote').addEventListener('click', () => {
        showScreen('quote');
        announce('Returned to the current checkout quote.');
      });
      confirmCod.addEventListener('click', placeOrder);
      byId('retry-placement').addEventListener('click', placeOrder);
      byId('uncertain-back').addEventListener('click', () => {
        placementPhase = 'IDLE';
        showScreen('cod-confirmation');
        announce('Returned to confirmation with the original order key.');
      });
      byId('refresh-quote').addEventListener('click', loadQuote);
      byId('view-tracking').addEventListener('click', () => {
        showScreen('tracking');
        announce('Authoritative tracking timeline opened.');
      });
      byId('view-orders').addEventListener('click', () => {
        showScreen('orders');
        announce('My Orders opened.');
      });
      byId('tracking-orders').addEventListener('click', () => {
        showScreen('orders');
        announce('Returned to My Orders.');
      });
      byId('open-order-detail').addEventListener('click', () => {
        showScreen('tracking');
        announce('Owned order detail reopened.');
      });
      byId('continue-shopping').addEventListener('click', reset);
      byId('reveal-otp').addEventListener('click', () => {
        byId('delivery-otp').textContent = '482913';
        byId('reveal-otp').setAttribute('aria-expanded', 'true');
        announce('Delivery OTP revealed for the test fixture.');
      });
      byId('inject-offline').addEventListener('click', () => {
        previousScreen = currentScreen;
        showScreen('offline');
        warn('Network unavailable.');
        announce('Offline state injected.');
      });
      byId('retry-online').addEventListener('click', () => {
        const destination = previousScreen === 'offline' ? 'product' : previousScreen;
        showScreen(destination);
        announce('Connection restored and previous screen recovered.');
      });
      byId('inject-stale').addEventListener('click', () => {
        failureMode = 'stale';
        announce('Next placement will receive a stale-quote response.');
      });
      byId('inject-uncertain').addEventListener('click', () => {
        failureMode = 'uncertain';
        announce('Next placement will return an unknown transport result.');
      });
      byId('expire-session').addEventListener('click', () => {
        purgeSensitiveState();
        showScreen('session-expired');
        warn('Session expired. Checkout state was cleared.');
        announce('Session expiry returned to a safe authentication boundary.');
      });
      byId('deny-access').addEventListener('click', () => {
        purgeSensitiveState();
        showScreen('denied');
        warn('Authorization failed. Resource details were removed.');
        announce('Authorization failure returned to a safe root.');
      });
      byId('session-restart').addEventListener('click', reset);
      byId('denied-restart').addEventListener('click', reset);
      byId('reset-scenario').addEventListener('click', reset);

      updateTotals();
      updateDebug();
    })();
  </script>
</body>
</html>`;
}

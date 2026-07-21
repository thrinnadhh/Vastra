export const CUSTOMER_ACCESS_NAVIGATION_SCENARIO_ROUTE =
  '/scenarios/customer-access-navigation' as const;

export function renderCustomerAccessNavigationScenario(): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Customer access and navigation scenario</title>
  <style>
    :root { color-scheme: light; font-family: Arial, sans-serif; background: #f5f6f8; color: #241b16; }
    * { box-sizing: border-box; }
    [hidden] { display: none !important; }
    body { margin: 0; min-height: 100vh; background: #f5f6f8; }
    button, input { font: inherit; }
    button:focus-visible, input:focus-visible { outline: 3px solid #3157d5; outline-offset: 3px; }
    .stage { min-height: 100vh; display: grid; place-items: center; padding: 16px; }
    .phone { width: min(100%, 390px); min-height: 720px; overflow: hidden; border: 9px solid #172033; border-radius: 32px; background: #fff8f2; box-shadow: 0 18px 50px rgba(20, 31, 51, 0.18); }
    .screen { min-height: 700px; padding: 28px 20px; }
    .screen h2 { margin-top: 0; font-size: 26px; }
    .copy { color: #665a52; line-height: 1.5; }
    .actions { display: grid; gap: 10px; margin-top: 24px; }
    .action { min-height: 48px; border: 0; border-radius: 12px; padding: 10px 16px; background: #8e3b46; color: #fff; font-weight: 700; }
    .secondary { background: #eef1f6; color: #241b16; }
    .danger { background: #a12032; }
    label { display: grid; gap: 8px; margin-top: 20px; font-weight: 700; }
    input { min-height: 48px; width: 100%; border: 1px solid #b8aaa0; border-radius: 12px; padding: 10px 12px; background: #fff; color: #241b16; }
    .status { margin: 0; padding: 12px 16px; border-bottom: 1px solid #d9dee7; background: #fff; color: #394150; line-height: 1.4; }
    .tabs { display: grid; grid-template-columns: repeat(5, 1fr); gap: 4px; margin: 18px -12px 0; padding: 8px; border-top: 1px solid #d9dee7; background: #fff; }
    .tab { min-height: 48px; border: 0; border-radius: 10px; padding: 8px 3px; background: transparent; color: #475467; font-size: 12px; font-weight: 700; }
    .tab[aria-selected="true"] { background: #6c3aa8; color: #fff; }
    .panel { min-height: 360px; padding-top: 18px; }
    .panel-card { margin-top: 18px; padding: 18px; border: 1px solid #d9dee7; border-radius: 14px; background: #fff; }
    .notice { padding: 14px; border-radius: 12px; background: #fff0c2; color: #6a4b00; line-height: 1.45; }
    @media (prefers-reduced-motion: reduce) { * { transition: none !important; animation: none !important; } }
  </style>
</head>
<body>
  <main class="stage">
    <article class="phone" data-scenario-id="customer-access-navigation" data-authenticated="false" data-selected-tab="Home" data-pending-destination="">
      <p class="status" id="scenario-status" role="status" aria-live="polite">First launch is ready.</p>

      <section class="screen" data-screen="welcome">
        <h2 tabindex="-1">Welcome to Vastra</h2>
        <p class="copy">This deterministic scenario exercises access and navigation decisions without contacting authentication, location, or deep-link providers.</p>
        <div class="actions">
          <button class="action" id="continue-sign-in">Continue to sign in</button>
          <button class="action secondary" id="valid-order-link">Open valid order link</button>
          <button class="action secondary" id="invalid-link">Open invalid link</button>
          <button class="action secondary" id="wrong-role-link">Open merchant-only link</button>
          <button class="action secondary" id="unauthorized-link">Open unauthorized order link</button>
        </div>
      </section>

      <section class="screen" data-screen="phone" hidden>
        <h2 tabindex="-1">Phone sign in</h2>
        <p class="copy">Phone and OTP values remain inside this test-only access flow and never enter navigation state.</p>
        <label>Phone number<input id="phone-number" inputmode="tel" autocomplete="tel" value="9876543210"></label>
        <div class="actions">
          <button class="action" id="send-code">Send code</button>
          <button class="action secondary" data-reset>Back to welcome</button>
        </div>
      </section>

      <section class="screen" data-screen="otp" hidden>
        <h2 tabindex="-1">Verify code</h2>
        <label>One-time code<input id="otp-code" inputmode="numeric" autocomplete="one-time-code" value="123456"></label>
        <div class="actions">
          <button class="action" id="verify-code">Verify code</button>
          <button class="action secondary" data-reset>Cancel sign in</button>
        </div>
      </section>

      <section class="screen" data-screen="location" hidden>
        <h2 tabindex="-1">Location access</h2>
        <p class="copy">Vastra explains why location helps before a permission decision.</p>
        <div class="actions">
          <button class="action" id="allow-location">Allow location</button>
          <button class="action secondary" id="deny-location">Location permission denied</button>
        </div>
      </section>

      <section class="screen" data-screen="manual-location" hidden>
        <h2 tabindex="-1">Choose location manually</h2>
        <p class="copy">A denied permission has a usable fallback and does not fabricate a saved address.</p>
        <label>Manual location<input id="manual-location" value="Tirupati"></label>
        <button class="action" id="use-manual-location">Use Tirupati</button>
      </section>

      <section class="screen" data-screen="app" hidden>
        <h2 tabindex="-1">Customer application</h2>
        <div class="panel" id="panel-home" role="tabpanel" aria-labelledby="tab-home" tabindex="0">
          <h3>Home</h3>
          <p class="copy">Serviceability and commerce remain server-authoritative.</p>
          <div class="panel-card"><button class="action" id="open-checkout">Open checkout</button></div>
        </div>
        <div class="panel" id="panel-discover" role="tabpanel" aria-labelledby="tab-discover" tabindex="0" hidden>
          <h3>Discover</h3><p class="copy">Discovery remains owned by its later sprint.</p>
        </div>
        <div class="panel" id="panel-style" role="tabpanel" aria-labelledby="tab-style" tabindex="0" hidden>
          <h3>Style</h3><p class="copy">Private style data is not fabricated by this scenario.</p>
        </div>
        <div class="panel" id="panel-orders" role="tabpanel" aria-labelledby="tab-orders" tabindex="0" hidden>
          <h3>Orders</h3><p class="copy">Your orders remain server-authoritative.</p>
        </div>
        <div class="panel" id="panel-profile" role="tabpanel" aria-labelledby="tab-profile" tabindex="0" hidden>
          <h3>Profile</h3><p class="copy">Your profile identity remains server-owned.</p>
        </div>
        <button class="action danger" id="expire-session">Expire session</button>
        <nav class="tabs" aria-label="Customer tabs" role="tablist">
          <button class="tab" id="tab-home" role="tab" aria-controls="panel-home" aria-selected="true" data-tab="Home">Home</button>
          <button class="tab" id="tab-discover" role="tab" aria-controls="panel-discover" aria-selected="false" data-tab="Discover">Discover</button>
          <button class="tab" id="tab-style" role="tab" aria-controls="panel-style" aria-selected="false" data-tab="Style">Style</button>
          <button class="tab" id="tab-orders" role="tab" aria-controls="panel-orders" aria-selected="false" data-tab="Orders">Orders</button>
          <button class="tab" id="tab-profile" role="tab" aria-controls="panel-profile" aria-selected="false" data-tab="Profile">Profile</button>
        </nav>
      </section>

      <section class="screen" data-screen="checkout" hidden>
        <h2 tabindex="-1">Checkout</h2>
        <p class="copy">Checkout is contextual transaction navigation, not a sixth tab.</p>
        <button class="action" id="back-from-checkout">Back to Home</button>
      </section>

      <section class="screen" data-screen="recovery" hidden>
        <h2 tabindex="-1">Link unavailable</h2>
        <p class="notice" id="recovery-message">This link is not supported or is no longer valid.</p>
        <button class="action secondary" data-reset>Return safely</button>
      </section>

      <section class="screen" data-screen="denied" hidden>
        <h2 tabindex="-1" id="denied-title">Access denied</h2>
        <p class="notice" id="denied-message">This destination is unavailable for this account.</p>
        <button class="action secondary" data-reset>Return safely</button>
      </section>

      <section class="screen" data-screen="expired" hidden>
        <h2 tabindex="-1">Session expired</h2>
        <p class="notice">Your destination is retained in memory. Sign in again to continue.</p>
        <button class="action" id="sign-in-again">Sign in again</button>
      </section>
    </article>
  </main>

  <script>
    (() => {
      const root = document.querySelector('[data-scenario-id="customer-access-navigation"]');
      const screens = Array.from(document.querySelectorAll('[data-screen]'));
      const tabs = Array.from(document.querySelectorAll('[data-tab]'));
      const panels = Array.from(document.querySelectorAll('[role="tabpanel"]'));
      const status = document.getElementById('scenario-status');
      let authenticated = false;
      let selectedTab = 'Home';
      let pendingDestination = null;
      let requiresLocation = true;

      const updateContractState = () => {
        root.dataset.authenticated = String(authenticated);
        root.dataset.selectedTab = selectedTab;
        root.dataset.pendingDestination = pendingDestination === null ? '' : pendingDestination;
      };

      const announce = (message) => {
        status.textContent = message;
        updateContractState();
      };

      const showScreen = (name) => {
        screens.forEach((screen) => {
          screen.hidden = screen.dataset.screen !== name;
        });
        const heading = document.querySelector('[data-screen="' + name + '"] h2');
        if (heading !== null) {
          heading.focus();
        }
        updateContractState();
      };

      const selectTab = (name) => {
        selectedTab = name;
        tabs.forEach((tab) => {
          const selected = tab.dataset.tab === name;
          tab.setAttribute('aria-selected', String(selected));
          tab.tabIndex = selected ? 0 : -1;
        });
        panels.forEach((panel) => {
          panel.hidden = panel.id !== 'panel-' + name.toLowerCase();
        });
        updateContractState();
      };

      const enterApp = (destination) => {
        authenticated = true;
        showScreen('app');
        selectTab(destination);
      };

      const beginAuthentication = (destination, message) => {
        authenticated = false;
        pendingDestination = destination;
        showScreen('phone');
        announce(message);
      };

      const reset = () => {
        authenticated = false;
        selectedTab = 'Home';
        pendingDestination = null;
        requiresLocation = true;
        selectTab('Home');
        showScreen('welcome');
        announce('First launch is ready.');
      };

      document.getElementById('continue-sign-in').addEventListener('click', () => {
        beginAuthentication(null, 'Sign in started.');
      });
      document.getElementById('valid-order-link').addEventListener('click', () => {
        beginAuthentication('Orders', 'Authentication required. Orders destination retained.');
      });
      document.getElementById('invalid-link').addEventListener('click', () => {
        showScreen('recovery');
        announce('Invalid link rejected with a safe recovery path.');
      });
      document.getElementById('wrong-role-link').addEventListener('click', () => {
        document.getElementById('denied-title').textContent = 'Wrong application';
        document.getElementById('denied-message').textContent = 'This customer application cannot open a merchant destination.';
        showScreen('denied');
        announce('Wrong-role destination denied.');
      });
      document.getElementById('unauthorized-link').addEventListener('click', () => {
        document.getElementById('denied-title').textContent = 'Access denied';
        document.getElementById('denied-message').textContent = 'This destination is unavailable for this account.';
        showScreen('denied');
        announce('Resource authorization failed without exposing resource details.');
      });
      document.getElementById('send-code').addEventListener('click', () => {
        showScreen('otp');
        announce('One-time code requested.');
      });
      document.getElementById('verify-code').addEventListener('click', () => {
        authenticated = true;
        if (pendingDestination !== null) {
          const destination = pendingDestination;
          pendingDestination = null;
          enterApp(destination);
          announce('Signed in. Continued to ' + destination + '.');
          return;
        }
        if (requiresLocation) {
          showScreen('location');
          announce('Sign in complete. Location decision required.');
          return;
        }
        enterApp(selectedTab);
        announce('Session restored. Continued to ' + selectedTab + '.');
      });
      document.getElementById('allow-location').addEventListener('click', () => {
        requiresLocation = false;
        enterApp('Home');
        announce('Location granted. Home opened.');
      });
      document.getElementById('deny-location').addEventListener('click', () => {
        showScreen('manual-location');
        announce('Location denied. Manual fallback opened.');
      });
      document.getElementById('use-manual-location').addEventListener('click', () => {
        requiresLocation = false;
        enterApp('Home');
        announce('Manual Tirupati location accepted for this scenario.');
      });
      tabs.forEach((tab) => {
        tab.addEventListener('click', () => {
          selectTab(tab.dataset.tab);
          announce(tab.dataset.tab + ' tab selected.');
        });
      });
      document.getElementById('open-checkout').addEventListener('click', () => {
        showScreen('checkout');
        announce('Checkout opened contextually from Home.');
      });
      document.getElementById('back-from-checkout').addEventListener('click', () => {
        showScreen('app');
        selectTab(selectedTab);
        announce('Returned from Checkout to ' + selectedTab + '.');
      });
      document.getElementById('expire-session').addEventListener('click', () => {
        authenticated = false;
        pendingDestination = selectedTab;
        showScreen('expired');
        announce('Session expired. ' + selectedTab + ' destination retained.');
      });
      document.getElementById('sign-in-again').addEventListener('click', () => {
        beginAuthentication(selectedTab, 'Reauthentication required. ' + selectedTab + ' destination retained.');
      });
      document.querySelectorAll('[data-reset]').forEach((button) => {
        button.addEventListener('click', reset);
      });

      selectTab('Home');
      showScreen('welcome');
      updateContractState();
    })();
  </script>
</body>
</html>`;
}

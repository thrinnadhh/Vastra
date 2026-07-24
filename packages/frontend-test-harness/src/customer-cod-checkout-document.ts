import {
  CUSTOMER_COD_CHECKOUT_SCENARIO_ROUTE,
  renderCustomerCodCheckoutScenario as renderCustomerCodCheckoutTemplate,
} from './customer-cod-checkout-scenario';

export { CUSTOMER_COD_CHECKOUT_SCENARIO_ROUTE };

export function renderCustomerCodCheckoutScenario(): string {
  return renderCustomerCodCheckoutTemplate()
    .replace(
      'data-screen="product"\n      data-placement-phase',
      'data-current-screen="product"\n      data-placement-phase',
    )
    .replace(
      '<main class="stage" id="scenario-main">',
      '<main class="stage" id="scenario-main" tabindex="-1">',
    )
    .replace('root.dataset.screen = currentScreen;', 'root.dataset.currentScreen = currentScreen;');
}

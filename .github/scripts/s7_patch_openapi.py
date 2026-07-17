from pathlib import Path
import textwrap

path = Path('docs/api/openapi.yaml')
text = path.read_text()

if '    MerchantAlertDeliveryMetrics:' not in text:
    block = textwrap.dedent('''\
    MerchantAlertDeliveryMetrics:
      type: object
      required: [windowMinutes, generatedAt, alertsCreated, alertsSent, alertsAcknowledged, alertsExpired, alertsFailed, averageAcknowledgementSeconds, activeAlerts, remindersQueued, deliveryAttempts, successfulAttempts, failedAttempts, retryableFailures, unregisteredTokens, outboxBacklog]
      properties:
        windowMinutes: {type: integer, minimum: 5, maximum: 10080}
        generatedAt: {type: string, format: date-time}
        alertsCreated: {type: integer, minimum: 0}
        alertsSent: {type: integer, minimum: 0}
        alertsAcknowledged: {type: integer, minimum: 0}
        alertsExpired: {type: integer, minimum: 0}
        alertsFailed: {type: integer, minimum: 0}
        averageAcknowledgementSeconds: {type: integer, minimum: 0}
        activeAlerts: {type: integer, minimum: 0}
        remindersQueued: {type: integer, minimum: 0}
        deliveryAttempts: {type: integer, minimum: 0}
        successfulAttempts: {type: integer, minimum: 0}
        failedAttempts: {type: integer, minimum: 0}
        retryableFailures: {type: integer, minimum: 0}
        unregisteredTokens: {type: integer, minimum: 0}
        outboxBacklog: {type: integer, minimum: 0}
    MerchantAlertDeliveryActivity:
      type: object
      required: [alertId, orderId, orderNumber, shopId, shopName, alertStatus, attemptCount, reminderCount, createdAt, expiresAt, acknowledgedAt, expiredAt, failureReason, successfulDeviceAttempts, failedDeviceAttempts, retryableDeviceFailures, lastAttemptAt, lastFailureCode]
      properties:
        alertId: {type: string, format: uuid}
        orderId: {type: string, format: uuid}
        orderNumber: {type: string}
        shopId: {type: string, format: uuid}
        shopName: {type: string}
        alertStatus: {type: string, enum: [PENDING, SENT, DELIVERED, ACKNOWLEDGED, EXPIRED, FAILED]}
        attemptCount: {type: integer, minimum: 0}
        reminderCount: {type: integer, minimum: 0}
        createdAt: {type: string, format: date-time}
        expiresAt: {type: string, format: date-time}
        acknowledgedAt: {type: [string, 'null'], format: date-time}
        expiredAt: {type: [string, 'null'], format: date-time}
        failureReason: {type: [string, 'null']}
        successfulDeviceAttempts: {type: integer, minimum: 0}
        failedDeviceAttempts: {type: integer, minimum: 0}
        retryableDeviceFailures: {type: integer, minimum: 0}
        lastAttemptAt: {type: [string, 'null'], format: date-time}
        lastFailureCode: {type: [string, 'null']}
    MerchantAlertMetricsResponse:
      type: object
      required: [success, data, meta]
      properties:
        success: {type: boolean, const: true}
        data:
          type: object
          required: [metrics]
          properties:
            metrics: {$ref: '#/components/schemas/MerchantAlertDeliveryMetrics'}
        meta:
          type: object
          required: [requestId]
          properties:
            requestId: {type: ['null']}
    MerchantAlertActivityResponse:
      type: object
      required: [success, data, meta]
      properties:
        success: {type: boolean, const: true}
        data:
          type: object
          required: [activity, nextCursor]
          properties:
            activity:
              type: array
              items: {$ref: '#/components/schemas/MerchantAlertDeliveryActivity'}
            nextCursor: {type: [string, 'null'], format: date-time}
        meta:
          type: object
          required: [requestId]
          properties:
            requestId: {type: ['null']}
    ''')
    boundary = text.find('\nsecurity:\n')
    if boundary < 0:
        raise SystemExit('OpenAPI security boundary not found')
    text = text[: boundary + 1] + block + text[boundary + 1 :]

if '  /admin/merchant-alerts/metrics:' not in text:
    block = textwrap.dedent('''\
      /admin/merchant-alerts/metrics:
        get:
          operationId: getMerchantAlertDeliveryMetrics
          summary: Read bounded merchant alert delivery metrics
          description: Requires an ADMIN account with operations.manage permission and operational readiness.
          tags: [Admin]
          security: [{bearerAuth: []}]
          parameters:
          - name: windowMinutes
            in: query
            required: false
            schema: {type: integer, minimum: 5, maximum: 10080, default: 60}
          responses:
            '200':
              description: Merchant alert delivery metrics
              content:
                application/json:
                  schema: {$ref: '#/components/schemas/MerchantAlertMetricsResponse'}
            '400': {$ref: '#/components/responses/BadRequest'}
            '401': {$ref: '#/components/responses/Unauthorized'}
            '403': {$ref: '#/components/responses/Forbidden'}
            '503':
              description: Merchant alert observability is temporarily unavailable
              content:
                application/json:
                  schema: {$ref: '#/components/schemas/ApiError'}
      /admin/merchant-alerts/activity:
        get:
          operationId: listMerchantAlertDeliveryActivity
          summary: List recent merchant alert delivery activity
          description: Requires an ADMIN account with operations.manage permission and operational readiness.
          tags: [Admin]
          security: [{bearerAuth: []}]
          parameters:
          - name: limit
            in: query
            required: false
            schema: {type: integer, minimum: 1, maximum: 100, default: 50}
          - name: before
            in: query
            required: false
            schema: {type: string, format: date-time}
          responses:
            '200':
              description: Recent merchant alert delivery activity
              content:
                application/json:
                  schema: {$ref: '#/components/schemas/MerchantAlertActivityResponse'}
            '400': {$ref: '#/components/responses/BadRequest'}
            '401': {$ref: '#/components/responses/Unauthorized'}
            '403': {$ref: '#/components/responses/Forbidden'}
            '503':
              description: Merchant alert observability is temporarily unavailable
              content:
                application/json:
                  schema: {$ref: '#/components/schemas/ApiError'}
    ''')
    text = text.rstrip() + '\n' + block

required = [
    'MerchantAlertDeliveryMetrics:',
    '/admin/merchant-alerts/metrics:',
    '/admin/merchant-alerts/activity:',
]
missing = [value for value in required if value not in text]
if missing:
    raise SystemExit(f'OpenAPI integration incomplete: {missing!r}')
path.write_text(text)

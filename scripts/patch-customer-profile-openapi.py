from pathlib import Path

OPENAPI_PATH = Path('docs/api/openapi.yaml')
text = OPENAPI_PATH.read_text(encoding='utf-8')

if 'operationId: updateCurrentCustomerProfile' in text:
    raise SystemExit('Customer profile OpenAPI operation already exists')

schema_marker = '    RegisterDeviceRequest:\n'
schema_block = '''    UpdateCustomerProfileRequest:
      type: object
      additionalProperties: false
      required: [fullName]
      properties:
        fullName:
          type: string
          minLength: 2
          maxLength: 120
    RegisterDeviceRequest:
'''

if text.count(schema_marker) != 1:
    raise SystemExit('Expected one RegisterDeviceRequest schema marker')
text = text.replace(schema_marker, schema_block, 1)

path_marker = '  /me/devices:\n'
path_block = '''    patch:
      operationId: updateCurrentCustomerProfile
      summary: Update the authenticated customer's required profile data
      description: Atomically updates the customer display name and marks required profile setup complete. Phone, avatar, discovery preferences, and account deletion are separate capabilities.
      tags: [Customer]
      security: [{bearerAuth: []}]
      requestBody:
        required: true
        content:
          application/json:
            schema: {$ref: '#/components/schemas/UpdateCustomerProfileRequest'}
      responses:
        '200':
          description: Updated current customer account
          content:
            application/json:
              schema: {$ref: '#/components/schemas/GetCurrentAccountResponse'}
        '400': {$ref: '#/components/responses/BadRequest'}
        '401': {$ref: '#/components/responses/Unauthorized'}
        '403': {$ref: '#/components/responses/Forbidden'}
        '500':
          description: Account profile state is invalid
          content:
            application/json:
              schema: {$ref: '#/components/schemas/ApiError'}
        '503':
          description: Account information is temporarily unavailable
          content:
            application/json:
              schema: {$ref: '#/components/schemas/ApiError'}
  /me/devices:
'''

if text.count(path_marker) != 1:
    raise SystemExit('Expected one /me/devices path marker')
text = text.replace(path_marker, path_block, 1)

OPENAPI_PATH.write_text(text, encoding='utf-8')

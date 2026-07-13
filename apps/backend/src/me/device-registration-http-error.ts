import { HttpException, HttpStatus } from '@nestjs/common';

export type DeviceRegistrationErrorCode =
  | 'INVALID_DEVICE_REGISTRATION'
  | 'DEVICE_REGISTRATION_STATE_INVALID'
  | 'EXTERNAL_SERVICE_UNAVAILABLE';

interface DeviceRegistrationApiErrorBody {
  readonly success: false;
  readonly error: {
    readonly code: DeviceRegistrationErrorCode;
    readonly message: string;
    readonly details: null;
    readonly retryable: boolean;
  };
  readonly requestId: null;
}

function createDeviceRegistrationException(
  status: HttpStatus,
  code: DeviceRegistrationErrorCode,
  message: string,
  retryable: boolean,
): HttpException {
  const response: DeviceRegistrationApiErrorBody = {
    success: false,
    error: {
      code,
      message,
      details: null,
      retryable,
    },
    requestId: null,
  };

  return new HttpException(response, status);
}

export function createInvalidDeviceRegistrationException(): HttpException {
  return createDeviceRegistrationException(
    HttpStatus.BAD_REQUEST,
    'INVALID_DEVICE_REGISTRATION',
    'The device registration request is invalid.',
    false,
  );
}

export function createDeviceRegistrationStateInvalidException(): HttpException {
  return createDeviceRegistrationException(
    HttpStatus.INTERNAL_SERVER_ERROR,
    'DEVICE_REGISTRATION_STATE_INVALID',
    'The registered device is not in a valid state.',
    false,
  );
}

export function createDeviceRegistrationProviderUnavailableException(): HttpException {
  return createDeviceRegistrationException(
    HttpStatus.SERVICE_UNAVAILABLE,
    'EXTERNAL_SERVICE_UNAVAILABLE',
    'Device registration is temporarily unavailable.',
    true,
  );
}

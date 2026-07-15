import {
  createLookCartInsufficientStockException,
  createLookCartShopConflictException,
  createLookItemInvalidException,
  createLookNotFoundException,
  createLookSourceUnavailableException,
  createWardrobeAccessDeniedException,
  createWardrobeIdempotencyConflictException,
  createWardrobeIdempotencyKeyRequiredException,
  createWardrobeItemInUseException,
  createWardrobeItemNotFoundException,
  createWardrobeMediaInvalidException,
  createWardrobeProviderUnavailableException,
  createWardrobeStateInvalidException,
  createWardrobeValidationException,
} from './wardrobe-http-error';
import { WardrobeDataInvalidError } from './wardrobe-item.parser';
import { WardrobeGatewayError, WardrobeStorageError } from './wardrobe.gateway';
import {
  WardrobeIdempotencyKeyRequiredError,
  WardrobeValidationError,
} from './wardrobe-item.validation';

export function rethrowWardrobeError(error: unknown): never {
  if (error instanceof WardrobeIdempotencyKeyRequiredError) {
    throw createWardrobeIdempotencyKeyRequiredException();
  }

  if (error instanceof WardrobeValidationError) {
    throw createWardrobeValidationException();
  }

  if (error instanceof WardrobeDataInvalidError) {
    throw createWardrobeStateInvalidException();
  }

  if (error instanceof WardrobeStorageError) {
    throw createWardrobeProviderUnavailableException();
  }

  if (error instanceof WardrobeGatewayError) {
    switch (error.databaseCode) {
      case '22023':
        throw createWardrobeValidationException();
      case '42501':
        throw createWardrobeAccessDeniedException();
      case 'P0010':
        throw createWardrobeIdempotencyConflictException();
      case 'P0020':
        throw createWardrobeItemNotFoundException();
      case 'P0021':
        throw createWardrobeMediaInvalidException();
      case 'P0022':
        throw createWardrobeItemInUseException();
      case 'P0030':
        throw createLookNotFoundException();
      case 'P0031':
        throw createLookItemInvalidException();
      case 'P0032':
      case 'P0005':
        throw createLookSourceUnavailableException();
      case 'P0003':
        throw createLookCartShopConflictException();
      case 'P0004':
        throw createLookCartInsufficientStockException();
      case '55000':
        throw createWardrobeStateInvalidException();
      case null:
      default:
        throw createWardrobeProviderUnavailableException();
    }
  }

  throw error;
}

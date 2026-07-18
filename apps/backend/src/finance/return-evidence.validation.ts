import {
  RETURN_EVIDENCE_MIME_TYPES,
  RETURN_EVIDENCE_UPLOAD_TYPES,
  type AssignReturnPickupInput,
  type CreateReturnEvidenceUploadInput,
  type FinalizeReturnEvidenceInput,
  type ReturnEvidenceMimeType,
  type ReturnEvidenceUploadType,
} from './return-evidence.types';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const MAXIMUM_EVIDENCE_BYTES = 15 * 1024 * 1024;

export class ReturnEvidenceValidationError extends Error {}
export class ReturnPickupIdempotencyKeyRequiredError extends Error {}

function requireRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new ReturnEvidenceValidationError();
  }
  return value as Record<string, unknown>;
}

export function requireReturnLogisticsUuid(value: unknown): string {
  if (typeof value !== 'string') throw new ReturnEvidenceValidationError();
  const normalized = value.trim().toLowerCase();
  if (!UUID_PATTERN.test(normalized)) throw new ReturnEvidenceValidationError();
  return normalized;
}

function optionalString(value: unknown, maximum: number): string | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') throw new ReturnEvidenceValidationError();
  const normalized = value.trim();
  if (normalized.length === 0 || normalized.length > maximum) {
    throw new ReturnEvidenceValidationError();
  }
  return normalized;
}

export function parseCreateReturnEvidenceUploadInput(
  body: unknown,
): CreateReturnEvidenceUploadInput {
  const record = requireRecord(body);
  const evidenceType = record['evidenceType'];
  const mimeType = record['mimeType'];
  const sizeBytes = record['sizeBytes'];
  if (
    typeof evidenceType !== 'string' ||
    !RETURN_EVIDENCE_UPLOAD_TYPES.includes(evidenceType as ReturnEvidenceUploadType) ||
    typeof mimeType !== 'string' ||
    !RETURN_EVIDENCE_MIME_TYPES.includes(mimeType as ReturnEvidenceMimeType) ||
    typeof sizeBytes !== 'number' ||
    !Number.isSafeInteger(sizeBytes) ||
    sizeBytes < 1 ||
    sizeBytes > MAXIMUM_EVIDENCE_BYTES
  ) {
    throw new ReturnEvidenceValidationError();
  }
  const validShape =
    (evidenceType === 'CUSTOMER_PHOTO' && mimeType.startsWith('image/')) ||
    (evidenceType === 'VIDEO' && mimeType === 'video/mp4') ||
    (evidenceType === 'DOCUMENT' && mimeType === 'application/pdf');
  if (!validShape) throw new ReturnEvidenceValidationError();
  return {
    evidenceType: evidenceType as ReturnEvidenceUploadType,
    mimeType: mimeType as ReturnEvidenceMimeType,
    sizeBytes,
  };
}

export function parseFinalizeReturnEvidenceInput(body: unknown): FinalizeReturnEvidenceInput {
  const record = requireRecord(body);
  const objectKey = record['objectKey'];
  if (
    typeof objectKey !== 'string' ||
    objectKey.length < 20 ||
    objectKey.length > 500 ||
    objectKey.includes('..') ||
    objectKey.endsWith('/')
  ) {
    throw new ReturnEvidenceValidationError();
  }
  return {
    objectKey,
    description: optionalString(record['description'], 1000),
  };
}

export function parseAssignReturnPickupInput(
  body: unknown,
  idempotencyKey: unknown,
): AssignReturnPickupInput {
  const record = requireRecord(body);
  if (idempotencyKey === undefined || idempotencyKey === null || idempotencyKey === '') {
    throw new ReturnPickupIdempotencyKeyRequiredError();
  }
  if (record['reasonCode'] !== 'RETURN_LOGISTICS') {
    throw new ReturnEvidenceValidationError();
  }
  const scheduledAt = optionalString(record['scheduledAt'], 64);
  if (scheduledAt !== null && Number.isNaN(Date.parse(scheduledAt))) {
    throw new ReturnEvidenceValidationError();
  }
  return {
    scheduledAt,
    reasonCode: 'RETURN_LOGISTICS',
    note: optionalString(record['note'], 1000),
    idempotencyKey: requireReturnLogisticsUuid(idempotencyKey),
  };
}

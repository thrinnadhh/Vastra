export const RETURN_EVIDENCE_UPLOAD_TYPES = ['CUSTOMER_PHOTO', 'VIDEO', 'DOCUMENT'] as const;

export type ReturnEvidenceUploadType = (typeof RETURN_EVIDENCE_UPLOAD_TYPES)[number];

export const RETURN_EVIDENCE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'video/mp4',
  'application/pdf',
] as const;

export type ReturnEvidenceMimeType = (typeof RETURN_EVIDENCE_MIME_TYPES)[number];

export interface CreateReturnEvidenceUploadInput {
  readonly evidenceType: ReturnEvidenceUploadType;
  readonly mimeType: ReturnEvidenceMimeType;
  readonly sizeBytes: number;
}

export interface ReturnEvidenceUploadIntent {
  readonly intentId: string;
  readonly returnId: string;
  readonly objectKey: string;
  readonly evidenceType: ReturnEvidenceUploadType;
  readonly mimeType: ReturnEvidenceMimeType;
  readonly sizeBytes: number;
  readonly expiresAt: string;
}

export interface ReturnEvidenceUploadAuthorization extends ReturnEvidenceUploadIntent {
  readonly signedUploadUrl: string;
}

export interface FinalizeReturnEvidenceInput {
  readonly objectKey: string;
  readonly description: string | null;
}

export interface ReturnEvidenceRecord {
  readonly evidenceId: string;
  readonly returnId: string;
  readonly evidenceType: ReturnEvidenceUploadType;
  readonly objectKey: string;
  readonly mimeType: ReturnEvidenceMimeType;
  readonly sizeBytes: number;
  readonly description: string | null;
  readonly createdAt: string;
}

export interface ReturnEvidenceReadAuthorization {
  readonly evidenceId: string;
  readonly objectKey: string;
  readonly signedReadUrl: string;
  readonly expiresInSeconds: number;
}

export interface AssignReturnPickupInput {
  readonly scheduledAt: string | null;
  readonly reasonCode: string;
  readonly note: string | null;
  readonly idempotencyKey: string;
}

export type ReturnPickupResult = Readonly<Record<string, unknown>>;

export interface ReturnLogisticsResponse<T> {
  readonly success: true;
  readonly data: T;
  readonly meta: { readonly requestId: null };
}

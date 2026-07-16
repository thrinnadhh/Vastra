import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  type LoggerService,
} from '@nestjs/common';

import { attachRequestIdToPayload, type RequestWithId, resolveRequestId } from './request-id';

interface HttpResponse {
  status(statusCode: number): HttpResponse;
  json(payload: unknown): void;
}

interface InternalErrorResponse {
  readonly success: false;
  readonly error: {
    readonly code: 'INTERNAL_ERROR';
    readonly message: 'An unexpected error occurred.';
    readonly details: null;
    readonly retryable: false;
  };
  readonly requestId: string;
}

function createInternalErrorResponse(requestId: string): InternalErrorResponse {
  return {
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred.',
      details: null,
      retryable: false,
    },
    requestId,
  };
}

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  public constructor(private readonly logger: LoggerService) {}

  public catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const request = context.getRequest<RequestWithId>();
    const response = context.getResponse<HttpResponse>();
    const requestId = request.requestId ?? resolveRequestId(request.headers);
    const statusCode =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    if (statusCode >= 500) {
      this.logger.error({
        event: 'http.request.failed',
        requestId,
        statusCode,
        errorName: exception instanceof Error ? exception.name : 'UnknownError',
        errorMessage: exception instanceof Error ? exception.message : 'Unknown error',
      });
    }

    if (!(exception instanceof HttpException)) {
      response.status(statusCode).json(createInternalErrorResponse(requestId));
      return;
    }

    const exceptionResponse = exception.getResponse();
    const payload =
      typeof exceptionResponse === 'string'
        ? {
            success: false,
            error: {
              code: 'HTTP_ERROR',
              message: exceptionResponse,
              details: null,
              retryable: false,
            },
            requestId,
          }
        : attachRequestIdToPayload(exceptionResponse, requestId);

    response.status(statusCode).json(payload);
  }
}

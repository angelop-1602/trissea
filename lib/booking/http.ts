import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { BookingError } from '@/lib/booking/errors';
import type { ApiError, ApiSuccess, BookingApiCode, RequestId } from '@/lib/booking/types';
import { logError } from '@/lib/observability/log';

type CodedError = {
  message: string;
  code: string;
  status: number;
};

function asCodedError(error: unknown): CodedError | null {
  if (!error || typeof error !== 'object') {
    return null;
  }

  const candidate = error as Partial<CodedError>;
  if (
    typeof candidate.message === 'string' &&
    typeof candidate.code === 'string' &&
    typeof candidate.status === 'number'
  ) {
    return {
      message: candidate.message,
      code: candidate.code,
      status: candidate.status,
    };
  }

  return null;
}

export function getRequestIdFromHeaders(headers: Headers): RequestId {
  const headerValue = headers.get('x-request-id')?.trim();
  return headerValue && headerValue.length > 0 ? headerValue : randomUUID();
}

export function bookingSuccess<T>(
  requestId: RequestId,
  data: T,
  options?: {
    status?: number;
    meta?: Record<string, unknown>;
    headers?: Record<string, string>;
  }
) {
  return NextResponse.json<ApiSuccess<T>>(
    {
      data,
      ...(options?.meta ? { meta: options.meta } : {}),
    },
    {
      status: options?.status ?? 200,
      headers: {
        'x-request-id': requestId,
        ...(options?.headers ?? {}),
      },
    }
  );
}

export function bookingError(
  requestId: RequestId,
  message: string,
  status: number,
  code: BookingApiCode | string,
  headers?: Record<string, string>
) {
  return NextResponse.json<ApiError>(
    {
      error: message,
      code,
      requestId,
    },
    {
      status,
      headers: {
        'x-request-id': requestId,
        ...(headers ?? {}),
      },
    }
  );
}

export function rateLimitedResponse(requestId: RequestId, retryAfterSeconds: number) {
  return bookingError(
    requestId,
    'Too many requests. Please retry later.',
    429,
    'RATE_LIMITED',
    {
      'Retry-After': String(retryAfterSeconds),
    }
  );
}

export function bookingErrorResponse(error: unknown, requestId: RequestId) {
  if (error instanceof Response) {
    return error;
  }

  if (error instanceof BookingError) {
    return bookingError(requestId, error.message, error.status, error.code);
  }

  const codedError = asCodedError(error);
  if (codedError) {
    return bookingError(requestId, codedError.message, codedError.status, codedError.code);
  }

  const message = error instanceof Error ? error.message : 'Unexpected server error.';
  logError('booking.unexpected_error', {
    requestId,
    code: 'INTERNAL_ERROR',
    error: message,
  });
  return bookingError(requestId, message, 500, 'INTERNAL_ERROR');
}

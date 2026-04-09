import { NextResponse } from 'next/server';

export type AccessErrorCode = 'unauthorized' | 'forbidden' | 'not_found' | 'invalid_scope';

const statusByCode: Record<AccessErrorCode, number> = {
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  invalid_scope: 400,
};

const defaultMessageByCode: Record<AccessErrorCode, string> = {
  unauthorized: 'Unauthorized',
  forbidden: 'Forbidden',
  not_found: 'Not found',
  invalid_scope: 'Invalid scope',
};

export class AccessError extends Error {
  code: AccessErrorCode;
  status: number;

  constructor(code: AccessErrorCode, message?: string) {
    super(message ?? defaultMessageByCode[code]);
    this.name = 'AccessError';
    this.code = code;
    this.status = statusByCode[code];
  }
}

export function accessError(code: AccessErrorCode, message?: string): AccessError {
  return new AccessError(code, message);
}

export function isAccessError(error: unknown): error is AccessError {
  return error instanceof AccessError;
}

export function toAccessErrorResponse(error: AccessError) {
  return NextResponse.json(
    {
      error: error.message,
      code: error.code,
    },
    { status: error.status }
  );
}

import test from 'node:test';
import assert from 'node:assert/strict';
import { bookingError, bookingSuccess, rateLimitedResponse } from '@/lib/booking/http';

test('bookingSuccess returns data envelope and x-request-id header', async () => {
  const response = bookingSuccess('req-123', { ok: true }, { status: 201 });
  const payload = (await response.json()) as { data: { ok: boolean } };

  assert.equal(response.status, 201);
  assert.equal(response.headers.get('x-request-id'), 'req-123');
  assert.deepEqual(payload, { data: { ok: true } });
});

test('bookingError returns API contract with code and requestId', async () => {
  const response = bookingError('req-456', 'Nope', 400, 'INVALID_REQUEST');
  const payload = (await response.json()) as { error: string; code: string; requestId: string };

  assert.equal(response.status, 400);
  assert.deepEqual(payload, {
    error: 'Nope',
    code: 'INVALID_REQUEST',
    requestId: 'req-456',
  });
});

test('rateLimitedResponse sets retry-after header', async () => {
  const response = rateLimitedResponse('req-789', 12);
  const payload = (await response.json()) as { code: string; requestId: string };

  assert.equal(response.status, 429);
  assert.equal(response.headers.get('Retry-After'), '12');
  assert.equal(payload.code, 'RATE_LIMITED');
  assert.equal(payload.requestId, 'req-789');
});

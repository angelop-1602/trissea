import test from 'node:test';
import assert from 'node:assert/strict';
import { compactQueuePositionsAfterRemoval } from '@/lib/booking/queue';

test('queue positions compact after removal', () => {
  const result = compactQueuePositionsAfterRemoval([1, 3, 4], 2);
  assert.deepEqual(result, [1, 2, 3]);
});

test('positions before removed index stay unchanged', () => {
  const result = compactQueuePositionsAfterRemoval([1, 2, 3], 3);
  assert.deepEqual(result, [1, 2, 3]);
});

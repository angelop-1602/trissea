import test from 'node:test';
import assert from 'node:assert/strict';
import { rideFeedbackSchema } from '@/lib/booking/schemas';

test('rideFeedbackSchema accepts star ratings with optional note', () => {
  const parsed = rideFeedbackSchema.parse({
    rating: 5,
    note: 'Very courteous and careful driving.',
  });

  assert.equal(parsed.rating, 5);
  assert.equal(parsed.note, 'Very courteous and careful driving.');
});

test('rideFeedbackSchema rejects ratings outside the 1 to 5 range', () => {
  assert.equal(rideFeedbackSchema.safeParse({ rating: 0 }).success, false);
  assert.equal(rideFeedbackSchema.safeParse({ rating: 6 }).success, false);
});

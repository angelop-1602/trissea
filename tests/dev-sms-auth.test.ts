import assert from 'node:assert/strict';
import test from 'node:test';
import { getDevSmsAuthPhone, getDevSmsAuthPhones } from '@/lib/dev-sms-auth';

test('getDevSmsAuthPhone returns the first configured dev phone from a list', () => {
  const originalPhones = process.env.DEV_SMS_AUTH_PHONES;

  try {
    process.env.DEV_SMS_AUTH_PHONES = '+639111111111,+639222222222';

    assert.deepEqual(getDevSmsAuthPhones(), ['+639111111111', '+639222222222']);
    assert.equal(getDevSmsAuthPhone(), '+639111111111');
  } finally {
    if (originalPhones === undefined) {
      delete process.env.DEV_SMS_AUTH_PHONES;
    } else {
      process.env.DEV_SMS_AUTH_PHONES = originalPhones;
    }
  }
});

import { expect, test } from '@playwright/test';

test('passenger OTP login redirects to passenger home', async ({ page }) => {
  let authenticated = false;

  await page.route('**/api/me', async (route) => {
    if (!authenticated) {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Unauthorized.' }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        user: {
          id: 'user-passenger-1',
          name: 'Passenger User',
          phone: '+639171234567',
          role: 'passenger',
          balance: 120,
          rating: 4.8,
          completedRides: 12,
        },
        tenant: null,
      }),
    });
  });

  await page.route('**/api/auth/sms/send', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: { ok: true } }),
    });
  });

  await page.route('**/api/auth/sms/verify', async (route) => {
    authenticated = true;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          session: {
            access_token: 'fake-access-token',
            token_type: 'bearer',
            expires_at: Math.floor(Date.now() / 1000) + 3600,
          },
          profile: {
            id: 'user-passenger-1',
            role: 'passenger',
          },
        },
      }),
    });
  });

  await page.route('**/api/dashboard/passenger/home', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          profile: {
            id: 'user-passenger-1',
            name: 'Passenger User',
            balance: 120,
            rating: 4.8,
            completedRides: 12,
          },
          recentRides: [],
          activeReservations: [],
        },
      }),
    });
  });

  await page.route('**/api/realtime/stream', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'text/event-stream',
      body: ': connected\n\n',
    });
  });

  await page.goto('/login');

  await page.getByLabel('Phone number').fill('+639171234567');
  await page.getByRole('button', { name: 'Send OTP' }).click();

  await expect(page.getByLabel('One-time password')).toBeVisible();

  await page.getByLabel('One-time password').fill('123456');
  await page.getByRole('button', { name: 'Verify and Continue' }).click();

  await expect(page).toHaveURL(/\/passenger\/home/);
  await expect(page.getByText('Welcome back, Passenger User')).toBeVisible();
});

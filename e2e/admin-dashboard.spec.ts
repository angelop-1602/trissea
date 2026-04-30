import { expect, test } from '@playwright/test';

test('admin dashboard loads with tenant context', async ({ page }) => {
  await page.route('**/api/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        user: {
          id: 'admin-user-1',
          name: 'Admin User',
          phone: '+63900111222',
          role: 'admin',
          tenantId: 'tenant-1',
        },
        tenant: {
          id: 'tenant-1',
          name: 'Metro TODA',
          logo: null,
          primaryColor: '#14622e',
          accentColor: '#fecc04',
        },
      }),
    });
  });

  await page.route('**/api/dashboard/admin/overview', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          terminals: [],
          rides: [],
          activeRides: [],
          drivers: [],
          stats: {
            totalTerminals: 0,
            activeDrivers: 0,
            todayRides: 0,
            totalRevenue: 0,
          },
        },
      }),
    });
  });

  await page.goto('/admin/dashboard');

  await expect(page.getByText('Welcome to Admin Dashboard')).toBeVisible();
  await expect(page.getByText('Manage your Metro TODA operations')).toBeVisible();
});

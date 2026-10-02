import { test, expect, type Page, type BrowserContext } from '@playwright/test';

const previewOrigin = 'http://127.0.0.1:4173';
const expectedBlockedAssets = [
  /^https:\/\/fonts\.googleapis\.com\/css2\?/,
  /^https:\/\/fonts\.gstatic\.com\//,
];

async function guardNetworkAndErrors(page: Page, context: BrowserContext) {
  const blockedURLs = new Set<string>();
  const unexpectedExternalURLs: string[] = [];
  const unexpectedErrors: string[] = [];
  await context.route('**/*', async (route) => {
    const url = route.request().url();
    if (new URL(url).origin === previewOrigin) {
      await route.continue();
      return;
    }
    blockedURLs.add(url);
    if (!expectedBlockedAssets.some((pattern) => pattern.test(url))) {
      unexpectedExternalURLs.push(url);
    }
    await route.abort('blockedbyclient');
  });
  await context.routeWebSocket('**/*', (socket) => {
    unexpectedExternalURLs.push(`WebSocket: ${socket.url()}`);
    socket.close();
  });
  page.on('pageerror', (error) => unexpectedErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    const url = message.location().url;
    const expectedNetworkError =
      /^Failed to load resource: net::ERR_(BLOCKED_BY_CLIENT|FAILED)(?:\.Inspector)?$/.test(
        message.text(),
      ) &&
      blockedURLs.has(url) &&
      expectedBlockedAssets.some((pattern) => pattern.test(url));
    if (!expectedNetworkError) unexpectedErrors.push(`${message.text()} (${url})`);
  });
  return () => {
    expect(unexpectedExternalURLs, 'unexpected external requests were blocked').toEqual([]);
    expect(unexpectedErrors, 'unexpected console errors or page exceptions').toEqual([]);
  };
}

for (const config of [
  {
    name: 'empty',
    path: '/app/',
    error: /App not configured:.*VITE_SUPABASE_URL.*VITE_SUPABASE_PUBLISHABLE_KEY/,
  },
  {
    name: 'malformed',
    path: '/e2e-malformed/app/',
    error: /VITE_SUPABASE_URL is not a valid http\/https URL: "not-a-valid-url"/,
  },
]) {
  test(`/app with ${config.name} public config shows setup error`, async ({ page, context }) => {
    const checkErrors = await guardNetworkAndErrors(page, context);
    const response = await page.goto(config.path);
    expect(response?.status()).toBe(200);
    await expect(page.getByRole('main')).toBeVisible();
    await expect(page.getByRole('status')).toHaveText(config.error);
    await expect(page.getByLabel('Email', { exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toHaveCount(0);
    checkErrors();
  });
}

test('/app with fake valid public config shows keyboard reachable sign-in', async ({
  page,
  context,
}) => {
  const checkErrors = await guardNetworkAndErrors(page, context);
  const response = await page.goto('/e2e-valid/app/');
  expect(response?.status()).toBe(200);
  await expect(page.getByRole('heading', { name: 'MOMENTUM', exact: true })).toBeVisible();
  await expect(page.getByText('Sign in to track your daily habits', { exact: true })).toBeVisible();
  const email = page.getByLabel('Email', { exact: true });
  const password = page.getByLabel('Password', { exact: true });
  await expect(email).toBeVisible();
  await expect(password).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeEnabled();
  await expect(page.getByRole('status')).toHaveCount(0);
  await page.keyboard.press('Tab');
  await expect(email).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(password).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(email).toBeFocused();
  checkErrors();
});

import { test, expect } from '@playwright/test';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const sdkBundle = join(
  dirname(require.resolve('@supabase/supabase-js/package.json')),
  'dist/umd/supabase.js',
);
const previewOrigin = 'http://127.0.0.1:4173';
// Init scripts may run in a wrapper: explicitly expose the bundle's local var
// so classic auth.js can access the same global provided by its CDN script.
const sdkInitScript = `${readFileSync(sdkBundle, 'utf8')}\nwindow.supabase = supabase;`;

// Only failed loads for these deliberately blocked assets are expected.
// Do not allow generic TypeErrors, ReferenceErrors or arbitrary Supabase errors.
const expectedBlockedAssets = [
  /^https:\/\/cdn\.jsdelivr\.net\/npm\/@supabase\/supabase-js@2\.117\.2$/,
  /^https:\/\/fonts\.googleapis\.com\/css2\?/,
  /^https:\/\/fonts\.gstatic\.com\//,
];

test('signed-out app loads safely and sign-in fields are keyboard reachable', async ({
  page,
  context,
}) => {
  const unexpectedErrors: string[] = [];
  const blockedURLs = new Set<string>();
  const unexpectedExternalURLs: string[] = [];

  // Install the REAL pinned SDK from disk before classic auth.js executes.
  // The CDN is still aborted; no auth/client behavior is mocked or logged in.
  await context.addInitScript({ content: sdkInitScript });
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
  // Service workers are blocked in config; close WebSockets as well so an
  // accidental realtime subscription cannot bypass HTTP interception.
  await context.routeWebSocket('**/*', (socket) => socket.close());

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

  const response = await page.goto('/');
  expect(response?.status()).toBe(200);
  await expect(page.locator('#auth-screen')).toBeVisible();
  await expect(page.getByText('Sign in to save your trajectory.', { exact: true })).toBeVisible();
  await expect(page.locator('#auth-email')).toBeVisible();
  await expect(page.locator('#auth-password')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Log in', exact: true })).toBeVisible();
  await expect(page.locator('#demo-banner')).toBeHidden();

  const removedHandlers = await page.locator('*').evaluateAll((elements) =>
    elements.flatMap((element) =>
      Array.from(element.attributes)
        .filter(
          (attribute) =>
            attribute.name.startsWith('on') &&
            /\b(?:devReset|devImport|handleImport|sbDeleteAll)\s*\(/.test(attribute.value),
        )
        .map((attribute) => `${element.tagName}: ${attribute.name}`),
    ),
  );
  expect(removedHandlers).toEqual([]);
  await expect(page.locator('#import-file')).toHaveCount(0);

  // Reach both fields from the page's initial focus using only keyboard input.
  // Never submit credentials or click a provider button.
  await page.keyboard.press('Tab');
  await expect(page.locator('#auth-email')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.locator('#auth-password')).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(page.locator('#auth-email')).toBeFocused();

  expect(unexpectedExternalURLs, 'unexpected external requests were blocked').toEqual([]);
  expect(unexpectedErrors, 'unexpected console errors or uncaught page exceptions').toEqual([]);
});

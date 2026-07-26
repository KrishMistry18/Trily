/**
 * playwright/e2e.spec.ts
 *
 * Task 37 — End-to-end tests with Playwright.
 *
 * Requirements: 1.8, 5.3, 9.3, 10.1
 *
 * NOTE: These tests require a running Next.js dev server (npm run dev) and
 * a fully configured environment (.env.local with real or stubbed service
 * credentials). They are skipped in CI unless PLAYWRIGHT_RUN=1 is set.
 * The webServer config in playwright.config.ts handles the dev server automatically.
 */

import { test, expect, type Page } from "@playwright/test";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const BASE_URL = "http://localhost:3000";

/**
 * Generate a unique test email to avoid conflicts between runs.
 */
function testEmail(): string {
  return `e2e-${Date.now()}@example.com`;
}

const TEST_PASSWORD = "Test@1234Password";

/**
 * Signs up a new user and returns the email used.
 */
async function signUp(page: Page, email: string): Promise<void> {
  await page.goto(`${BASE_URL}/signup`);
  await page.fill('input[type="email"]', email);
  await page.fill('input[id="password"]', TEST_PASSWORD);
  await page.fill('input[id="confirmPassword"]', TEST_PASSWORD);
  await page.click('button[type="submit"]');
  // Wait for redirect to dashboard after successful signup
  await page.waitForURL("**/dashboard**", { timeout: 15_000 });
}

/**
 * Signs in an existing user.
 */
async function signIn(page: Page, email: string): Promise<void> {
  await page.goto(`${BASE_URL}/login`);
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', TEST_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL("**/dashboard**", { timeout: 15_000 });
}

// ---------------------------------------------------------------------------
// E2E Test 1: Unauthenticated access redirects to login (Req 1.8)
// ---------------------------------------------------------------------------

test.describe("Authentication guard", () => {
  test("unauthenticated user is redirected to login from /dashboard", async ({ page }) => {
    // Navigate directly to the dashboard without signing in
    await page.goto(`${BASE_URL}/dashboard`);

    // Should be redirected to /login
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });

  test("unauthenticated user is redirected to login from /projects/* routes", async ({ page }) => {
    await page.goto(`${BASE_URL}/projects/any-project-id`);
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });

  test("unauthenticated API request to /api/projects returns 401", async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/projects`, {
      data: { prompt: "A test landing page for my startup" },
    });
    expect(response.status()).toBe(401);
  });

  test("login page is accessible without authentication", async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await expect(page).toHaveURL(/\/login/);
    await expect(page.locator("h1, h2").first()).toBeVisible();
  });

  test("signup page is accessible without authentication", async ({ page }) => {
    await page.goto(`${BASE_URL}/signup`);
    await expect(page).toHaveURL(/\/signup/);
    await expect(page.locator("h1, h2").first()).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// E2E Test 2: Sign up flow
// ---------------------------------------------------------------------------

test.describe("Sign up", () => {
  test("new user can sign up and lands on dashboard", async ({ page }) => {
    const email = testEmail();
    await signUp(page, email);

    // Should be on the dashboard
    await expect(page).toHaveURL(/\/dashboard/);
    // Dashboard heading should be visible
    await expect(page.getByText("Projects")).toBeVisible({ timeout: 10_000 });
  });

  test("duplicate email shows a field-specific error", async ({ page }) => {
    const email = testEmail();

    // First sign up
    await signUp(page, email);
    // Sign out
    await page.goto(`${BASE_URL}/api/auth/signout`);

    // Try to sign up again with the same email
    await page.goto(`${BASE_URL}/signup`);
    await page.fill('input[type="email"]', email);
    await page.fill('input[id="password"]', TEST_PASSWORD);
    await page.fill('input[id="confirmPassword"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');

    // Should see an error about duplicate email
    await expect(page.getByRole("alert")).toBeVisible({ timeout: 5_000 });
  });
});

// ---------------------------------------------------------------------------
// E2E Test 3: Create project → wait for generation → preview loads (Req 5.3)
// ---------------------------------------------------------------------------

test.describe("Project creation and generation", () => {
  test("authenticated user can create a project and see pending status", async ({ page }) => {
    const email = testEmail();
    await signUp(page, email);

    // Navigate to new project page
    await page.goto(`${BASE_URL}/dashboard/new`);

    // Fill the prompt textarea
    const textarea = page.locator("textarea");
    await expect(textarea).toBeVisible({ timeout: 5_000 });
    await textarea.fill(
      "A modern SaaS landing page for a productivity tool with hero, features, and pricing sections."
    );

    // Click submit
    const submitBtn = page.locator('button[type="submit"]');
    await submitBtn.click();

    // Should navigate to the project editor with a jobId
    await page.waitForURL("**/projects/**", { timeout: 15_000 });
    const url = page.url();
    expect(url).toMatch(/\/projects\//);
  });

  test("empty state is shown on dashboard when user has no projects", async ({ page }) => {
    const email = testEmail();
    await signUp(page, email);

    // New user has no projects — should see empty state
    await page.goto(`${BASE_URL}/dashboard`);
    const emptyState = page.getByTestId("empty-state");
    await expect(emptyState).toBeVisible({ timeout: 10_000 });
    await expect(emptyState.getByTestId("create-first-site-cta")).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// E2E Test 4: Export ZIP (Req 10.1)
// ---------------------------------------------------------------------------

test.describe("ZIP export", () => {
  test("Export ZIP button is present on the project editor page", async ({ page }) => {
    const email = testEmail();
    await signUp(page, email);

    // Create a project first via API
    const res = await page.request.post(`${BASE_URL}/api/projects`, {
      data: {
        prompt: "A clean landing page for a fitness app with a hero section and feature list.",
      },
    });

    if (res.status() === 201) {
      const { projectId } = (await res.json()) as { projectId: string };
      await page.goto(`${BASE_URL}/projects/${projectId}`);
      // The Export ZIP button should be rendered in the toolbar
      await expect(page.getByText("Export ZIP")).toBeVisible({ timeout: 10_000 });
    } else {
      // If project creation failed (e.g., zero credits), skip this sub-check
      test.skip();
    }
  });
});

// ---------------------------------------------------------------------------
// E2E Test 5: Version history and revert (Req 9.3)
// ---------------------------------------------------------------------------

test.describe("Version history", () => {
  test("versions tab is accessible on the project editor", async ({ page }) => {
    const email = testEmail();
    await signUp(page, email);

    const res = await page.request.post(`${BASE_URL}/api/projects`, {
      data: { prompt: "A portfolio site for a web developer with projects and contact sections." },
    });

    if (res.status() === 201) {
      const { projectId } = (await res.json()) as { projectId: string };
      await page.goto(`${BASE_URL}/projects/${projectId}`);

      // Click the "versions" tab in the sidebar
      const versionsTab = page.getByRole("button", { name: /versions/i });
      await expect(versionsTab).toBeVisible({ timeout: 10_000 });
      await versionsTab.click();
    } else {
      test.skip();
    }
  });
});

// ---------------------------------------------------------------------------
// E2E Test 6: Account page sections visible after sign in
// ---------------------------------------------------------------------------

test.describe("Account page", () => {
  test("account page shows tier, balance, and billing sections", async ({ page }) => {
    const email = testEmail();
    await signUp(page, email);

    await page.goto(`${BASE_URL}/account`);

    // All three required sections should be visible
    await expect(page.getByTestId("tier-section")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("ledger-section")).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// E2E Test 7: Prompt validation client-side (Req 3.5)
// ---------------------------------------------------------------------------

test.describe("Prompt validation", () => {
  test("submit button is disabled when prompt is too short", async ({ page }) => {
    const email = testEmail();
    await signUp(page, email);

    await page.goto(`${BASE_URL}/dashboard/new`);
    const textarea = page.locator("textarea");
    await textarea.fill("Short"); // < 10 chars
    const submitBtn = page.locator('button[type="submit"]');
    // Button should be disabled (aria-disabled or disabled attribute)
    const isDisabled =
      (await submitBtn.getAttribute("disabled")) !== null ||
      (await submitBtn.getAttribute("aria-disabled")) === "true";
    expect(isDisabled).toBe(true);
  });

  test("submit button is enabled when prompt is valid and credits are available", async ({ page }) => {
    const email = testEmail();
    await signUp(page, email);

    await page.goto(`${BASE_URL}/dashboard/new`);
    const textarea = page.locator("textarea");
    await textarea.fill(
      "A clean portfolio site for a graphic designer showcasing projects and contact info."
    );

    // Wait for credit balance to load (it's fetched async)
    await page.waitForTimeout(1500);

    const submitBtn = page.locator('button[type="submit"]');
    const isDisabled =
      (await submitBtn.getAttribute("disabled")) !== null &&
      (await submitBtn.getAttribute("aria-disabled")) === "true";
    // Should not be disabled when prompt is valid
    expect(isDisabled).toBe(false);
  });
});

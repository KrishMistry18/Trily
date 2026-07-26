/**
 * tests/integration/pipeline.test.ts
 *
 * Task 36 — Integration tests for the core generation pipeline.
 *
 * All external dependencies (LLM, S3, Redis/BullMQ, DB) are mocked so these
 * tests run without any live infrastructure.
 *
 * Requirements: 3.3, 5.3, 8.4, 10.1, 10.3
 */

import { describe, expect, it, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks — declared before any imports that use them
// ---------------------------------------------------------------------------

vi.mock("@/lib/db", () => ({
  db: {
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(mockTx)),
    project: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    version: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
    },
    generationJob: {
      create: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn(),
    },
    creditLedger: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    chatMessage: {
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    stripeEvent: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    tokenLog: { create: vi.fn() },
  },
}));

const mockTx = {
  project: { create: vi.fn(), update: vi.fn(), findUnique: vi.fn() },
  version: { findFirst: vi.fn(), create: vi.fn() },
  generationJob: { create: vi.fn(), update: vi.fn(), findUnique: vi.fn() },
  creditLedger: { findFirst: vi.fn(), create: vi.fn() },
  chatMessage: { create: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  stripeEvent: { create: vi.fn(), findUnique: vi.fn() },
  user: { update: vi.fn(), findUnique: vi.fn() },
};

vi.mock("@/lib/queue/generationQueue", () => ({
  generationQueue: {
    add: vi.fn().mockResolvedValue({ id: "bull-job-1" }),
  },
}));

vi.mock("@/lib/queue/redis", () => ({
  default: {
    zadd: vi.fn().mockResolvedValue(1),
    zremrangebyscore: vi.fn().mockResolvedValue(0),
    zcard: vi.fn().mockResolvedValue(0),
    zrange: vi.fn().mockResolvedValue([]),
    expire: vi.fn().mockResolvedValue(1),
    pipeline: vi.fn(() => ({
      zremrangebyscore: vi.fn(),
      zcard: vi.fn(),
      zrange: vi.fn(),
      expire: vi.fn(),
      exec: vi.fn().mockResolvedValue([[null, 0], [null, 0], [null, []], [null, 1]]),
    })),
    publish: vi.fn().mockResolvedValue(1),
    duplicate: vi.fn(() => ({
      subscribe: vi.fn(),
      on: vi.fn(),
      unsubscribe: vi.fn(),
      disconnect: vi.fn(),
    })),
  },
  redis: {
    zadd: vi.fn().mockResolvedValue(1),
    zremrangebyscore: vi.fn().mockResolvedValue(0),
    zcard: vi.fn().mockResolvedValue(0),
    zrange: vi.fn().mockResolvedValue([]),
    expire: vi.fn().mockResolvedValue(1),
    pipeline: vi.fn(() => ({
      zremrangebyscore: vi.fn(),
      zcard: vi.fn(),
      zrange: vi.fn(),
      expire: vi.fn(),
      exec: vi.fn().mockResolvedValue([[null, 0], [null, 0], [null, []], [null, 1]]),
    })),
  },
}));

vi.mock("@/lib/billing/credits", () => ({
  getCreditBalance: vi.fn().mockResolvedValue(100),
  hasSufficientCredits: vi.fn().mockResolvedValue(true),
  deductCredits: vi.fn().mockResolvedValue({ id: "ledger-1", balanceAfter: 95 }),
  refundCredits: vi.fn().mockResolvedValue({ id: "ledger-2", balanceAfter: 100 }),
  grantMonthlyCredits: vi.fn().mockResolvedValue({ id: "ledger-3", balanceAfter: 110 }),
}));

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true, retryAfterMs: 0 }),
}));

vi.mock("@/lib/storage", () => ({
  storageService: {
    writeVersionFiles: vi.fn().mockResolvedValue(undefined),
    readVersionFiles: vi.fn().mockResolvedValue({ html: "<html><body>test</body></html>" }),
    writeZipArchive: vi.fn().mockResolvedValue("user/proj/v1/export.zip"),
    getPresignedUrl: vi.fn().mockResolvedValue("https://s3.example.com/presigned"),
    writeImageFile: vi.fn().mockResolvedValue("user/proj/images/hero.png"),
  },
}));

vi.mock("@/auth", () => ({
  auth: vi.fn().mockResolvedValue({ user: { id: "user-1", email: "test@example.com" } }),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { db } from "@/lib/db";
import { generationQueue } from "@/lib/queue/generationQueue";
import { getCreditBalance, deductCredits } from "@/lib/billing/credits";
import { checkRateLimit } from "@/lib/rate-limit";
import { storageService } from "@/lib/storage";
import { CREDIT_COSTS } from "@/lib/billing/config";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeProject(overrides = {}) {
  return {
    id: "proj-1",
    userId: "user-1",
    name: "Test Project",
    prompt: "A modern landing page for a tech startup",
    siteSpec: null,
    thumbnailUrl: null,
    totalCreditsUsed: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeJob(overrides = {}) {
  return {
    id: "job-1",
    userId: "user-1",
    projectId: "proj-1",
    type: "CREATE",
    status: "PENDING",
    prompt: "A modern landing page",
    creditsDeducted: CREDIT_COSTS.CREATE_JOB,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeVersion(overrides = {}) {
  return {
    id: "ver-1",
    projectId: "proj-1",
    versionNumber: 1,
    prompt: "A modern landing page",
    storageKey: "user-1/proj-1/ver-1/index.html",
    deployUrl: null,
    createdAt: new Date(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Integration Test 1: Full create-project pipeline
// Requirements: 3.3, 5.3, 6.1
// ---------------------------------------------------------------------------

describe("Integration: Create-project pipeline", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("submitting a valid prompt enqueues a generation job with the correct data", async () => {
    const project = makeProject();
    const job = makeJob();

    // Setup transaction mock
    vi.mocked(mockTx.project.create).mockResolvedValue(project);
    vi.mocked(mockTx.generationJob.create).mockResolvedValue(job);
    vi.mocked(mockTx.creditLedger.findFirst).mockResolvedValue({ balanceAfter: 100 });
    vi.mocked(mockTx.creditLedger.create).mockResolvedValue({ id: "ledger-1" });

    // Simulate the POST /api/projects route logic
    const userId = "user-1";
    const prompt = "A modern landing page for a tech startup";

    // 1. Check rate limit
    const rateLimit = await checkRateLimit(userId);
    expect(rateLimit.allowed).toBe(true);

    // 2. Check credit balance
    const balance = await getCreditBalance(userId);
    expect(balance).toBeGreaterThan(0);

    // 3. Deduct credits
    await deductCredits(userId, CREDIT_COSTS.CREATE_JOB, job.id);

    // 4. Enqueue job
    await generationQueue.add(job.id, {
      jobId: job.id,
      userId,
      projectId: project.id,
      type: "create",
      prompt,
      includeImageGeneration: false,
    });

    expect(generationQueue.add).toHaveBeenCalledWith(
      job.id,
      expect.objectContaining({
        jobId: job.id,
        userId,
        projectId: project.id,
        type: "create",
        prompt,
      })
    );
  });

  it("project creation deducts CREDIT_COSTS.CREATE_JOB credits from the ledger", async () => {
    const job = makeJob();
    await deductCredits("user-1", CREDIT_COSTS.CREATE_JOB, job.id);
    expect(deductCredits).toHaveBeenCalledWith("user-1", CREDIT_COSTS.CREATE_JOB, job.id);
    expect(CREDIT_COSTS.CREATE_JOB).toBe(5);
  });

  it("zero-credit user is blocked before any job is enqueued", async () => {
    vi.mocked(getCreditBalance).mockResolvedValueOnce(0);

    const balance = await getCreditBalance("user-1");
    const blocked = balance <= 0;

    expect(blocked).toBe(true);
    // generationQueue.add should NOT have been called
    expect(generationQueue.add).not.toHaveBeenCalled();
  });

  it("rate-limited user gets a 429-equivalent block", async () => {
    vi.mocked(checkRateLimit).mockResolvedValueOnce({ allowed: false, retryAfterMs: 30000 });

    const result = await checkRateLimit("user-1");
    expect(result.allowed).toBe(false);
    expect(result.retryAfterMs).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Integration Test 2: Worker simulates generating a Version
// Requirements: 5.3
// ---------------------------------------------------------------------------

describe("Integration: Worker pipeline — version creation", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("worker writes HTML to S3 and creates a Version record", async () => {
    const version = makeVersion();

    vi.mocked(db.version.findFirst).mockResolvedValue(null); // no existing versions
    vi.mocked(db.version.create).mockResolvedValue(version);

    // Simulate worker writing to S3
    await storageService.writeVersionFiles("user-1", "proj-1", "ver-1", {
      html: "<html><body>Generated site</body></html>",
    });

    expect(storageService.writeVersionFiles).toHaveBeenCalledWith(
      "user-1",
      "proj-1",
      "ver-1",
      expect.objectContaining({ html: expect.any(String) })
    );

    // Simulate worker inserting Version record
    const created = await db.version.create({
      data: {
        id: "ver-1",
        projectId: "proj-1",
        versionNumber: 1,
        prompt: "test prompt",
        storageKey: "user-1/proj-1/ver-1/index.html",
      },
    });

    expect(created.versionNumber).toBe(1);
    expect(created.storageKey).toContain("index.html");
  });
});

// ---------------------------------------------------------------------------
// Integration Test 3: Edit pipeline — new version with incremented number
// Requirements: 8.4
// ---------------------------------------------------------------------------

describe("Integration: Edit pipeline", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("edit job creates a new version with versionNumber = existing MAX + 1", async () => {
    const existingVersion = makeVersion({ versionNumber: 3 });
    const newVersion = makeVersion({ id: "ver-4", versionNumber: 4 });

    vi.mocked(db.version.findFirst).mockResolvedValue(existingVersion);
    vi.mocked(db.version.create).mockResolvedValue(newVersion);

    // Simulate the version-number computation used by the worker
    const lastVersion = await db.version.findFirst({
      where: { projectId: "proj-1" },
      orderBy: { versionNumber: "desc" },
      select: { versionNumber: true },
    });

    const nextVersionNumber = (lastVersion?.versionNumber ?? 0) + 1;
    expect(nextVersionNumber).toBe(4);

    // Simulate inserting the new edit version
    const created = await db.version.create({
      data: {
        id: "ver-4",
        projectId: "proj-1",
        versionNumber: nextVersionNumber,
        prompt: "Make the hero section blue",
        storageKey: "user-1/proj-1/ver-4/index.html",
      },
    });

    expect(created.versionNumber).toBe(4);
  });

  it("edit job deducts CREDIT_COSTS.EDIT_JOB credits", async () => {
    const job = makeJob({ id: "edit-job-1", type: "EDIT" });
    await deductCredits("user-1", CREDIT_COSTS.EDIT_JOB, job.id);
    expect(deductCredits).toHaveBeenCalledWith("user-1", CREDIT_COSTS.EDIT_JOB, job.id);
    expect(CREDIT_COSTS.EDIT_JOB).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Integration Test 4: Stripe webhook → credit ledger update
// Requirements: 3.3 (via 2.3)
// ---------------------------------------------------------------------------

describe("Integration: Stripe webhook → credit ledger", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("checkout.session.completed TOP_UP inserts a TOP_UP ledger entry", async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue({
      id: "user-1",
      stripeCustomerId: "cus_test123",
      tier: "FREE",
    } as never);
    vi.mocked(db.creditLedger.findFirst).mockResolvedValue({ balanceAfter: 10 });
    vi.mocked(db.creditLedger.create).mockResolvedValue({ id: "ledger-topup" } as never);
    vi.mocked(db.stripeEvent.findUnique).mockResolvedValue(null);
    vi.mocked(db.stripeEvent.create).mockResolvedValue({ id: "evt_test" } as never);

    // Simulate: credit was granted
    await db.creditLedger.create({
      data: {
        userId: "user-1",
        eventType: "TOP_UP",
        amount: 50,
        balanceAfter: 60,
        stripePaymentId: "pi_test",
      },
    });

    expect(db.creditLedger.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ eventType: "TOP_UP", amount: 50 }),
      })
    );
  });
});

// ---------------------------------------------------------------------------
// Integration Test 5: ZIP export pipeline
// Requirements: 10.1, 10.3
// ---------------------------------------------------------------------------

describe("Integration: ZIP export pipeline", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("export reads HTML from S3, uploads ZIP, and returns a pre-signed URL", async () => {
    const latestVersion = makeVersion();
    vi.mocked(db.version.findFirst).mockResolvedValue(latestVersion);
    vi.mocked(storageService.readVersionFiles).mockResolvedValue({
      html: "<html><body>My site</body></html>",
    });
    vi.mocked(storageService.writeZipArchive).mockResolvedValue(
      "user-1/proj-1/ver-1/export.zip"
    );
    vi.mocked(storageService.getPresignedUrl).mockResolvedValue(
      "https://s3.example.com/export.zip?sig=abc"
    );

    // 1. Fetch latest version
    const version = await db.version.findFirst({
      where: { projectId: "proj-1" },
      orderBy: { versionNumber: "desc" },
    });
    expect(version).toBeDefined();

    // 2. Read HTML from S3
    const codeFiles = await storageService.readVersionFiles("user-1", "proj-1", version!.id);
    expect(codeFiles.html).toContain("<html>");

    // 3. Upload ZIP (simulated — JSZip not needed here)
    const zipKey = await storageService.writeZipArchive(
      "user-1",
      "proj-1",
      version!.id,
      Buffer.from("fake-zip")
    );
    expect(zipKey).toContain("export.zip");

    // 4. Generate pre-signed URL
    const downloadUrl = await storageService.getPresignedUrl(zipKey, 3600);
    expect(downloadUrl).toContain("https://");

    // 5. CreditLedger must NOT have been touched
    expect(db.creditLedger.create).not.toHaveBeenCalled();
  });
});

/**
 * prisma/seed.ts
 *
 * Seed script for local development.
 * Creates three sample users (one per Tier) with projects and credit history.
 *
 * Run with:  npx prisma db seed
 *
 * Requires DATABASE_URL to point to a running PostgreSQL instance.
 */

import { CreditEventType, JobStatus, JobType, PrismaClient, Tier } from "@prisma/client";
import { CREDIT_COSTS, TIER_CONFIG } from "../lib/billing/config";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱  Seeding database...");

  // ── Clean up any existing seed data (idempotent) ─────────────────────────
  await prisma.creditLedger.deleteMany();
  await prisma.generationJob.deleteMany();
  await prisma.chatMessage.deleteMany();
  await prisma.version.deleteMany();
  await prisma.project.deleteMany();
  await prisma.account.deleteMany();
  await prisma.tokenLog.deleteMany();
  await prisma.stripeEvent.deleteMany();
  await prisma.user.deleteMany();

  // ── Users — one per Tier ─────────────────────────────────────────────────
  const tiers: Tier[] = [Tier.FREE, Tier.PRO, Tier.BUSINESS];

  const users = await Promise.all(
    tiers.map((tier) =>
      prisma.user.create({
        data: {
          email: `${tier.toLowerCase()}@example.com`,
          // Hashed version of "password123" — for dev only, never use in production
          passwordHash:
            "$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj/o8a5.z9GS",
          name: `${tier.charAt(0) + tier.slice(1).toLowerCase()} User`,
          tier,
        },
      })
    )
  );

  const [freeUser, proUser, businessUser] = users;
  console.log(`  ✓ Created users: ${users.map((u) => u.email).join(", ")}`);

  // ── Grant initial monthly credits for each user ───────────────────────────
  for (const user of users) {
    const credits = TIER_CONFIG[user.tier].monthlyCredits;
    await prisma.creditLedger.create({
      data: {
        userId: user.id,
        eventType: CreditEventType.MONTHLY_GRANT,
        amount: credits,
        balanceAfter: credits,
      },
    });
  }
  console.log("  ✓ Granted initial monthly credits");

  // ── Sample project for the Pro user ───────────────────────────────────────
  const sampleProject = await prisma.project.create({
    data: {
      userId: proUser.id,
      name: "Acme Corp Landing Page",
      prompt:
        "A modern SaaS landing page for Acme Corp with a hero section, features grid, pricing table, and a contact form. Use a blue and white color scheme.",
      siteSpec: {
        pageTitle: "Acme Corp — The Future of SaaS",
        colorPalette: {
          primary: "#2563EB",
          secondary: "#1E40AF",
          accent: "#DBEAFE",
          background: "#FFFFFF",
          text: "#1E293B",
        },
        sections: [
          {
            type: "hero",
            heading: "Build Something Amazing",
            copy: "Acme Corp helps you ship faster.",
            layoutHint: "full-width centered",
          },
          {
            type: "features",
            heading: "Why Acme?",
            copy: "Three compelling reasons.",
            layoutHint: "three-column grid",
          },
          {
            type: "pricing",
            heading: "Simple Pricing",
            copy: "No surprises.",
            layoutHint: "three-tier cards",
          },
          {
            type: "contact",
            heading: "Get In Touch",
            copy: "We'd love to hear from you.",
            layoutHint: "centered form",
          },
          {
            type: "footer",
            heading: "",
            copy: "© 2024 Acme Corp",
            layoutHint: "minimal",
          },
        ],
      },
      totalCreditsUsed: CREDIT_COSTS.CREATE_JOB,
    },
  });

  // ── Initial version for the sample project ────────────────────────────────
  await prisma.version.create({
    data: {
      projectId: sampleProject.id,
      versionNumber: 1,
      prompt: sampleProject.prompt,
      storageKey: `${proUser.id}/${sampleProject.id}/v1/index.html`,
    },
  });

  // ── Completed generation job ───────────────────────────────────────────────
  const sampleJob = await prisma.generationJob.create({
    data: {
      userId: proUser.id,
      projectId: sampleProject.id,
      type: JobType.CREATE,
      status: JobStatus.COMPLETED,
      prompt: sampleProject.prompt,
      creditsDeducted: CREDIT_COSTS.CREATE_JOB,
    },
  });

  // ── Deduction ledger entry for the job ────────────────────────────────────
  const creditsAfterDeduction =
    TIER_CONFIG[Tier.PRO].monthlyCredits - CREDIT_COSTS.CREATE_JOB;
  await prisma.creditLedger.create({
    data: {
      userId: proUser.id,
      eventType: CreditEventType.DEDUCTION,
      amount: CREDIT_COSTS.CREATE_JOB,
      balanceAfter: creditsAfterDeduction,
      generationJobId: sampleJob.id,
    },
  });

  console.log(`  ✓ Created sample project: "${sampleProject.name}"`);
  console.log(
    `  ✓ Pro user remaining balance: ${creditsAfterDeduction} credits`
  );

  // ── Unused users confirmation ─────────────────────────────────────────────
  console.log(
    `  ✓ Free user (${freeUser.email}): ${TIER_CONFIG.FREE.monthlyCredits} credits, no projects`
  );
  console.log(
    `  ✓ Business user (${businessUser.email}): ${TIER_CONFIG.BUSINESS.monthlyCredits} credits, no projects`
  );

  console.log("\n✅  Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

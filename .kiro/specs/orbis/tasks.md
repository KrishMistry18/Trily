 # Implementation Plan: Orbis

## Overview

This plan decomposes the Orbis SaaS platform into granular, sequentially-ordered coding tasks. Each task builds on the previous ones and ends with all code wired together. The stack is Next.js 14 (App Router) + TypeScript + Prisma + PostgreSQL + BullMQ/Redis + S3/R2 + Stripe + NextAuth.js + Tailwind CSS. Property-based tests use Vitest + fast-check.

---

## Tasks

- [x] 1. Project scaffolding and tooling setup
  - Initialise Next.js 14 App Router project with TypeScript strict mode
  - Configure Tailwind CSS with the project design tokens (primary, secondary, accent, background, text colour variables)
  - Add ESLint, Prettier, and Husky pre-commit hooks
  - Configure path aliases in `tsconfig.json` (`@/lib`, `@/components`, `@/types`)
  - Add Vitest with jsdom environment and React Testing Library
  - Add fast-check as a dev dependency for property-based tests
  - Add Playwright for E2E tests
  - Create `.env.example` listing all required environment variables
  - Create `lib/env.ts` using zod to validate and export all env variables at startup
  - _Requirements: 16.4_

- [x] 2. Database schema and migrations
  - Install Prisma and initialise with PostgreSQL provider
  - Create schema for: User, Account, Project, Version, GenerationJob, CreditLedger, TokenLog, ChatMessage, StripeEvent enums
  - Create and run initial migration
  - Write `lib/db.ts` singleton Prisma client (edge-safe)
  - Seed script: create three Tier config constants and sample data for local dev
  - _Requirements: 1.1, 2.1, 2.5, 3.6, 4.1, 5.3, 8.1_

  - [x] 2.1 Write property test: new projects always have all required fields populated
    - **Property 8: New projects always have all required fields populated**
    - **Validates: Requirements 3.6**

- [x] 3. Authentication — NextAuth setup
  - Install NextAuth v5 and Prisma adapter
  - Create `auth.ts` config with `CredentialsProvider` (bcrypt, min 8 chars) and `GoogleProvider`
  - Create `/api/auth/[...nextauth]/route.ts` catch-all
  - Create custom `POST /api/auth/signup` route handler: validate email/password, bcrypt hash, insert User, return session
  - Create `middleware.ts` protecting all `(dashboard)` routes and `/api/projects*`, `/api/billing*`
  - Add `callbackUrl` query param preservation on redirect to login
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8_

  - [x] 3.1 Write property test: invalid login messages are information-safe
    - **Property 1: Invalid login messages are information-safe**
    - **Validates: Requirements 1.6**

  - [x] 3.2 Write property test: all protected routes redirect unauthenticated requests
    - **Property 2: All protected routes redirect unauthenticated requests**
    - **Validates: Requirements 1.8**

- [x] 4. Auth UI — login and sign-up pages
  - Create `app/(auth)/login/page.tsx`: email/password form + Google OAuth button, error display
  - Create `app/(auth)/signup/page.tsx`: email/password form, calls `/api/auth/signup`
  - Add form validation (Zod + react-hook-form): min 8-char password, valid email format
  - Display field-specific error messages from server response
  - Make both pages mobile-responsive at 320px+
  - _Requirements: 1.1, 1.4, 1.6, 19.1_

- [x] 5. Credit and billing infrastructure
  - Create `lib/billing/stripe.ts`: initialise Stripe SDK (server-only), export typed helpers
  - Create `lib/billing/credits.ts`:
    - `getCreditBalance(userId)` — query latest `balanceAfter` from CreditLedger
    - `deductCredits(userId, amount, jobId, tx)` — inserts DEDUCTION row, updates balanceAfter in transaction
    - `refundCredits(userId, amount, jobId, tx)` — inserts REFUND row, updates balanceAfter in transaction
    - `grantMonthlyCredits(userId, amount, tx)` — inserts MONTHLY_GRANT row
  - Create `lib/billing/config.ts`: TIER_CONFIG, CREDIT_COSTS constants
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

  - [x] 5.1 Write property test: Credit Ledger entries always contain all required fields
    - **Property 4: Credit Ledger entries always contain all required fields**
    - **Validates: Requirements 2.5**

  - [x] 5.2 Write property test: zero-credit users are always blocked from generation
    - **Property 3: Zero-credit users are always blocked from generation**
    - **Validates: Requirements 2.4, 3.4**

- [x] 6. Stripe webhook handler
  - Create `app/api/billing/webhook/route.ts`:
    - Validate Stripe signature with `stripe.webhooks.constructEvent`; return 400 on failure without touching DB
    - Check `StripeEvent` table for duplicate event ID (idempotency); return 200 if seen
    - Handle `checkout.session.completed`: top-up or subscription start
    - Handle `customer.subscription.updated`: update User.tier, insert MONTHLY_GRANT if upgrading
    - Handle `customer.subscription.deleted`: update User.tier to FREE
    - Handle `invoice.payment_succeeded`: insert MONTHLY_GRANT for renewal
    - All ledger writes in a single DB transaction
  - _Requirements: 2.3, 2.7, 2.8_

  - [x] 6.1 Write property test: invalid Stripe webhook signatures never modify the Credit Ledger
    - **Property 6: Invalid Stripe webhook signatures never modify the Credit Ledger**
    - **Validates: Requirements 2.8**

  - [x] 6.2 Write property test: subscription downgrade preserves all projects and versions
    - **Property 5: Subscription downgrade preserves all projects and versions**
    - **Validates: Requirements 2.7**

- [x] 7. Stripe Checkout and Portal routes
  - Create `app/api/billing/checkout/route.ts`: POST, creates Stripe Checkout session (subscription or payment), returns URL
  - Create `app/api/billing/portal/route.ts`: POST, creates Stripe Customer Portal session, returns URL
  - Upsert `User.stripeCustomerId` when creating a new customer
  - _Requirements: 2.2, 13.2, 13.3_

- [x] 8. Rate limiter
  - Create `lib/rate-limit/index.ts` using Redis ZADD/ZREMRANGEBYSCORE sliding window
  - Key: `rate:{userId}`, window: `RATE_LIMIT_WINDOW_MS` (default 60000), max: `RATE_LIMIT_MAX_REQUESTS` (default 5)
  - Read config from env on every check (no caching) so changes apply without restart
  - Return `{ allowed: boolean, retryAfterMs: number }`
  - Create `app/api/rate-limit/check/route.ts` (internal helper used by middleware)
  - _Requirements: 15.1, 15.2, 15.3, 15.4_

  - [x] 8.1 Write property test: rate limiter always rejects requests exceeding the configured limit
    - **Property 26: Rate limiter always rejects requests exceeding the configured limit**
    - **Validates: Requirements 15.1, 15.2**

- [x] 9. Storage service
  - Install `@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner`
  - Create `lib/storage/s3Client.ts`: initialise S3Client from env (supports R2 endpoint override)
  - Create `lib/storage/index.ts` implementing `StorageService` interface:
    - `writeVersionFiles` — PutObject to `{userId}/{projectId}/{versionId}/index.html`
    - `readVersionFiles` — GetObject
    - `writeZipArchive` — PutObject to `{userId}/{projectId}/{versionId}/export.zip`
    - `getPresignedUrl` — GetObjectCommand presigned URL, default 3600s expiry
    - `writeImageFile` — PutObject to `{userId}/{projectId}/images/{filename}`
  - All credentials remain server-side only
  - _Requirements: 17.1, 17.2, 17.3, 17.4_

  - [x] 9.1 Write property test: storage pre-signed URLs always have at least 1-hour expiry
    - **Property 27: Storage pre-signed URLs always have at least 1-hour expiry**
    - **Validates: Requirements 10.3, 17.3**

- [x] 10. AI Service Layer — provider abstraction and retry logic
  - Create `lib/ai/providers/anthropic.ts`: wrap `@anthropic-ai/sdk`, implement `LLMProvider` interface
  - Create `lib/ai/providers/openai.ts`: wrap `openai`, implement `LLMProvider` interface
  - Create `lib/ai/retry.ts`: `withRetry(fn, attempts=3)` with exponential backoff (1s → 2s → 4s, max 16s) and 60s timeout per attempt
  - Create `lib/ai/token-logger.ts`: `logTokenUsage(params)` writes TokenLog to DB
  - Create `lib/ai/index.ts`: exports active provider selected by `AI_PROVIDER` env variable
  - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5_

  - [x] 10.1 Write property test: AI Service Layer timeout triggers on all calls exceeding 60 seconds
    - **Property 24: AI Service Layer timeout triggers on all calls exceeding 60 seconds**
    - **Validates: Requirements 14.2**

  - [x] 10.2 Write property test: AI Service Layer retry count never exceeds 3 and follows exponential backoff
    - **Property 25: AI Service Layer retry count never exceeds 3 and follows exponential backoff**
    - **Validates: Requirements 14.3**

  - [x] 10.3 Write property test: every LLM and image API call produces a Token_Log record
    - **Property 10: Every LLM and image API call produces a Token_Log record**
    - **Validates: Requirements 4.5, 5.5, 14.5, 18.5**

- [x] 11. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 12. Spec Generator service
  - Create `lib/ai/spec-generator.ts`:
    - Define `SiteSpecSchema` (zod) with pageTitle, colorPalette (5 hex colours), sections array
    - Build system prompt instructing LLM to output only valid JSON conforming to schema
    - On schema validation failure: prepend corrective instruction and retry (max 3 times total via `withRetry`)
    - Call `logTokenUsage` after every LLM call
    - Return parsed `SiteSpec` object
  - _Requirements: 4.1, 4.2, 4.5_

  - [ ] 12.1 Write property test: spec generator always produces schema-conforming output (mocked LLM)
    - **Property 8 related — schema invariant**
    - For any prompt, mocked valid LLM response must always parse to a valid SiteSpec
    - **Validates: Requirements 4.1, 4.2**

- [ ] 13. Code Generator service
  - Create `lib/ai/code-generator.ts`:
    - Build system prompt with SiteSpec input, instructing LLM to output single self-contained HTML5 file
    - Prompt must include mobile-responsive instruction (320px+) and HTML5 validity requirement
    - On failure: retry via `withRetry` (max 3 attempts)
    - Call `logTokenUsage` after every LLM call
    - Return `CodeFiles` object `{ html: string }`
  - _Requirements: 5.1, 5.2, 5.5_

  - [ ] 13.1 Write property test: code generator LLM prompt always includes mobile-responsive instruction
    - **Property related to Req 5.2**
    - For any SiteSpec, verify outgoing LLM call contains mobile-responsive + HTML5 instructions
    - **Validates: Requirements 5.2**

- [ ] 14. Edit Code Generator service
  - Create `lib/ai/edit-generator.ts`:
    - Accept `currentHtml: string` and `editPrompt: string`
    - Build prompt that includes full current HTML and the edit instruction
    - Retry up to 3 times; log token usage
    - Return updated `CodeFiles`
  - _Requirements: 8.3_

  - [ ] 14.1 Write property test: edit jobs always include current code in the LLM prompt
    - **Property 16: Edit jobs always include current code in the LLM prompt**
    - **Validates: Requirements 8.3**

- [ ] 15. Image Generator service (stretch)
  - Create `lib/ai/image-generator.ts`:
    - Accept `SiteSpec` (use hero section copy + colorPalette to build image prompt)
    - Call Replicate or fal.ai API (selected by `IMAGE_PROVIDER` env variable)
    - On success: download image buffer, write to S3 via storage service, return S3 URL
    - On failure after 3 retries: throw `ImageGenerationError`
    - Log cost record via `logTokenUsage` (or equivalent cost log)
  - _Requirements: 18.1, 18.3, 18.4, 18.5_

  - [ ] 15.1 Write property test: image generation credit cost is always deducted when opted in
    - **Property 28: Image generation credit cost is always deducted when opted in**
    - **Validates: Requirements 18.2**

- [ ] 16. BullMQ job queue infrastructure
  - Install `bullmq` and `ioredis`
  - Create `lib/queue/redis.ts`: ioredis client from `REDIS_URL` env
  - Create `lib/queue/generationQueue.ts`: export BullMQ `Queue` instance named `generation`
  - Create `lib/queue/generationWorker.ts`: BullMQ `Worker` with concurrency from `WORKER_CONCURRENCY` env
    - Worker process function: spec generation → persist SiteSpec → code generation → optional image generation → storage write → Version insert → status update → Redis pub/sub publish
    - Timeout watchdog: check elapsed time; fail job if > 120s
    - FAILED handler: insert CreditLedger REFUND, publish failure event
  - Create `worker.ts` entry point (separate Node process from Next.js)
  - _Requirements: 6.1, 6.2, 6.6_

  - [ ] 16.1 Write property test: Generation job statuses are always from the valid set
    - **Property 11: Generation job statuses are always drawn from the valid set**
    - **Validates: Requirements 6.2**

  - [ ] 16.2 Write property test: credits are always restored on any generation job failure
    - **Property 9: Credits are always restored on any generation job failure**
    - **Validates: Requirements 4.4, 5.4, 6.6, 8.6, 18.4**

  - [ ] 16.3 Write property test: timed-out jobs are marked failed and credits restored
    - **Property 12: Timed-out jobs are marked failed and credits restored**
    - **Validates: Requirements 6.6**

- [ ] 17. SSE job status endpoint
  - Create `app/api/jobs/[jobId]/status/route.ts`:
    - Verify job belongs to authenticated user
    - If job already COMPLETED or FAILED, return current status immediately
    - Otherwise open SSE stream (`text/event-stream`)
    - Subscribe to Redis pub/sub channel `job:{jobId}`, forward events to client
    - Close stream when job reaches terminal state or client disconnects
  - _Requirements: 6.3, 6.4, 6.5_

- [ ] 18. Project creation API route
  - Create `app/api/projects/route.ts` (POST):
    - Authenticate user, check rate limit (return 429 with retry-after on limit exceeded)
    - Validate prompt length [10, 2000] (return 400 on violation)
    - Check credit balance (return 402 if zero)
    - In a DB transaction: INSERT Project, INSERT GenerationJob (PENDING), INSERT CreditLedger DEDUCTION
    - Enqueue BullMQ job with `generationQueue.add`
    - Return `{ projectId, jobId, status: 'pending' }` within 2 seconds
  - _Requirements: 3.1, 3.3, 3.4, 3.5, 3.6, 6.1_

  - [ ] 18.1 Write property test: prompt length validation is enforced consistently
    - **Property 7: Prompt length validation is enforced consistently**
    - **Validates: Requirements 3.5**

- [ ] 19. Version management API routes
  - Create `app/api/projects/[projectId]/versions/route.ts` (GET): return all versions sorted by versionNumber asc
  - Create `app/api/projects/[projectId]/versions/[versionId]/route.ts` (GET): return version metadata + pre-signed storage URL
  - Create revert action in `app/api/projects/[projectId]/versions/[versionId]/route.ts` (POST with `action: 'revert'`):
    - Fetch source version code from S3
    - Write to new S3 path with new versionId
    - INSERT new Version with `versionNumber = MAX + 1` and same code
  - Enforce project ownership checks on all routes
  - _Requirements: 9.1, 9.2, 9.3, 9.4_

  - [ ] 19.1 Write property test: version numbers always increment by exactly one
    - **Property 17: Version numbers always increment by exactly one**
    - **Validates: Requirements 8.4, 9.3**

  - [ ] 19.2 Write property test: reverting a version produces a new version with identical code
    - **Property 19: Reverting a version produces a new version with identical code**
    - **Validates: Requirements 9.3**

- [ ] 20. Chat/iterative editing API route
  - Create `app/api/projects/[projectId]/chat/route.ts` (POST):
    - Validate edit prompt length [5, 1000] (return 400 on violation)
    - Check credit balance and rate limit
    - In transaction: INSERT ChatMessage (PENDING), INSERT GenerationJob (type: EDIT), INSERT CreditLedger DEDUCTION
    - Enqueue BullMQ edit job referencing current latest versionId
    - Return `{ jobId, chatMessageId }`
  - Create `app/api/projects/[projectId]/chat/route.ts` (GET): return all ChatMessages for project ordered by createdAt asc
  - _Requirements: 8.1, 8.2, 8.4, 8.5, 8.6_

  - [ ] 20.1 Write property test: edit prompts outside valid length range are always rejected
    - **Property 15: Edit prompts outside the valid length range are always rejected**
    - **Validates: Requirements 8.1**

  - [ ] 20.2 Write property test: chat messages are always returned in chronological order
    - **Property 18: Chat messages are always returned in chronological order**
    - **Validates: Requirements 8.5**

- [ ] 21. ZIP export route
  - Install `jszip`
  - Create `app/api/projects/[projectId]/export/route.ts` (POST):
    - Fetch latest Version's HTML from S3
    - Create ZIP archive containing `index.html`
    - Upload ZIP to S3 at `{userId}/{projectId}/{versionId}/export.zip`
    - Generate pre-signed URL (3600s expiry)
    - Return `{ downloadUrl, expiresAt }` within 5 seconds
    - Do NOT modify CreditLedger
  - _Requirements: 10.1, 10.2, 10.3, 10.4_

  - [ ] 21.1 Write property test: ZIP export never changes the credit balance
    - **Property 20: ZIP export never changes the credit balance**
    - **Validates: Requirements 10.4**

- [ ] 22. Vercel deploy route
  - Create `lib/ai/vercel-deploy.ts`: POST to Vercel API `/v13/deployments` using `VERCEL_API_TOKEN` (server-side only)
  - Create `app/api/projects/[projectId]/deploy/route.ts` (POST):
    - Fetch latest Version's HTML from S3
    - Call `deployToVercel(projectName, files, versionId)`
    - On success: UPDATE Version.deployUrl, return `{ deployUrl, versionId }`
    - On error: return 502 with error message; do NOT modify Version record
    - Do NOT modify CreditLedger
  - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5_

  - [ ] 22.1 Write property test: Vercel deploy never changes the credit balance
    - **Property 21: Vercel deploy never changes the credit balance**
    - **Validates: Requirements 11.4**

  - [ ] 22.2 Write property test: Vercel deploy failures never corrupt the Version record
    - **Property 22: Vercel deploy failures never corrupt the Version record**
    - **Validates: Requirements 11.3**

- [ ] 23. Projects list and delete API routes
  - Create `app/api/projects/route.ts` (GET): return all user's projects sorted by updatedAt desc, including latest Version metadata and total credit usage
  - Create `app/api/projects/[projectId]/route.ts` (DELETE): delete project and all child records (Prisma cascade), delete S3 objects under `{userId}/{projectId}/`
  - _Requirements: 12.1, 9.4_

  - [ ] 23.1 Write property test: dashboard project list is always sorted by last-edited date descending
    - **Property 23: Dashboard project list is always sorted by last-edited date descending**
    - **Validates: Requirements 12.1**

- [ ] 24. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 25. Dashboard UI
  - Create `app/(dashboard)/dashboard/page.tsx`:
    - Fetch projects from `/api/projects` (server component RSC fetch)
    - Render project cards grid: thumbnail (or placeholder SVG), project name, last-edited date, total credits used
    - Sort is handled server-side; render in received order
    - Empty state: illustration + "Create your first site" CTA button linking to `/dashboard/new`
    - Mobile-responsive grid (1 col at 320px, 2 col at md, 3 col at lg)
  - Create `app/(dashboard)/dashboard/new/page.tsx`: prompt input landing page
  - _Requirements: 12.1, 12.2, 12.3, 12.4, 19.1_

  - [ ] 25.1 Write unit test: empty state is displayed when user has no projects
    - Render dashboard with empty projects array, verify empty-state message and CTA
    - **Validates: Requirements 12.3**

- [ ] 26. Prompt input UI and project creation flow
  - Create `components/PromptInput.tsx`:
    - Textarea: min 10, max 2000 characters with live counter
    - Optional preset picker dropdown (industry presets pre-fill textarea)
    - Submit button disabled when credit balance = 0 or prompt invalid
    - On submit: POST `/api/projects`, navigate to `/dashboard/projects/{projectId}?jobId={jobId}`
  - Integrate credit balance display near submit button (fetch from `/api/billing/balance`)
  - Mobile-responsive layout at 320px+
  - _Requirements: 3.1, 3.2, 3.3, 3.5, 19.1_

- [ ] 27. Project editor page — layout and preview panel
  - Create `app/(dashboard)/projects/[projectId]/page.tsx`:
    - Two-panel layout: left panel = preview, right panel = chat/versions sidebar
    - Fetch latest version on load; display loading skeleton during generation
    - Connect to SSE at `/api/jobs/:jobId/status` and update UI on status changes
  - Create `components/PreviewPanel.tsx`:
    - Render `<iframe sandbox="allow-scripts" srcdoc={htmlContent}>` — no `allow-same-origin`
    - Resizable width control (slider from 320px to full panel width)
    - Show viewport width indicator
    - Reload iframe content when version changes (within 1 second of version switch)
  - Set CSP headers via `next.config.js` headers configuration for all app routes
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 16.1, 16.2, 19.3_

  - [ ] 27.1 Write property test: Preview iframe always uses the minimum sandbox attribute set
    - **Property 13: Preview iframe always uses the minimum sandbox attribute set**
    - **Validates: Requirements 7.1, 16.1**

  - [ ] 27.2 Write property test: all application pages include a correct CSP header
    - **Property 14: All application pages include a correct Content Security Policy header**
    - **Validates: Requirements 16.2**

- [ ] 28. Generation status UI — progress indicator
  - Create `components/GenerationStatus.tsx`:
    - Display spinner + status label (Pending → Generating spec → Generating code → Complete / Failed)
    - Subscribe to SSE stream from `useJobStatus(jobId)` hook
    - On COMPLETED: trigger Preview reload with new version content
    - On FAILED: display error message with retry option
  - Create `hooks/useJobStatus.ts`: SSE client hook managing EventSource lifecycle
  - _Requirements: 6.3, 6.4, 6.5_

- [ ] 29. Chat interface panel
  - Create `components/ChatPanel.tsx`:
    - Message list: each item shows prompt text, timestamp, status badge (pending/applied/failed)
    - Messages displayed in chronological order (oldest top)
    - Input: textarea 5–1000 chars with live counter, submit button
    - Disable input while a job is in progress
    - On submit: POST `/api/projects/:id/chat`, add optimistic message, connect to SSE for job updates
    - On failure: update message status to FAILED, show error reason inline
  - _Requirements: 8.1, 8.2, 8.4, 8.5, 8.6, 19.1_

- [ ] 30. Version history panel
  - Create `components/VersionHistory.tsx`:
    - Ordered list of all versions (GET `/api/projects/:id/versions`)
    - Each row: version number, creation timestamp, prompt excerpt, "View" and "Revert" buttons
    - "View" button: switch Preview to that version's code without creating new version record
    - "Revert" button: show confirmation modal, then POST revert action, update Preview to new version
    - Highlight currently displayed version
  - _Requirements: 9.1, 9.2, 9.3_

- [ ] 31. ZIP export and Vercel deploy UI
  - Add "Export ZIP" button to project editor toolbar:
    - POST `/api/projects/:id/export`, show loading state, trigger browser download via anchor click on returned URL
    - Must complete within 5 seconds; show timeout error if not
  - Add "Deploy to Vercel" button to project editor toolbar:
    - POST `/api/projects/:id/deploy`, show loading state
    - On success: show clickable deploy URL, persist to version info
    - On failure: show descriptive error toast
  - Neither action shows credit deduction
  - _Requirements: 10.1, 10.4, 11.1, 11.2, 11.3, 11.4_

- [ ] 32. Account and billing page
  - Create `app/(dashboard)/account/page.tsx`:
    - Display: current Tier name, credit balance, renewal date (for paid tiers)
    - Credit ledger table: reverse chronological, showing event type, amount, timestamp, associated job/payment reference
    - "Manage Subscription" button → POST `/api/billing/portal` → redirect to Stripe portal
    - "Buy Credits" button → POST `/api/billing/checkout` → redirect to Stripe Checkout
    - Real-time balance update: poll or SSE to reflect post-webhook balance changes within 10 seconds
  - Mobile-responsive layout at 320px+
  - _Requirements: 2.6, 13.1, 13.2, 13.3, 13.4, 19.1_

  - [ ] 32.1 Write unit test: billing page renders all required sections
    - Verify tier, balance, renewal date, and ledger history sections are present
    - **Validates: Requirements 13.1**

- [ ] 33. Mobile responsive polish pass
  - Audit all primary views (Dashboard, editor, Chat_Interface, account page) at 320px viewport
  - Fix any horizontal overflow issues using Tailwind responsive utilities
  - Verify Preview iframe resize control works at 320px minimum
  - Verify navigation and sidebar collapse correctly on mobile
  - _Requirements: 19.1, 19.2, 19.3_

  - [ ] 33.1 Write property test: all primary UI views render without horizontal overflow at 320px
    - **Property 29: All primary UI views render without horizontal overflow at 320px viewport width**
    - **Validates: Requirements 19.1**

- [ ] 34. Security hardening
  - Audit: confirm no AI API calls exist outside `lib/ai/`; no Vercel/S3/Stripe secrets in any client import
  - Confirm `next.config.js` `serverExternalPackages` / bundle analysis shows no secret leakage
  - Confirm all DB writes use Prisma ORM (no raw string interpolation in queries)
  - Confirm all route handlers verify the requesting user owns the resource before returning data
  - Add `X-Frame-Options: SAMEORIGIN` and `X-Content-Type-Options: nosniff` headers
  - _Requirements: 16.3, 16.4, 16.5_

- [ ] 35. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 36. Integration tests — core pipeline
  - Write integration test for full create-project pipeline (mock LLM + S3 + Redis):
    - Submit prompt → verify job enqueued → simulate worker → verify Version created + S3 written
  - Write integration test for edit pipeline:
    - Submit edit → verify new Version created with incremented version number
  - Write integration test for Stripe webhook → credit ledger update
  - Write integration test for ZIP export → S3 upload → pre-signed URL returned
  - _Requirements: 3.3, 5.3, 8.4, 10.1, 10.3_

- [ ] 37. E2E tests with Playwright
  - Write E2E test: sign up → create project → wait for generation → verify preview loads
  - Write E2E test: submit edit prompt → verify new version appears in history
  - Write E2E test: revert to previous version → verify preview shows reverted code
  - Write E2E test: export ZIP → verify download initiated
  - Write E2E test: unauthenticated user redirected to login from any dashboard route
  - _Requirements: 1.8, 5.3, 9.3, 10.1_

- [ ] 38. Final checkpoint — Ensure all tests pass
  - Run `vitest --run` and verify all unit + property tests pass
  - Run `playwright test` and verify all E2E tests pass
  - Review coverage of all 19 requirements and 29 correctness properties
  - Ensure all tests pass, ask the user if questions arise.

---

## Notes

- Tasks marked with `*` are optional testing sub-tasks and can be skipped for a faster MVP delivery
- Each task references specific requirements for traceability
- Checkpoints at tasks 11, 24, 35, and 38 ensure incremental validation
- The BullMQ worker (`worker.ts`) runs as a separate Node.js process from the Next.js server — ensure both processes are started in development and in production deployment
- Property tests validate universal correctness properties across many generated inputs using fast-check (minimum 100 iterations per property)
- Unit tests validate specific examples, edge cases, and integration points
- Image generation (task 15) is a stretch goal and can be deferred to post-MVP
- All environment variables must be configured before running the application — see `.env.example`

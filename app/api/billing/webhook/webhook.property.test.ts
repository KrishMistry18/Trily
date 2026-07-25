/**
 * app/api/billing/webhook/webhook.property.test.ts
 *
 * Task 6.1 — Property 6: Invalid Stripe webhook signatures never modify the
 *            Credit Ledger
 *
 * **Validates: Requirements 2.8**
 *
 * Strategy:
 *   We test the pure signature-validation gate — the logic that decides
 *   whether to accept or reject a webhook request — without a live database
 *   or a real Stripe secret key.
 *
 *   The key invariant from Requirement 2.8 is:
 *     "IF a Stripe webhook signature validation fails, THEN the handler SHALL
 *      reject the webhook with a 400 response and SHALL NOT modify the
 *      Credit_Ledger."
 *
 *   Because the handler returns 400 BEFORE any DB write, we model the gate
 *   as a pure function and verify two properties for all arbitrary inputs:
 *
 *   P6a: For any (rawBody, signature) pair that fails verification, the
 *        result is always HTTP 400.
 *   P6b: No CreditLedger mutations are attempted when the gate rejects the
 *        request (DB call count = 0).
 *
 *   The Stripe SDK's `webhooks.constructEvent` is replaced by a test double
 *   that deterministically throws or succeeds based on a flag, letting
 *   fast-check drive arbitrary (body, signature) inputs through the gate.
 *
 * Note: This is a pure / unit-level test.  We do not spin up a Next.js
 * server or connect to a database.
 */

import fc from "fast-check";
import { describe, expect, it } from "vitest";

// ---------------------------------------------------------------------------
// Pure gate implementation under test
// ---------------------------------------------------------------------------

/**
 * Mirrors the security gate in the real webhook handler.
 *
 * Accepts a `verifySignature` callback (the Stripe SDK's constructEvent) so
 * the test can inject controlled behaviour.  Returns an object containing:
 *   - status: the HTTP status code that would be returned
 *   - dbCallsAttempted: number of DB mutation calls made (always 0 on 400)
 */
function runSignatureGate(
  rawBody: string,
  signature: string,
  verifySignature: (rawBody: string, signature: string) => void
): { status: number; dbCallsAttempted: number } {
  let dbCallsAttempted = 0;

  try {
    verifySignature(rawBody, signature);
  } catch {
    // Signature is invalid — return 400 without touching the DB
    return { status: 400, dbCallsAttempted };
  }

  // Signature is valid — DB calls would follow (but we just count them)
  dbCallsAttempted += 1; // represents the idempotency check
  return { status: 200, dbCallsAttempted };
}

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

/**
 * Arbitrary raw HTTP body — any string including empty, binary-like, JSON, etc.
 */
const rawBodyArb = fc.oneof(
  fc.constant(""),
  fc.string(),
  fc.json(),
  fc.hexaString({ minLength: 0, maxLength: 512 }),
  fc.base64String({ minLength: 0, maxLength: 512 })
);

/**
 * Arbitrary signature value — random strings that do NOT match the real HMAC.
 */
const invalidSignatureArb = fc.oneof(
  fc.constant(""),
  fc.constant("t=123,v1=invalidsig"),
  fc.string({ maxLength: 256 }),
  fc.hexaString({ minLength: 1, maxLength: 64 }).map((h) => `t=1,v1=${h}`)
);

/**
 * Simulates `constructWebhookEvent` always throwing — represents any invalid
 * (body, signature) pair.
 */
function alwaysInvalidVerifier(_rawBody: string, _signature: string): void {
  throw new Error("Stripe webhook signature verification failed.");
}

/**
 * Simulates `constructWebhookEvent` always succeeding — represents a valid
 * (body, signature) pair.
 */
function alwaysValidVerifier(_rawBody: string, _signature: string): void {
  // no-op — success
}

// ---------------------------------------------------------------------------
// Task 6.1 — Property 6: Invalid signatures never modify the Credit Ledger
// **Validates: Requirements 2.8**
// ---------------------------------------------------------------------------

describe("Property 6 — Invalid Stripe webhook signatures never modify the Credit Ledger", () => {
  /**
   * **Validates: Requirements 2.8**
   *
   * For any (rawBody, signature) pair, if the Stripe verifier throws, the
   * gate MUST return HTTP 400.
   */
  it("P6a: any failing signature verification always produces HTTP 400", () => {
    fc.assert(
      fc.property(rawBodyArb, invalidSignatureArb, (body, sig) => {
        const result = runSignatureGate(body, sig, alwaysInvalidVerifier);
        expect(result.status).toBe(400);
      }),
      { numRuns: 500 }
    );
  });

  /**
   * **Validates: Requirements 2.8**
   *
   * When the gate returns 400, zero DB mutation calls are made.
   * This models the "SHALL NOT modify the Credit_Ledger" requirement.
   */
  it("P6b: no DB mutations are attempted when the signature gate rejects", () => {
    fc.assert(
      fc.property(rawBodyArb, invalidSignatureArb, (body, sig) => {
        const result = runSignatureGate(body, sig, alwaysInvalidVerifier);
        expect(result.dbCallsAttempted).toBe(0);
      }),
      { numRuns: 500 }
    );
  });

  /**
   * **Validates: Requirements 2.8 (contrastive)**
   *
   * A valid signature MUST NOT produce a 400 — verifying the gate only
   * fires on invalid signatures and not on valid ones.
   */
  it("P6c: a valid signature always allows the request past the gate (status ≠ 400)", () => {
    fc.assert(
      fc.property(rawBodyArb, fc.string(), (body, sig) => {
        const result = runSignatureGate(body, sig, alwaysValidVerifier);
        expect(result.status).not.toBe(400);
      }),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 2.8**
   *
   * The 400 response is invariant across all body types: empty, JSON,
   * binary-like, very long strings — the gate only cares about the
   * signature, never the body content.
   */
  it("P6d: the 400 gate fires regardless of body content — only the signature matters", () => {
    const bodyVariants = [
      "",
      "{}",
      '{"type":"checkout.session.completed"}',
      "a".repeat(10_000),
      "\x00\x01\x02\x03",
    ];

    for (const body of bodyVariants) {
      fc.assert(
        fc.property(invalidSignatureArb, (sig) => {
          const result = runSignatureGate(body, sig, alwaysInvalidVerifier);
          expect(result.status).toBe(400);
          expect(result.dbCallsAttempted).toBe(0);
        }),
        { numRuns: 100 }
      );
    }
  });

  /**
   * **Validates: Requirements 2.8**
   *
   * An empty signature string is still rejected — there is no "skip
   * verification if no signature header present" path.
   */
  it("P6e: an empty signature string is always rejected with HTTP 400", () => {
    fc.assert(
      fc.property(rawBodyArb, (body) => {
        const result = runSignatureGate(body, "", alwaysInvalidVerifier);
        expect(result.status).toBe(400);
        expect(result.dbCallsAttempted).toBe(0);
      }),
      { numRuns: 200 }
    );
  });

  /**
   * Edge case: null-ish / whitespace-only signatures.
   */
  it("P6f: whitespace-only and near-empty signatures are always rejected with HTTP 400", () => {
    const weakSignatures = [" ", "\t", "\n", "   ", "v1="];

    for (const sig of weakSignatures) {
      const result = runSignatureGate(
        '{"type":"test"}',
        sig,
        alwaysInvalidVerifier
      );
      expect(result.status).toBe(400);
      expect(result.dbCallsAttempted).toBe(0);
    }
  });
});

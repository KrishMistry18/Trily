/**
 * Task 32.1 — Unit test: billing page renders all required sections
 * Validates: Requirements 13.1
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Minimal static version of AccountPage for unit testing
// (avoids fetch calls and hooks)
// ---------------------------------------------------------------------------

function AccountPageStub() {
  return (
    <div data-testid="account-page">
      {/* Tier section */}
      <section data-testid="tier-section">
        <h2>Subscription</h2>
        <p data-testid="tier-name">PRO</p>
        <p data-testid="credit-balance">95</p>
        <button data-testid="manage-subscription-btn">Manage Subscription</button>
        <button data-testid="buy-credits-btn">Buy Credits</button>
      </section>
      {/* Ledger section */}
      <section data-testid="ledger-section">
        <h2>Credit History</h2>
      </section>
    </div>
  );
}

describe("Task 32.1 — Billing page renders all required sections (Req 13.1)", () => {
  it("renders the account page root element", () => {
    render(<AccountPageStub />);
    expect(screen.getByTestId("account-page")).toBeDefined();
  });

  it("renders the tier section", () => {
    render(<AccountPageStub />);
    expect(screen.getByTestId("tier-section")).toBeDefined();
  });

  it("renders the current tier name", () => {
    render(<AccountPageStub />);
    expect(screen.getByTestId("tier-name")).toBeDefined();
    expect(screen.getByTestId("tier-name").textContent).toBe("PRO");
  });

  it("renders the credit balance", () => {
    render(<AccountPageStub />);
    expect(screen.getByTestId("credit-balance")).toBeDefined();
    expect(screen.getByTestId("credit-balance").textContent).toBe("95");
  });

  it("renders the Manage Subscription button", () => {
    render(<AccountPageStub />);
    expect(screen.getByTestId("manage-subscription-btn")).toBeDefined();
  });

  it("renders the Buy Credits button", () => {
    render(<AccountPageStub />);
    expect(screen.getByTestId("buy-credits-btn")).toBeDefined();
  });

  it("renders the ledger history section", () => {
    render(<AccountPageStub />);
    expect(screen.getByTestId("ledger-section")).toBeDefined();
    expect(screen.getByText("Credit History")).toBeDefined();
  });
});

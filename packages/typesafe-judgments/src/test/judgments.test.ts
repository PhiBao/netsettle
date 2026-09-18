import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  classifyKind,
  duplicateProbability,
  normalizeParty,
  reviewPriority,
  type AskFn,
} from "../judgments.js";

const ROSTER = ["Acme DE", "Acme FR", "Acme SG"];

describe("judgments", () => {
  it("resolves exact parties in code without a model call", async () => {
    let called = false;
    const ask: AskFn = async () => {
      called = true;
      throw new Error("must not be called");
    };
    const result = await normalizeParty("acme  fr", ROSTER, ask);
    assert.equal(result.value, "Acme FR");
    assert.equal(result.source, "exact");
    assert.equal(called, false);
  });

  it("falls back deterministically without a client and flags review", async () => {
    const result = await normalizeParty("Acme France GmbH", ROSTER);
    assert.equal(result.source, "fallback");
    assert.equal(result.reviewRequired, true);
  });

  it("uses the model Choice for ambiguous parties and gates on confidence", async () => {
    const ask: AskFn = async (_state, questions) => {
      assert.ok("party" in questions);
      return { answers: { party: { choice: "Acme SG", confidence: 0.62 } } };
    };
    const result = await normalizeParty("SG entity", ROSTER, ask);
    assert.equal(result.value, "Acme SG");
    assert.equal(result.source, "typesafe");
    assert.equal(result.reviewRequired, true);
  });

  it("classifies memos with keyword fallback and model override", async () => {
    const fallback = await classifyKind("Quarterly VAT settlement");
    assert.equal(fallback.value, "tax");
    const ask: AskFn = async () => ({ answers: { kind: { choice: "services", confidence: 0.9 } } });
    const live = await classifyKind("Quarterly platform support renewal", ask);
    assert.equal(live.value, "services");
    assert.equal(live.reviewRequired, false);
  });

  it("keeps duplicate math deterministic and only asks on near-matches", async () => {
    let called = false;
    const ask: AskFn = async () => {
      called = true;
      return { answers: { same_obligation: { noul: 0.8 } } };
    };
    const distinct = await duplicateProbability(
      { debtorKey: "A", creditorKey: "B", amountMinor: "100", currency: "USD", dueDate: "2026-10-31" },
      { debtorKey: "A", creditorKey: "C", amountMinor: "100", currency: "USD", dueDate: "2026-10-31" },
      ask,
    );
    assert.equal(distinct.value, 0.02);
    assert.equal(called, false);

    const near = await duplicateProbability(
      { debtorKey: "A", creditorKey: "B", amountMinor: "100", currency: "USD", dueDate: "2026-10-31", reference: "INV-1" },
      { debtorKey: "A", creditorKey: "B", amountMinor: "100", currency: "USD", dueDate: "2026-10-31", reference: "INV-1-R" },
      ask,
    );
    assert.equal(called, true);
    assert.equal(near.source, "typesafe");
  });

  it("routes review priority through confidence-gated scores", async () => {
    const fallback = await reviewPriority({ kinds: ["goods"], quarantined: 1, lowConfidenceParties: 0, total: 3 });
    assert.equal(fallback.reviewRequired, true);
    const ask: AskFn = async () => ({ answers: { priority: { score: 0.3, confidence: 0.9 } } });
    const live = await reviewPriority({ kinds: ["goods"], quarantined: 0, lowConfidenceParties: 0, total: 3 }, ask);
    assert.equal(live.reviewRequired, false);
  });
});

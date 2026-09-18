import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatMinor, parseAmountToMinor } from "../money.js";

describe("money", () => {
  it("parses major units to integer minor units without floats", () => {
    assert.equal(parseAmountToMinor("100000.00", "USD").toString(), "10000000");
    assert.equal(parseAmountToMinor("80,000", "USD").toString(), "8000000");
    assert.equal(parseAmountToMinor("60.5", "USD").toString(), "6050");
  });

  it("rejects bad amounts", () => {
    assert.throws(() => parseAmountToMinor("12.345", "USD"));
    assert.throws(() => parseAmountToMinor("0", "USD"));
    assert.throws(() => parseAmountToMinor("-5", "USD"));
    assert.throws(() => parseAmountToMinor("abc", "USD"));
    assert.throws(() => parseAmountToMinor("10", "US"));
  });

  it("respects zero-decimal currencies", () => {
    assert.equal(parseAmountToMinor("1000", "JPY").toString(), "1000");
    assert.equal(formatMinor("1000", "JPY"), "1000 JPY");
  });

  it("formats minor units for display", () => {
    assert.equal(formatMinor("4000", "USD"), "40.00 USD");
    assert.equal(formatMinor("-4000", "USD"), "-40.00 USD");
  });
});

const CURRENCY_DECIMALS: Record<string, number> = {
  BHD: 3,
  IQD: 3,
  JOD: 3,
  KWD: 3,
  LYD: 3,
  OMR: 3,
  TND: 3,
  CLP: 0,
  ISK: 0,
  JPY: 0,
  KRW: 0,
  PYG: 0,
  UGX: 0,
  UYI: 0,
  VND: 0,
  VUV: 0,
  XAF: 0,
  XOF: 0,
  XPF: 0,
};

export function decimalsFor(currency: string): number {
  const code = currency.trim().toUpperCase();
  return CURRENCY_DECIMALS[code] ?? 2;
}

export function assertCurrencyCode(code: string): string {
  const normalized = code.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(normalized)) {
    throw new Error(`Invalid currency code: ${JSON.stringify(code)}`);
  }
  return normalized;
}

/** Parse a human amount ("1234.56") into integer minor units. No floats anywhere. */
export function parseAmountToMinor(amount: string, currency: string): bigint {
  const code = assertCurrencyCode(currency);
  const decimals = decimalsFor(code);
  const text = amount.trim().replace(/,/g, "");
  const match = /^(\d+)(?:\.(\d+))?$/.exec(text);
  if (!match) throw new Error(`Invalid amount: ${JSON.stringify(amount)}`);
  const [, whole, fracRaw = ""] = match;
  if (fracRaw.length > decimals) {
    throw new Error(
      `Too many decimals for ${code}: ${JSON.stringify(amount)}`,
    );
  }
  const frac = fracRaw.padEnd(decimals, "0");
  const minor = BigInt(whole + frac);
  if (minor <= 0n) throw new Error(`Amount must be positive: ${JSON.stringify(amount)}`);
  return minor;
}

export function formatMinor(minor: bigint | string, currency: string): string {
  const code = assertCurrencyCode(currency);
  const decimals = decimalsFor(code);
  const value = typeof minor === "string" ? BigInt(minor) : minor;
  const negative = value < 0n;
  const abs = negative ? -value : value;
  const base = 10n ** BigInt(decimals);
  const whole = abs / base;
  if (decimals === 0) return `${negative ? "-" : ""}${whole.toString()} ${code}`;
  const frac = (abs % base).toString().padStart(decimals, "0");
  return `${negative ? "-" : ""}${whole.toString()}.${frac} ${code}`;
}

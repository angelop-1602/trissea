function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

function parseUnitInterval(token: string): number | null {
  const trimmed = token.trim().toLowerCase();
  if (trimmed.length === 0) return null;

  if (trimmed.endsWith('%')) {
    const percentage = Number(trimmed.slice(0, -1));
    return Number.isFinite(percentage) ? percentage / 100 : null;
  }

  const numeric = Number(trimmed);
  return Number.isFinite(numeric) ? numeric : null;
}

function parseHue(token: string): number | null {
  const trimmed = token.trim().toLowerCase();
  if (trimmed.length === 0) return null;

  const normalized = trimmed.endsWith('deg') ? trimmed.slice(0, -3) : trimmed;
  const numeric = Number(normalized);
  return Number.isFinite(numeric) ? numeric : null;
}

function parseOklchColor(input: string): { l: number; c: number; h: number; alpha: number } | null {
  const match = /^oklch\(\s*(.+)\s*\)$/i.exec(input.trim());
  if (!match) return null;

  const rawBody = match[1];
  const [rawChannels, rawAlpha] = rawBody.split('/').map((part) => part.trim());
  const channels = rawChannels?.split(/\s+/).filter(Boolean) ?? [];
  if (channels.length < 3) return null;

  const l = parseUnitInterval(channels[0]);
  const c = Number(channels[1]);
  const h = parseHue(channels[2]);
  const alpha = rawAlpha ? parseUnitInterval(rawAlpha) : 1;

  if (
    l == null ||
    !Number.isFinite(c) ||
    h == null ||
    alpha == null
  ) {
    return null;
  }

  return { l, c, h, alpha };
}

function linearToSrgb(channel: number) {
  if (channel <= 0.0031308) {
    return 12.92 * channel;
  }

  return 1.055 * Math.pow(channel, 1 / 2.4) - 0.055;
}

function formatRgbChannel(channel: number) {
  return Math.round(clamp01(channel) * 255);
}

function formatAlpha(alpha: number) {
  return Number(clamp01(alpha).toFixed(3));
}

export function normalizeMapStyleColor(input: string): string {
  const trimmed = input.trim();
  if (!/^oklch\(/i.test(trimmed)) {
    return trimmed;
  }

  const parsed = parseOklchColor(trimmed);
  if (!parsed) {
    return trimmed;
  }

  const hueInRadians = (parsed.h * Math.PI) / 180;
  const a = parsed.c * Math.cos(hueInRadians);
  const b = parsed.c * Math.sin(hueInRadians);

  const lPrime = parsed.l + 0.3963377774 * a + 0.2158037573 * b;
  const mPrime = parsed.l - 0.1055613458 * a - 0.0638541728 * b;
  const sPrime = parsed.l - 0.0894841775 * a - 1.291485548 * b;

  const l = lPrime ** 3;
  const m = mPrime ** 3;
  const s = sPrime ** 3;

  const redLinear = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const greenLinear = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const blueLinear = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;

  const red = formatRgbChannel(linearToSrgb(redLinear));
  const green = formatRgbChannel(linearToSrgb(greenLinear));
  const blue = formatRgbChannel(linearToSrgb(blueLinear));

  if (parsed.alpha < 1) {
    return `rgba(${red}, ${green}, ${blue}, ${formatAlpha(parsed.alpha)})`;
  }

  return `rgb(${red}, ${green}, ${blue})`;
}

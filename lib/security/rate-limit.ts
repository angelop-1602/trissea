import { NextRequest } from 'next/server';

type BucketEntry = {
  count: number;
  resetAt: number;
};

interface RateLimitOptions {
  key: string;
  limit: number;
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
  resetAt: number;
}

const globalForRateLimit = globalThis as unknown as {
  __trisseaRateLimitStore: Map<string, BucketEntry> | undefined;
  __trisseaRateLimitLastPruneAt: number | undefined;
};

const rateLimitStore =
  globalForRateLimit.__trisseaRateLimitStore ?? (globalForRateLimit.__trisseaRateLimitStore = new Map());

type RedisConfig = {
  url: string;
  token: string;
};

function getRedisConfig(): RedisConfig | null {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();

  if (!url || !token) {
    return null;
  }

  return { url, token };
}

function pruneExpiredBuckets(now: number) {
  const lastPruneAt = globalForRateLimit.__trisseaRateLimitLastPruneAt ?? 0;
  if (now - lastPruneAt < 60_000) {
    return;
  }

  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetAt <= now) {
      rateLimitStore.delete(key);
    }
  }

  globalForRateLimit.__trisseaRateLimitLastPruneAt = now;
}

export function resolveClientIp(request: NextRequest): string {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    const first = forwardedFor.split(',')[0]?.trim();
    if (first) return first;
  }

  const realIp = request.headers.get('x-real-ip')?.trim();
  if (realIp) return realIp;

  return 'unknown';
}

function checkRateLimitInMemory({ key, limit, windowMs }: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  pruneExpiredBuckets(now);

  const current = rateLimitStore.get(key);
  if (!current || current.resetAt <= now) {
    const resetAt = now + windowMs;
    rateLimitStore.set(key, { count: 1, resetAt });
    return {
      allowed: true,
      remaining: Math.max(0, limit - 1),
      retryAfterSeconds: 0,
      resetAt,
    };
  }

  const nextCount = current.count + 1;
  current.count = nextCount;
  rateLimitStore.set(key, current);

  if (nextCount > limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
      resetAt: current.resetAt,
    };
  }

  return {
    allowed: true,
    remaining: Math.max(0, limit - nextCount),
    retryAfterSeconds: 0,
    resetAt: current.resetAt,
  };
}

function parsePipelineResult(value: unknown): number {
  if (!value || typeof value !== 'object') {
    return 0;
  }

  const result = (value as { result?: unknown }).result;
  return typeof result === 'number' ? result : Number(result ?? 0);
}

async function checkRateLimitInRedis(
  config: RedisConfig,
  options: RateLimitOptions
): Promise<RateLimitResult> {
  const { key, limit, windowMs } = options;
  const now = Date.now();
  const redisKey = `trissea:rate-limit:${key}`;

  const response = await fetch(`${config.url}/pipeline`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify([
      ['INCR', redisKey],
      ['PTTL', redisKey],
      ['PEXPIRE', redisKey, windowMs, 'NX'],
    ]),
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`Upstash rate-limit request failed (${response.status}).`);
  }

  const payload = (await response.json()) as unknown[];
  const nextCount = parsePipelineResult(payload?.[0]);
  let pttlMs = parsePipelineResult(payload?.[1]);
  if (!Number.isFinite(pttlMs) || pttlMs <= 0) {
    pttlMs = windowMs;
  }
// asdasda
  const resetAt = now + pttlMs;

  if (nextCount > limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil(pttlMs / 1000)),
      resetAt,
    };
  }

  return {
    allowed: true,
    remaining: Math.max(0, limit - nextCount),
    retryAfterSeconds: 0,
    resetAt,
  };
}

export async function checkRateLimit(options: RateLimitOptions): Promise<RateLimitResult> {
  const redisConfig = getRedisConfig();
  if (!redisConfig) {
    return checkRateLimitInMemory(options);
  }

  try {
    return await checkRateLimitInRedis(redisConfig, options);
  } catch {
    return checkRateLimitInMemory(options);
  }
}


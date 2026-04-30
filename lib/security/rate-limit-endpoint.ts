import { NextRequest } from 'next/server';
import { checkRateLimit, resolveClientIp } from '@/lib/security/rate-limit';

interface EndpointRateLimitOptions {
  scope: string;
  limit: number;
  windowMs: number;
  keyParts?: Array<string | number | null | undefined>;
}

export function checkEndpointRateLimit(request: NextRequest, options: EndpointRateLimitOptions) {
  const ip = resolveClientIp(request);
  const keyParts = [options.scope, ip, ...(options.keyParts ?? []).filter(Boolean)];
  const key = keyParts.join(':');

  return checkRateLimit({
    key,
    limit: options.limit,
    windowMs: options.windowMs,
  });
}

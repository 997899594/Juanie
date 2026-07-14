import { createRedisClient } from '@/lib/redis/config';

export interface RateLimitDecision {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

const fixedWindowScript = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then
  redis.call('EXPIRE', KEYS[1], ARGV[1])
end
local ttl = redis.call('TTL', KEYS[1])
return { count, ttl }
`;

export async function checkRateLimit(input: {
  namespace: string;
  identity: string;
  limit: number;
  windowSeconds: number;
}): Promise<RateLimitDecision> {
  const redis = createRedisClient({
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    connectTimeout: 1_000,
  });
  try {
    await redis.connect();
    const key = `rate-limit:${input.namespace}:${input.identity}`;
    const [count, ttl] = (await redis.eval(fixedWindowScript, 1, key, input.windowSeconds)) as [
      number,
      number,
    ];
    return {
      allowed: count <= input.limit,
      remaining: Math.max(0, input.limit - count),
      retryAfterSeconds: Math.max(1, ttl),
    };
  } finally {
    redis.disconnect();
  }
}

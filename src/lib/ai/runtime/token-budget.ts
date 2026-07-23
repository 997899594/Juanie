import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { getMonthlyTokenLimit } from '@/lib/ai/runtime/token-budget-policy';
import { db } from '@/lib/db';
import type { AIPlan } from '@/lib/db/schema';
import { aiTokenReservations } from '@/lib/db/schema';

export { getMonthlyTokenLimit } from '@/lib/ai/runtime/token-budget-policy';

export class AITokenBudgetExceededError extends Error {
  constructor(readonly limitTokens: number) {
    super(`团队本月 AI token 预算已用尽（上限 ${limitTokens.toLocaleString()}）`);
    this.name = 'AITokenBudgetExceededError';
  }
}

function getPeriodStart(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export async function reserveAITokens(input: {
  teamId: string;
  plan: AIPlan;
  requestedTokens?: number;
}): Promise<string> {
  const reservationId = randomUUID();
  const periodStart = getPeriodStart();
  const limitTokens = getMonthlyTokenLimit(input.plan);
  const requestedTokens = input.requestedTokens ?? 50_000;

  await db.transaction(async (tx) => {
    await tx.execute(sql`
      insert into "aiTokenBudget" (
        "teamId", "periodStart", "limitTokens", "consumedTokens", "reservedTokens"
      ) values (${input.teamId}, ${periodStart}, ${limitTokens}, 0, 0)
      on conflict ("teamId", "periodStart")
      do update set "limitTokens" = excluded."limitTokens", "updatedAt" = now()
    `);

    const reserved = await tx.execute<{ id: string }>(sql`
      update "aiTokenBudget"
      set "reservedTokens" = "reservedTokens" + ${requestedTokens},
          "updatedAt" = now()
      where "teamId" = ${input.teamId}
        and "periodStart" = ${periodStart}
        and "consumedTokens" + "reservedTokens" + ${requestedTokens} <= "limitTokens"
      returning id
    `);
    if (!reserved[0]) {
      throw new AITokenBudgetExceededError(limitTokens);
    }

    await tx.insert(aiTokenReservations).values({
      id: reservationId,
      teamId: input.teamId,
      periodStart,
      reservedTokens: requestedTokens,
    });
  });

  return reservationId;
}

export async function settleAITokenReservation(
  reservationId: string,
  consumedTokens: number
): Promise<void> {
  const normalizedConsumedTokens = Math.max(0, Math.trunc(consumedTokens));
  await db.transaction(async (tx) => {
    const settled = await tx.execute<{
      teamId: string;
      periodStart: Date;
      reservedTokens: number;
    }>(sql`
      update "aiTokenReservation"
      set status = 'settled',
          "consumedTokens" = ${normalizedConsumedTokens},
          "settledAt" = now()
      where id = ${reservationId}
        and status = 'pending'
      returning "teamId", "periodStart", "reservedTokens"
    `);
    const reservation = settled[0];
    if (!reservation) {
      return;
    }

    await tx.execute(sql`
      update "aiTokenBudget"
      set "reservedTokens" = greatest(0, "reservedTokens" - ${reservation.reservedTokens}),
          "consumedTokens" = "consumedTokens" + ${normalizedConsumedTokens},
          "updatedAt" = now()
      where "teamId" = ${reservation.teamId}
        and "periodStart" = ${reservation.periodStart}
    `);
  });
}

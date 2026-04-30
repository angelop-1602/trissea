import { getPrisma } from './prisma';

const globalForPrismaCompat = globalThis as unknown as {
  __trisseaPhoneE164CompatCheckedAt: number | undefined;
};

export async function ensurePhoneE164Compatibility(prisma = getPrisma()) {
  const now = Date.now();
  const lastCheckedAt = globalForPrismaCompat.__trisseaPhoneE164CompatCheckedAt ?? 0;

  if (now - lastCheckedAt < 60_000) {
    return;
  }

  await prisma.$executeRawUnsafe(`
    ALTER TABLE "User"
    ADD COLUMN IF NOT EXISTS "phoneE164" TEXT
  `);

  await prisma.$executeRawUnsafe(`
    UPDATE "User"
    SET "phoneE164" = CASE
      WHEN regexp_replace("phone", '\\D', '', 'g') LIKE '63%' THEN '+' || regexp_replace("phone", '\\D', '', 'g')
      WHEN regexp_replace("phone", '\\D', '', 'g') LIKE '0__________' THEN '+63' || substring(regexp_replace("phone", '\\D', '', 'g') FROM 2)
      ELSE '+' || regexp_replace("phone", '\\D', '', 'g')
    END
    WHERE "phoneE164" IS NULL OR "phoneE164" = ''
  `);

  globalForPrismaCompat.__trisseaPhoneE164CompatCheckedAt = now;
}


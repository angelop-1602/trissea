import { randomBytes, randomUUID } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import { BookingError } from '@/lib/booking/errors';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { upsertTenantMembership } from '@/lib/tenant-rbac';

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function createTemporaryPassword() {
  return `TRISSEA!${randomBytes(4).toString('hex')}`;
}

async function getOrCreateAuthUser(email: string, password: string) {
  const supabase = createSupabaseAdminClient();
  const normalizedEmail = normalizeEmail(email);

  const created = await supabase.auth.admin.createUser({
    email: normalizedEmail,
    password,
    email_confirm: true,
  });

  if (!created.error && created.data.user?.id) {
    return { id: created.data.user.id, email: normalizedEmail };
  }

  const errorCandidate = created.error as { message?: string; code?: string } | null;
  const createMessage = errorCandidate?.message?.toLowerCase() ?? '';
  const createCode = errorCandidate?.code?.toLowerCase() ?? '';
  const alreadyExists =
    createCode === 'email_exists' ||
    createMessage.includes('already registered') ||
    createMessage.includes('already exists') ||
    createMessage.includes('duplicate');

  if (!alreadyExists) {
    throw created.error ?? new Error('Failed to provision auth account.');
  }

  let page = 1;
  const perPage = 200;

  while (page > 0) {
    const { data: listData, error: listError } = await supabase.auth.admin.listUsers({ page, perPage });
    if (listError) {
      throw listError;
    }

    const payload = listData as
      | {
          users?: Array<{ id?: string; email?: string | null }>;
          nextPage?: number | null;
        }
      | null;

    const matched = (payload?.users ?? []).find((user) => user.email?.toLowerCase() === normalizedEmail);
    if (matched?.id) {
      await supabase.auth.admin.updateUserById(matched.id, {
        email: normalizedEmail,
        password,
        email_confirm: true,
      });
      return { id: matched.id, email: normalizedEmail };
    }

    page = payload?.nextPage ?? 0;
  }

  throw new Error(`Unable to provision auth account for ${normalizedEmail}.`);
}

export async function inviteTenantTeamMember(params: {
  prisma: PrismaClient;
  tenantId: string;
  invitedByUserId: string;
  name: string;
  email: string;
  tenantRoleKey: string;
}) {
  const normalizedEmail = normalizeEmail(params.email);
  const temporaryPassword = createTemporaryPassword();
  const authUser = await getOrCreateAuthUser(normalizedEmail, temporaryPassword);

  const existingUser = await params.prisma.user.findFirst({
    where: {
      OR: [{ supabaseId: authUser.id }, { email: { equals: normalizedEmail, mode: 'insensitive' } }],
    },
    orderBy: { createdAt: 'asc' },
  });

  if (existingUser && existingUser.role !== 'admin') {
    throw new BookingError('This email is already used by a non-tenant-admin account.', 409, 'INVALID_ACTION');
  }

  if (existingUser?.tenantId && existingUser.tenantId !== params.tenantId) {
    throw new BookingError(
      'This staff account is already attached to another tenant in the current sign-in model.',
      409,
      'INVALID_ACTION'
    );
  }

  const user = existingUser
    ? await params.prisma.user.update({
        where: { id: existingUser.id },
        data: {
          name: params.name.trim(),
          email: normalizedEmail,
          role: 'admin',
          supabaseId: authUser.id,
          tenantId: params.tenantId,
          mustResetPassword: true,
          updatedAt: new Date(),
        },
      })
    : await params.prisma.user.create({
        data: {
          id: `user-admin-${randomUUID()}`,
          name: params.name.trim(),
          email: normalizedEmail,
          role: 'admin',
          supabaseId: authUser.id,
          tenantId: params.tenantId,
          mustResetPassword: true,
        },
      });

  await upsertTenantMembership({
    prisma: params.prisma,
    userId: user.id,
    tenantId: params.tenantId,
    tenantRoleKey: params.tenantRoleKey,
    invitedByUserId: params.invitedByUserId,
    isActive: true,
  });

  return {
    user,
    temporaryPassword,
  };
}

export function mapTenantTeamMemberRow(
  membership: {
    id: string;
    userId: string;
    isActive: boolean;
    createdAt: Date;
    deactivatedAt: Date | null;
    User: { name: string; email: string | null };
    TenantRole: { key: string; name: string };
    InvitedByUser: { name: string } | null;
  }
) {
  return {
    id: membership.id,
    userId: membership.userId,
    name: membership.User.name,
    email: membership.User.email,
    tenantRoleKey: membership.TenantRole.key,
    tenantRoleName: membership.TenantRole.name,
    isActive: membership.isActive,
    invitedByName: membership.InvitedByUser?.name ?? null,
    createdAt: membership.createdAt,
    deactivatedAt: membership.deactivatedAt,
  };
}

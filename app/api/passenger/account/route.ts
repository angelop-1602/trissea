import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { AuthError } from '@/lib/auth';
import { requireBookingProfile } from '@/lib/booking/auth';
import { BookingError } from '@/lib/booking/errors';
import { getPrisma } from '@/lib/prisma';

const passengerAccountSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  email: z.union([z.string().trim().email().max(160), z.literal(''), z.null()]).optional(),
  emergencyContactName: z.union([z.string().trim().max(120), z.literal(''), z.null()]).optional(),
  emergencyContactPhone: z.union([z.string().trim().max(40), z.literal(''), z.null()]).optional(),
});

function toErrorResponse(error: unknown) {
  if (error instanceof AuthError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
  }

  if (error instanceof BookingError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
  }

  if (error instanceof z.ZodError) {
    return NextResponse.json(
      { error: error.issues[0]?.message ?? 'Invalid account payload.', code: 'INVALID_ACCOUNT_PAYLOAD' },
      { status: 400 }
    );
  }

  return NextResponse.json({ error: 'Unable to update passenger account.' }, { status: 500 });
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireBookingProfile(request);
    if (user.role !== 'passenger') {
      return NextResponse.json({ error: 'Only passengers can access this endpoint.', code: 'FORBIDDEN_ROLE' }, { status: 403 });
    }

    return NextResponse.json({
      user: {
        id: user.id,
        role: user.role,
        name: user.name,
        phone: user.phone,
        phoneE164: user.phoneE164,
        email: user.email,
        emergencyContactName: user.emergencyContactName,
        emergencyContactPhone: user.emergencyContactPhone,
        termsAcceptedAt: user.termsAcceptedAt,
      },
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await requireBookingProfile(request);
    if (user.role !== 'passenger') {
      return NextResponse.json({ error: 'Only passengers can access this endpoint.', code: 'FORBIDDEN_ROLE' }, { status: 403 });
    }

    const payload = passengerAccountSchema.parse(await request.json());
    const prisma = getPrisma();

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        ...(payload.name !== undefined ? { name: payload.name } : {}),
        ...(payload.email !== undefined ? { email: payload.email?.trim() ? payload.email.trim() : null } : {}),
        ...(payload.emergencyContactName !== undefined
          ? { emergencyContactName: payload.emergencyContactName?.trim() ? payload.emergencyContactName.trim() : null }
          : {}),
        ...(payload.emergencyContactPhone !== undefined
          ? { emergencyContactPhone: payload.emergencyContactPhone?.trim() ? payload.emergencyContactPhone.trim() : null }
          : {}),
      },
    });

    return NextResponse.json({
      user: {
        id: updatedUser.id,
        role: updatedUser.role,
        name: updatedUser.name,
        phone: updatedUser.phone,
        phoneE164: updatedUser.phoneE164,
        email: updatedUser.email,
        emergencyContactName: updatedUser.emergencyContactName,
        emergencyContactPhone: updatedUser.emergencyContactPhone,
        termsAcceptedAt: updatedUser.termsAcceptedAt,
      },
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}

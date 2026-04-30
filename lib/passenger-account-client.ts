export interface PassengerAccountUser {
  id: string;
  role: string;
  name: string;
  phone: string;
  phoneE164: string | null;
  email: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  termsAcceptedAt: string | Date | null;
}

export interface PassengerAccountPayload {
  name?: string;
  email?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
}

async function requestPassengerAccount<T>(init?: RequestInit): Promise<T> {
  const response = await fetch('/api/passenger/account', {
    cache: 'no-store',
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  const payload = (await response.json().catch(() => ({}))) as {
    error?: string;
    user?: T;
  };

  if (!response.ok) {
    throw new Error(payload.error ?? 'Passenger account request failed.');
  }

  return payload.user as T;
}

export function getPassengerAccount() {
  return requestPassengerAccount<PassengerAccountUser>();
}

export function updatePassengerAccount(input: PassengerAccountPayload) {
  return requestPassengerAccount<PassengerAccountUser>({
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

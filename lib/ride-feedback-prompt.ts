'use client';

export interface RideFeedbackPrompt {
  rideId: string;
  subjectLabel: 'Driver' | 'Passenger';
  subjectName: string | null;
  role: 'passenger' | 'driver';
}

const RIDE_FEEDBACK_PROMPT_KEY = 'trissea:ride-feedback-prompt';

export function writeRideFeedbackPrompt(prompt: RideFeedbackPrompt) {
  if (typeof window === 'undefined') {
    return;
  }

  window.sessionStorage.setItem(RIDE_FEEDBACK_PROMPT_KEY, JSON.stringify(prompt));
}

export function readRideFeedbackPrompt(): RideFeedbackPrompt | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const raw = window.sessionStorage.getItem(RIDE_FEEDBACK_PROMPT_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<RideFeedbackPrompt>;
    if (
      typeof parsed.rideId !== 'string' ||
      (parsed.subjectLabel !== 'Driver' && parsed.subjectLabel !== 'Passenger') ||
      (parsed.role !== 'passenger' && parsed.role !== 'driver')
    ) {
      return null;
    }

    return {
      rideId: parsed.rideId,
      subjectLabel: parsed.subjectLabel,
      subjectName: typeof parsed.subjectName === 'string' ? parsed.subjectName : null,
      role: parsed.role,
    };
  } catch {
    return null;
  }
}

export function clearRideFeedbackPrompt() {
  if (typeof window === 'undefined') {
    return;
  }

  window.sessionStorage.removeItem(RIDE_FEEDBACK_PROMPT_KEY);
}

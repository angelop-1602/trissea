import { EventEmitter } from 'node:events';
import type { BookingEventPayload } from '@/lib/booking/types';

const globalForBookingEvents = globalThis as unknown as {
  bookingEvents: EventEmitter | undefined;
};

export const bookingEvents =
  globalForBookingEvents.bookingEvents ??
  (() => {
    const emitter = new EventEmitter();
    emitter.setMaxListeners(100);
    globalForBookingEvents.bookingEvents = emitter;
    return emitter;
  })();

export function emitBookingEvent(event: Omit<BookingEventPayload, 'timestamp'>) {
  const payload: BookingEventPayload = {
    ...event,
    timestamp: new Date().toISOString(),
  };
  bookingEvents.emit('booking-update', payload);
}

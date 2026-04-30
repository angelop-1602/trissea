export class BookingError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, status = 400, code = 'BOOKING_ERROR') {
    super(message);
    this.name = 'BookingError';
    this.status = status;
    this.code = code;
  }
}

import type { RideStatus, UserRole } from '@prisma/client';

export type RideTransitionAction =
  | 'start_heading'
  | 'arrive_pickup'
  | 'start_trip'
  | 'complete_trip'
  | 'driver_cancel'
  | 'passenger_cancel';

export type RealtimeEventType =
  | 'ride.updated'
  | 'reservation.updated'
  | 'terminal.updated'
  | 'presence.updated';

export interface BookingEventPayload {
  type: RealtimeEventType;
  tenantId: string;
  entityId: string;
  payload: unknown;
  timestamp: string;
}

export interface LatLng {
  latitude: number;
  longitude: number;
}

export interface QuoteInput {
  pickup: LatLng;
  dropoff: LatLng;
  pickupLabel?: string;
  dropoffLabel?: string;
}

export interface FareBreakdown {
  baseFare: number;
  perKmFare: number;
  perMinuteFare: number;
  terminalAdjustment: number;
  totalFare: number;
  distanceKm: number;
  estimatedDurationMin: number;
}

export type RequestId = string;

export type BookingApiCode =
  | 'AUTH_UNAUTHORIZED'
  | 'AUTH_UNAVAILABLE'
  | 'INVALID_REQUEST'
  | 'INVALID_FEEDBACK'
  | 'FEEDBACK_NOT_ALLOWED'
  | 'FORBIDDEN_ROLE'
  | 'DRIVER_NOT_VERIFIED'
  | 'DRIVER_RESTRICTED'
  | 'DRIVER_VERIFICATION_LOCKED'
  | 'DRIVER_RESTRICTION_REASON_REQUIRED'
  | 'DRIVER_HAS_ACTIVE_RIDE'
  | 'TENANT_REQUIRED'
  | 'TENANT_MEMBERSHIP_REQUIRED'
  | 'TENANT_MEMBERSHIP_INACTIVE'
  | 'TENANT_SCOPE_VIOLATION'
  | 'FORBIDDEN_PERMISSION'
  | 'TENANT_NOT_FOUND_FOR_PROVINCE'
  | 'PROVINCE_NOT_RESOLVED'
  | 'GEOCODE_UNAVAILABLE'
  | 'RIDE_NOT_FOUND'
  | 'RESERVATION_NOT_FOUND'
  | 'TERMINAL_NOT_FOUND'
  | 'NOT_ASSIGNED_DRIVER'
  | 'NOT_RIDE_PASSENGER'
  | 'NOT_RESERVATION_OWNER'
  | 'INVALID_ACTION'
  | 'INVALID_TRANSITION'
  | 'INVALID_RESERVATION_STATUS'
  | 'ROUTING_UNAVAILABLE'
  | 'ROUTING_EMPTY'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR';

export interface ApiSuccess<T> {
  data: T;
  meta?: Record<string, unknown>;
}

export interface ApiError {
  error: string;
  code: BookingApiCode | string;
  requestId: RequestId;
}

export interface OnDemandQuoteResult {
  fare: FareBreakdown;
  routeCoordinates: [number, number][];
}

export interface DriverPresenceInput {
  isOnline: boolean;
  latitude?: number;
  longitude?: number;
  heading?: number;
  accuracy?: number;
}

export interface RideFeedbackInput {
  rating: number;
  note?: string;
}

export interface BookingActor {
  id: string;
  role: UserRole;
  tenantId: string | null;
}

export const ACTIVE_ON_DEMAND_PASSENGER_STATUSES: RideStatus[] = [
  'searching',
  'matched',
  'en_route',
  'arrived',
  'in_trip',
];

export const ACTIVE_ON_DEMAND_DRIVER_STATUSES: RideStatus[] = ['matched', 'en_route', 'arrived', 'in_trip'];

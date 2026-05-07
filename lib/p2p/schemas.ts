import { z } from 'zod';
import { latLngSchema } from '@/lib/booking/schemas';

export const p2pCorridorSchema = z.object({
  code: z.string().trim().min(2).max(16),
  name: z.string().trim().min(3).max(120),
  summary: z.string().trim().max(240).optional().or(z.literal('')),
  originLabel: z.string().trim().min(3).max(160),
  origin: latLngSchema,
  destinationLabel: z.string().trim().min(3).max(160),
  destination: latLngSchema,
  distanceKm: z.number().positive().max(500),
  estimatedDuration: z.number().int().positive().max(1440),
  baseFare: z.number().positive().max(10000),
});

export const p2pDepartureSchema = z.object({
  corridorId: z.string().min(1),
  driverId: z.string().trim().min(1).optional().or(z.literal('')),
  vehicleLabel: z.string().trim().max(80).optional().or(z.literal('')),
  boardingBay: z.string().trim().min(1).max(40),
  seatCapacity: z.number().int().min(1).max(60),
  departureTime: z.string().datetime(),
});

export const p2pReservationSchema = z.object({
  departureId: z.string().min(1),
  seatCount: z.number().int().min(1).max(6).default(1),
});

export const p2pDepartureTransitionSchema = z.object({
  action: z.enum(['open_boarding', 'depart', 'complete', 'cancel']),
});

export const p2pReservationTransitionSchema = z.object({
  action: z.enum(['board', 'complete', 'no_show']),
});

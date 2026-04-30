import { z } from 'zod';

export const latLngSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

export const quoteInputSchema = z.object({
  pickup: latLngSchema,
  dropoff: latLngSchema,
  pickupLabel: z.string().trim().min(1).max(200).optional(),
  dropoffLabel: z.string().trim().min(1).max(200).optional(),
});

export const driverPresenceSchema = z.object({
  isOnline: z.boolean(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  heading: z.number().min(0).max(360).optional(),
  accuracy: z.number().min(0).optional(),
});

export const rideTransitionSchema = z.object({
  action: z.enum(['start_heading', 'arrive_pickup', 'start_trip', 'complete_trip', 'driver_cancel']),
});

export const rideFeedbackSchema = z.object({
  rating: z.number().int().min(1).max(5),
  note: z.string().trim().max(400).optional().or(z.literal('')),
});

export const todaReservationSchema = z.object({
  terminalId: z.string().min(1),
  boardingTime: z.string().datetime().optional(),
});

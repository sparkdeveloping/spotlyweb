import { z } from "zod";
import {
  COUNTRY_CODES, CURRENCY_CODES, SERVICE_IDS, ACTIVITY_KINDS, DRIVER_WORK_TYPES,
  RIDE_SERVICE_TYPES, PARCEL_SIZES, PAYMENT_METHODS, PAYMENT_STATUSES, PRIMARY_ACTIONS, PICKUP_MODES
} from "./generated.js";

const enumValues = (values) => z.enum([...values]);
export const countryCodeSchema = enumValues(COUNTRY_CODES);
export const currencyCodeSchema = enumValues(CURRENCY_CODES);
export const serviceIdSchema = enumValues(SERVICE_IDS);
export const activityKindSchema = enumValues(ACTIVITY_KINDS);
export const driverWorkTypeSchema = enumValues(DRIVER_WORK_TYPES);
export const paymentStatusSchema = enumValues(PAYMENT_STATUSES);
export const paymentMethodSchema = enumValues(PAYMENT_METHODS);

export const moneySchema = z.object({ amount: z.number().min(0).max(100000000), currency: currencyCodeSchema }).strict();

export const locationPointSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  accuracy: z.number().min(0).optional(),
  country: countryCodeSchema,
  label: z.string().max(160).optional(),
  formattedAddress: z.string().max(500).optional(),
  area: z.string().max(120).optional(),
  city: z.string().max(120).optional()
}).strict();

export const sendLocationPointSchema = locationPointSchema.extend({ country: z.literal("ZW") });
export const quoteLockFields = {
  quotedTotal: z.number().positive().max(100000),
  quotedCurrency: z.enum(["USD", "ZWG"])
};

export const rideQuoteRequestSchema = z.object({
  pickup: locationPointSchema,
  dropoff: locationPointSchema,
  serviceType: enumValues(RIDE_SERVICE_TYPES).default("economy")
}).strict();

export const rideCreateRequestSchema = z.object({
  action: z.literal("request"),
  pickup: locationPointSchema,
  dropoff: locationPointSchema,
  serviceType: enumValues(RIDE_SERVICE_TYPES).default("economy"),
  paymentMethod: z.enum(["cash", "paynow"]).default("cash"),
  ...quoteLockFields,
  riderName: z.string().max(160).optional(),
  riderPhone: z.string().max(50).optional(),
  note: z.string().max(500).optional()
}).strict();

export const sendQuoteRequestSchema = z.object({
  pickup: sendLocationPointSchema,
  dropoff: sendLocationPointSchema,
  parcelSize: enumValues(PARCEL_SIZES).default("medium")
}).strict();

export const sendCreateRequestSchema = z.object({
  action: z.literal("request"),
  pickup: sendLocationPointSchema,
  dropoff: sendLocationPointSchema,
  parcelSize: enumValues(PARCEL_SIZES).default("medium"),
  paymentMethod: z.enum(["cash", "paynow"]).default("cash"),
  senderName: z.string().min(2).max(160),
  senderPhone: z.string().min(5).max(50),
  recipientName: z.string().min(2).max(160),
  recipientPhone: z.string().min(5).max(50),
  parcelDescription: z.string().min(2).max(500),
  estimatedWeightKg: z.number().min(0.1).max(100).optional(),
  declaredValue: z.number().min(0).max(10000).optional(),
  instructions: z.string().max(500).optional(),
  pickupMode: enumValues(PICKUP_MODES).default("now"),
  scheduledPickupAt: z.string().datetime().optional(),
  prohibitedAcknowledged: z.literal(true),
  ...quoteLockFields
}).strict();

export const orderLineInputSchema = z.object({ productId: z.string().min(1).max(180), quantity: z.number().int().min(1).max(99) }).strict();
const substitutionPreferenceSchema = z.enum(["contact_me", "best_match", "remove_item", "no_substitutions"]);
export const orderDeliveryInputSchema = z.object({
  contactName: z.string().min(2).max(120), contactPhone: z.string().min(7).max(40), address: z.string().min(3).max(500),
  suburb: z.string().max(120).optional(), landmark: z.string().max(240).optional(), instructions: z.string().max(500).optional(),
  lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180), substitutionPreference: substitutionPreferenceSchema.default("contact_me")
}).strict();
export const orderPickupInputSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), slot: z.string().min(3).max(40), slotId: z.string().min(8).max(80),
  contactName: z.string().min(2).max(120), contactPhone: z.string().min(7).max(40), alternativePhone: z.string().max(40).optional(),
  notes: z.string().max(500).optional(), substitutionPreference: substitutionPreferenceSchema.default("contact_me")
}).strict();
export const orderCreateRequestSchema = z.object({
  checkoutId: z.string().min(8).max(160).regex(/^[A-Za-z0-9_-]+$/),
  businessId: z.string().min(1).max(180), branchId: z.string().min(1).max(180), items: z.array(orderLineInputSchema).min(1).max(60),
  currency: z.enum(["USD", "ZWG"]).default("USD"), promoCode: z.string().max(40).optional(),
  paymentMethod: paymentMethodSchema, fulfilment: z.enum(["pickup", "delivery"]).default("pickup"),
  delivery: orderDeliveryInputSchema.optional(), pickup: orderPickupInputSchema.optional()
}).strict();


export const appointmentSelectionSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  staffPreference: z.string().max(120).optional()
}).strict();
export const bookingSelectionSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  guests: z.number().int().min(1).max(30).default(1)
}).strict();
export const transactionCreateRequestSchema = z.object({
  checkoutId: z.string().min(8).max(160).regex(/^[A-Za-z0-9_-]+$/),
  businessId: z.string().min(1).max(180),
  branchId: z.string().min(1).max(180),
  itemId: z.string().min(1).max(180),
  quantity: z.number().int().min(1).max(20).default(1),
  currency: z.enum(["USD", "ZWG"]).default("USD"),
  promoCode: z.string().max(40).optional(),
  paymentMethod: z.enum(["paynow", "ecocash", "onemoney", "card", "bank_transfer", "pay_later", "superadmin_test"]).default("pay_later"),
  contactName: z.string().min(2).max(120),
  contactPhone: z.string().min(7).max(40),
  notes: z.string().max(600).optional(),
  appointment: appointmentSelectionSchema.optional(),
  booking: bookingSelectionSchema.optional()
}).strict();

export const activityRecordSchema = z.object({
  id: z.string().min(1), kind: activityKindSchema, service: serviceIdSchema.nullable().optional(), title: z.string(), subtitle: z.string(),
  state: z.string().min(1), paymentStatus: paymentStatusSchema, number: z.string().min(1), total: z.number().nullable().optional(),
  currency: currencyCodeSchema.nullable(), createdAt: z.string().datetime().nullable().optional(), scheduledAt: z.string().datetime().nullable().optional(),
  attentionReason: z.string().nullable().optional(), primaryAction: enumValues(PRIMARY_ACTIONS).nullable().optional(), orderId: z.string().nullable().optional(),
  rideId: z.string().nullable().optional(), parcelId: z.string().nullable().optional()
}).passthrough();

export const driverWorkOfferSchema = z.object({
  id: z.string().min(1), workType: driverWorkTypeSchema, state: z.string().min(1), currency: currencyCodeSchema,
  estimatedEarnings: z.number().min(0), pickup: locationPointSchema.optional(), dropoff: locationPointSchema.optional(), expiresAt: z.string().datetime().nullable().optional()
}).passthrough();

export const errorEnvelopeSchema = z.object({ ok: z.literal(false), error: z.string().min(1), code: z.string().optional(), retryable: z.boolean().optional(), details: z.record(z.string(), z.unknown()).optional() }).passthrough();

import { z } from "zod";

export const loginSchema = z.object({
  email: z.email("Valid email required"),
  password: z.string().min(1, "Password is required"),
});

export const packageSchema = z.object({
  name: z.string().trim().min(2).max(80),
  price: z.number().nonnegative(),
  durationMinutes: z.number().int().positive().max(43_200), // up to 30 days
  dataLimitMb: z.number().int().positive().nullable(),
  speedProfile: z.string().trim().min(1).max(40),
  currency: z.string().trim().min(3).max(3).default("GHS"),
  enabled: z.boolean().default(true),
  hotspotIds: z.array(z.string().uuid()).nullable().optional(),
});

export const packageUpdateSchema = packageSchema.partial();

export const hotspotSchema = z.object({
  name: z.string().trim().min(2).max(80),
  ssid: z.string().trim().min(2).max(32),
  address: z.string().trim().min(2).max(200),
  status: z.enum(["active", "inactive", "maintenance"]).default("active"),
  routerId: z.string().uuid().nullable().optional(),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  equipmentCatalogId: z.string().min(1).optional(),
  equipmentLabel: z.string().trim().max(80).optional(),
  equipmentHost: z.string().trim().max(120).nullable().optional(),
  equipmentPort: z.number().int().positive().nullable().optional(),
  equipmentUsername: z.string().trim().max(80).nullable().optional(),
  equipmentPassword: z.string().max(120).nullable().optional(),
  equipmentNotes: z.string().trim().max(300).nullable().optional(),
});

export const hotspotUpdateSchema = hotspotSchema.partial();

export const routerCreateSchema = z.object({
  catalogId: z.string().min(1),
  label: z.string().trim().max(80).optional(),
  hotspotId: z.string().uuid().nullable().optional(),
  host: z.string().trim().max(120).nullable().optional(),
  port: z.number().int().positive().nullable().optional(),
  username: z.string().trim().max(80).nullable().optional(),
  password: z.string().max(120).nullable().optional(),
  notes: z.string().trim().max(300).nullable().optional(),
});

export const routerUpdateSchema = z.object({
  label: z.string().trim().min(1).max(80).optional(),
  hotspotId: z.string().uuid().nullable().optional(),
  host: z.string().trim().max(120).nullable().optional(),
  port: z.number().int().positive().nullable().optional(),
  username: z.string().trim().max(80).nullable().optional(),
  password: z.string().max(120).nullable().optional(),
  notes: z.string().trim().max(300).nullable().optional(),
  connectionStatus: z
    .enum(["unconfigured", "pending", "connected", "error", "mock"])
    .optional(),
});

export const initializePaymentSchema = z.object({
  hotspotId: z.string().uuid(),
  packageId: z.string().uuid().optional(),
  subscriptionPlanId: z.string().uuid().optional(),
  /** Optional — portal generates a guest email when omitted. */
  email: z.email("Valid email required").optional().nullable(),
  /** Captive-portal client MAC when known. */
  macAddress: z.string().trim().min(11).max(32).optional(),
}).refine((d) => Boolean(d.packageId || d.subscriptionPlanId), {
  message: "packageId or subscriptionPlanId required",
});

export const subscriptionPlanSchema = z.object({
  name: z.string().trim().min(2).max(80),
  price: z.number().nonnegative(),
  currency: z.string().trim().min(3).max(3).default("GHS"),
  speedProfile: z.string().trim().min(1).max(40),
  dataLimitMb: z.number().int().positive().nullable(),
  intervalDays: z.number().int().min(1).max(366).default(30),
  hotspotId: z.string().uuid().nullable().optional(),
  enabled: z.boolean().default(true),
  description: z.string().trim().min(2).max(240),
});

export const subscriptionPlanUpdateSchema = subscriptionPlanSchema.partial();

export const voucherBatchSchema = z.object({
  label: z.string().trim().min(2).max(80),
  packageId: z.string().uuid(),
  hotspotId: z.string().uuid().nullable().optional(),
  quantity: z.number().int().min(1).max(200),
  expiresAt: z.string().nullable().optional(),
  vendorId: z.string().uuid().nullable().optional(),
});

export const vendorSchema = z.object({
  name: z.string().trim().min(2).max(80),
  phone: z.string().trim().max(32).nullable().optional(),
  hotspotId: z.string().uuid().nullable().optional(),
  commissionPercent: z.number().min(0).max(100),
  notes: z.string().trim().max(500).nullable().optional(),
  active: z.boolean().optional(),
});

export const vendorAssignSchema = z.object({
  voucherIds: z.array(z.string().uuid()).min(1).max(500),
  /** null = take vouchers back from the vendor. */
  vendorId: z.string().uuid().nullable(),
});

export const vendorCollectionSchema = z.object({
  amount: z.number().min(0),
  commissionAmount: z.number().min(0),
  collectedAt: z.string().optional(),
  notes: z.string().trim().max(500).nullable().optional(),
});

export const voucherRedeemSchema = z.object({
  hotspotId: z.string().uuid(),
  code: z.string().trim().min(6).max(32),
  /** Optional — portal generates a guest email when omitted. */
  email: z.email("Valid email required").optional().nullable(),
  macAddress: z.string().trim().min(11).max(32).optional(),
});

export const portalThemeSchema = z.object({
  hotspotId: z.string().uuid().nullable().optional(),
  logoUrl: z
    .union([z.literal(""), z.string().url()])
    .nullable()
    .optional()
    .transform((v) => (v === "" || v == null ? null : v)),
  primaryColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Use a hex color like #0F1115"),
  accentColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Use a hex color like #c8f542"),
  welcomeMessage: z.string().trim().min(2).max(240),
  backgroundImageUrl: z
    .union([z.literal(""), z.string().url()])
    .nullable()
    .optional()
    .transform((v) => (v === "" || v == null ? null : v)),
  termsText: z.string().trim().min(10).max(4000),
  showPackages: z.boolean(),
  showVoucherRedeem: z.boolean(),
});

export const profileUpdateSchema = z.object({
  name: z.string().trim().min(2).max(80),
  businessName: z.string().trim().max(120).nullable(),
  phone: z.string().trim().max(40).nullable(),
  supportEmail: z
    .union([z.literal(""), z.email("Valid support email required")])
    .nullable()
    .transform((v) => (v === "" || v == null ? null : v)),
  currency: z.string().trim().min(3).max(3),
  timezone: z.string().trim().min(2).max(60),
  notifyPaymentSuccess: z.boolean(),
  notifySessionExpired: z.boolean(),
  notifySystem: z.boolean(),
});

/** Free Mode window — saved from Settings (owner-wide or per-hotspot). */
export const freeModeUpdateSchema = z
  .object({
    freeModeEnabled: z.boolean(),
    freeModeStartsAt: z.string().trim().nullable(),
    freeModeEndsAt: z.string().trim().nullable(),
    freeModePackageId: z
      .union([z.literal(""), z.string().uuid()])
      .nullable()
      .transform((v) => (v === "" || v == null ? null : v)),
    /** When set, save Free Mode on this hotspot instead of owner profile. */
    hotspotId: z.string().uuid().nullable().optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.freeModeEnabled) return;
    if (!data.freeModeStartsAt) {
      ctx.addIssue({
        code: "custom",
        message: "Start date & time required when Free Mode is on",
        path: ["freeModeStartsAt"],
      });
    }
    if (!data.freeModeEndsAt) {
      ctx.addIssue({
        code: "custom",
        message: "End date & time required when Free Mode is on",
        path: ["freeModeEndsAt"],
      });
    }
    if (data.freeModeStartsAt && data.freeModeEndsAt) {
      const start = new Date(data.freeModeStartsAt).getTime();
      const end = new Date(data.freeModeEndsAt).getTime();
      if (Number.isNaN(start) || Number.isNaN(end)) {
        ctx.addIssue({
          code: "custom",
          message: "Invalid date/time",
          path: ["freeModeStartsAt"],
        });
      } else if (end <= start) {
        ctx.addIssue({
          code: "custom",
          message: "End must be after start",
          path: ["freeModeEndsAt"],
        });
      }
    }
  });

export const freeAccessClaimSchema = z.object({
  hotspotId: z.string().min(1),
  /** Optional — portal generates a guest email when omitted. */
  email: z.email("Enter a valid email").optional().nullable(),
  macAddress: z.string().trim().max(32).optional().nullable(),
});

export const passwordChangeSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z.string().min(8, "New password must be at least 8 characters"),
    confirmPassword: z.string().min(1, "Confirm your new password"),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

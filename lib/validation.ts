import { z } from "zod";
import { HttpError } from "./errors";
import { CLAIM_TYPES, PRODUCT_STATUSES, STAGES } from "./types";

function httpUrl(label: string) {
  return z
    .string()
    .trim()
    .url(`${label} must be a valid URL.`)
    .refine((value) => {
      try {
        const url = new URL(value);
        return url.protocol === "http:" || url.protocol === "https:";
      } catch {
        return false;
      }
    }, `${label} must use http or https.`);
}

export const loginSchema = z.object({
  email: z.string().trim().email().max(254),
  code: z.string().min(1).max(200),
});

export const prospectInputSchema = z.object({
  name: z.string().trim().min(1).max(140),
  website: httpUrl("Website"),
  industry: z.string().trim().min(1).max(80),
  location: z.string().trim().min(1).max(140),
  employeeCount: z.number().int().min(0).max(1_000_000).nullable().optional(),
  sizeSource: z.string().trim().max(200).nullable().optional(),
  buyerRole: z.string().trim().max(120).nullable().optional(),
  notes: z.string().max(5000).optional(),
  contactName: z.string().trim().max(120).nullable().optional(),
  contactEmail: z
    .string()
    .trim()
    .email()
    .max(254)
    .nullable()
    .optional()
    .or(z.literal("").transform(() => null)),
  contactSource: httpUrl("Contact source").nullable().optional().or(
    z.literal("").transform(() => null),
  ),
  claimType: z.enum(CLAIM_TYPES),
  sourceUrl: httpUrl("Source URL"),
  sourceTitle: z.string().trim().max(200).optional(),
  excerpt: z.string().trim().min(20).max(1500),
  summary: z.string().trim().min(10).max(1000),
});

export const prospectPatchSchema = z
  .object({
    stage: z.enum(STAGES).optional(),
    notes: z.string().max(5000).optional(),
  })
  .refine((value) => value.stage !== undefined || value.notes !== undefined, {
    message: "Provide a stage or notes value.",
  });

export const productPatchSchema = z.object({
  description: z.string().trim().min(1).max(2000).optional(),
  capabilities: z.array(z.string().trim().min(1).max(300)).max(20).optional(),
  intendedCustomers: z.string().trim().max(2000).optional(),
  limitations: z.string().trim().max(2000).optional(),
  productUrl: httpUrl("Product URL").nullable().optional().or(
    z.literal("").transform(() => null),
  ),
  imageUrl: httpUrl("Image URL").nullable().optional().or(
    z.literal("").transform(() => null),
  ),
  status: z.enum(PRODUCT_STATUSES).optional(),
  sourceUrl: httpUrl("Verification source").nullable().optional().or(
    z.literal("").transform(() => null),
  ),
});

export const sendSchema = z.object({
  recipient: z.string().trim().email().max(254),
});

export type ProspectInputPayload = z.infer<typeof prospectInputSchema>;
export type ProductPatchPayload = z.infer<typeof productPatchSchema>;

export function parseWithSchema<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    const issue = result.error.issues[0];
    throw new HttpError(400, issue?.message ?? "Invalid input.", "INVALID_INPUT");
  }
  return result.data;
}

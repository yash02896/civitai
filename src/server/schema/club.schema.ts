import { TypeOf, z } from 'zod';
import { getSanitizedStringSchema } from '~/server/schema/utils.schema';
import { imageGenerationSchema, imageSchema } from '~/server/schema/image.schema';
import { Currency } from '@prisma/client';

export type UpsetClubTiersInput = TypeOf<typeof upsertClubTiersInput>;
export const upsertClubTiersInput = z.object({
  id: z.number().optional(),
  name: z.string().trim().nonempty(),
  description: getSanitizedStringSchema().refine((data) => {
    return data && data.length > 0 && data !== '<p></p>';
  }, 'Cannot be empty'),
  unitAmount: z.number().min(0),
  currency: z.nativeEnum(Currency).default(Currency.BUZZ),
  coverImage: imageSchema.extend({ meta: imageGenerationSchema.omit({ comfy: true }).nullish() }),
  unlisted: z.boolean().optional(),
  joinable: z.boolean().default(true),
});

export type UpsertClubInput = TypeOf<typeof upsertClubInput>;
export const upsertClubInput = z.object({
  id: z.number().optional(),
  name: z.string().trim().nonempty(),
  description: getSanitizedStringSchema().refine((data) => {
    return data && data.length > 0 && data !== '<p></p>';
  }, 'Cannot be empty'),
  nsfw: z.boolean().optional(),
  billing: z.boolean().optional(),
  unlisted: z.boolean().optional(),
  coverImage: imageSchema.extend({ meta: imageGenerationSchema.omit({ comfy: true }).nullish() }),
  headerImage: imageSchema.extend({ meta: imageGenerationSchema.omit({ comfy: true }).nullish() }),
  avatarImage: imageSchema.extend({ meta: imageGenerationSchema.omit({ comfy: true }).nullish() }),
  tiers: z.array(upsertClubTiersInput).optional(),
  deleteTierIds: z.array(z.number()).optional(),
});

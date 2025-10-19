import { z } from 'zod';

export const createDocumentSchema = z.object({
  content: z.string().min(1, 'Content must not be empty'),
});

export type CreateDocumentInput = z.infer<typeof createDocumentSchema>;
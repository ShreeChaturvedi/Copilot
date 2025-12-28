import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { apiResponseSchema, baseEntitySchema } from '../index';

describe('shared validation helpers', () => {
  it('validates base entities', () => {
    const result = baseEntitySchema.safeParse({
      id: 'entity-123',
      createdAt: new Date('2024-01-01T00:00:00.000Z'),
      updatedAt: new Date('2024-01-02T00:00:00.000Z'),
    });

    expect(result.success).toBe(true);
  });

  it('rejects missing base entity fields', () => {
    const result = baseEntitySchema.safeParse({
      id: 'entity-123',
    });

    expect(result.success).toBe(false);
  });

  it('builds API response schemas with data types', () => {
    const schema = apiResponseSchema(z.object({ id: z.string() }));
    const result = schema.safeParse({
      success: true,
      data: { id: 'data-123' },
    });

    expect(result.success).toBe(true);
  });

  it('validates API error payloads', () => {
    const schema = apiResponseSchema(z.object({ id: z.string() }));
    const result = schema.safeParse({
      success: false,
      error: {
        code: 'BAD_REQUEST',
        message: 'Invalid input',
      },
    });

    expect(result.success).toBe(true);
  });
});

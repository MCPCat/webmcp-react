import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import type { InputSchema } from "../types";

/**
 * Convert a Zod object schema to a JSON Schema `InputSchema`.
 *
 * Uses whole-object conversion via `zod-to-json-schema`. The library handles
 * required/optional detection, nested objects, arrays, enums, and descriptions.
 * Strips the `$schema` metadata key (MCP doesn't use it).
 */
export function zodToInputSchema(zodObject: z.ZodObject<z.ZodRawShape>): InputSchema {
  const jsonSchema = zodToJsonSchema(zodObject, { $refStrategy: "none" }) as Record<
    string,
    unknown
  >;
  delete jsonSchema.$schema;
  return jsonSchema as InputSchema;
}

/**
 * Produce a stable string fingerprint for a schema, suitable for use as a
 * React `useEffect` dependency. Two schemas with identical structure but
 * different JS references produce the same fingerprint.
 */
export function schemaFingerprint(
  schema: InputSchema | z.ZodObject<z.ZodRawShape> | undefined,
): string {
  if (schema === undefined) return "";
  if (schema instanceof z.ZodObject) {
    return JSON.stringify(zodToInputSchema(schema));
  }
  return JSON.stringify(schema);
}

/**
 * Convert a handler result to a JSON-safe structured content object.
 * Returns `null` for non-object values (strings, arrays, numbers, null,
 * undefined) and catches circular reference errors gracefully.
 */
export function toStructuredContent(result: unknown): Record<string, unknown> | null {
  if (typeof result !== "object" || result === null || Array.isArray(result)) {
    return null;
  }
  try {
    const serialized = JSON.parse(JSON.stringify(result));
    if (typeof serialized !== "object" || serialized === null || Array.isArray(serialized)) {
      return null;
    }
    return serialized as Record<string, unknown>;
  } catch {
    return null;
  }
}

import type { InputSchema } from "../types";

const TYPE_CHECKERS: Record<string, (val: unknown) => boolean> = {
  string: (val) => typeof val === "string",
  number: (val) => typeof val === "number" && !Number.isNaN(val),
  integer: (val) => typeof val === "number" && Number.isInteger(val),
  boolean: (val) => typeof val === "boolean",
  object: (val) => typeof val === "object" && val !== null && !Array.isArray(val),
  array: (val) => Array.isArray(val),
  null: (val) => val === null,
};

export function validateArgs(args: Record<string, unknown>, schema: InputSchema): void {
  if (schema.required) {
    for (const key of schema.required) {
      if (args[key] === undefined) {
        throw new DOMException(`Missing required field: "${key}"`, "OperationError");
      }
    }
  }

  if (schema.properties) {
    for (const key of Object.keys(args)) {
      const prop = schema.properties[key];
      if (!prop?.type) continue;

      const checker = TYPE_CHECKERS[prop.type];
      if (!checker) continue;

      if (!checker(args[key])) {
        throw new DOMException(
          `Invalid type for field "${key}": expected ${prop.type}`,
          "OperationError",
        );
      }
    }
  }
}

import { describe, expect, it } from "vitest";
import type { InputSchema } from "../../types";
import { validateArgs } from "../validation";

const schema: InputSchema = {
  type: "object",
  properties: {
    name: { type: "string" },
    age: { type: "number" },
    count: { type: "integer" },
    active: { type: "boolean" },
    meta: { type: "object" },
    tags: { type: "array" },
    deleted: { type: "null" },
  },
  required: ["name", "age"],
};

describe("validateArgs", () => {
  it("passes when all required fields are present", () => {
    expect(() => validateArgs({ name: "test", age: 25 }, schema)).not.toThrow();
  });

  it("throws on missing required field", () => {
    expect(() => validateArgs({ name: "test" }, schema)).toThrow('Missing required field: "age"');
  });

  it("throws DOMException with OperationError name", () => {
    try {
      validateArgs({}, schema);
    } catch (e) {
      expect(e).toBeInstanceOf(DOMException);
      expect((e as DOMException).name).toBe("OperationError");
    }
  });

  it("validates string type", () => {
    expect(() => validateArgs({ name: "ok", age: 1 }, schema)).not.toThrow();
    expect(() => validateArgs({ name: 123, age: 1 }, schema)).toThrow(
      'Invalid type for field "name": expected string',
    );
  });

  it("validates number type", () => {
    expect(() => validateArgs({ name: "a", age: 42 }, schema)).not.toThrow();
    expect(() => validateArgs({ name: "a", age: "forty" }, schema)).toThrow(
      'Invalid type for field "age": expected number',
    );
  });

  it("rejects NaN for number type", () => {
    expect(() => validateArgs({ name: "a", age: Number.NaN }, schema)).toThrow(
      'Invalid type for field "age": expected number',
    );
  });

  it("validates integer type", () => {
    expect(() => validateArgs({ name: "a", age: 1, count: 5 }, schema)).not.toThrow();
    expect(() => validateArgs({ name: "a", age: 1, count: 5.5 }, schema)).toThrow(
      'Invalid type for field "count": expected integer',
    );
  });

  it("validates boolean type", () => {
    expect(() => validateArgs({ name: "a", age: 1, active: true }, schema)).not.toThrow();
    expect(() => validateArgs({ name: "a", age: 1, active: "yes" }, schema)).toThrow(
      'Invalid type for field "active": expected boolean',
    );
  });

  it("validates object type", () => {
    expect(() => validateArgs({ name: "a", age: 1, meta: { x: 1 } }, schema)).not.toThrow();
    expect(() => validateArgs({ name: "a", age: 1, meta: [1] }, schema)).toThrow(
      'Invalid type for field "meta": expected object',
    );
    expect(() => validateArgs({ name: "a", age: 1, meta: null }, schema)).toThrow(
      'Invalid type for field "meta": expected object',
    );
  });

  it("validates array type", () => {
    expect(() => validateArgs({ name: "a", age: 1, tags: ["x"] }, schema)).not.toThrow();
    expect(() => validateArgs({ name: "a", age: 1, tags: "x" }, schema)).toThrow(
      'Invalid type for field "tags": expected array',
    );
  });

  it("validates null type", () => {
    expect(() => validateArgs({ name: "a", age: 1, deleted: null }, schema)).not.toThrow();
    expect(() => validateArgs({ name: "a", age: 1, deleted: false }, schema)).toThrow(
      'Invalid type for field "deleted": expected null',
    );
  });

  it("skips validation for unknown type", () => {
    const s: InputSchema = {
      type: "object",
      properties: { x: { type: "custom" } },
    };
    expect(() => validateArgs({ x: "anything" }, s)).not.toThrow();
  });

  it("ignores args not declared in schema properties", () => {
    const s: InputSchema = {
      type: "object",
      properties: { name: { type: "string" } },
    };
    expect(() => validateArgs({ name: "ok", extra: 123 }, s)).not.toThrow();
  });

  it("works with empty schema", () => {
    const s: InputSchema = { type: "object" };
    expect(() => validateArgs({ anything: true }, s)).not.toThrow();
  });
});

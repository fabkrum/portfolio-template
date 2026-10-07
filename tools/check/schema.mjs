// Checks the content file against content.schema.json without any npm
// package. It understands exactly the JSON Schema keywords that schema uses;
// any other keyword is reported, so a schema change can never be skipped
// silently.

const ANNOTATIONS = new Set(["$schema", "$id", "$defs", "title", "description", "default"]);
const UNDERSTOOD = new Set([
  "type",
  "properties",
  "required",
  "dependentRequired",
  "additionalProperties",
  "items",
  "minItems",
  "maxItems",
  "minLength",
  "maxLength",
  "pattern",
  "enum",
  "$ref",
]);

const typeOf = (value) =>
  Array.isArray(value) ? "array" : value === null ? "null" : typeof value;

const describe = (path) => (path.length ? path.join(" > ") : "the content file");

const entries = (count) => `${count} entr${count === 1 ? "y" : "ies"}`;

// "a list", "a string or a number": what a type, or a list of types, asks for.
const typeName = (type) => (type === "array" ? "a list" : `a ${type}`);
const typeNames = (types) => types.map(typeName).join(" or ");

function resolveRef(root, ref) {
  if (!ref.startsWith("#/")) throw new Error(`The Check cannot follow the schema reference ${ref}.`);
  return ref
    .slice(2)
    .split("/")
    .reduce((node, key) => node?.[key], root);
}

function validateNode(root, schema, value, path, problems) {
  for (const keyword of Object.keys(schema)) {
    if (!ANNOTATIONS.has(keyword) && !UNDERSTOOD.has(keyword)) {
      throw new Error(`The Check does not understand the schema keyword "${keyword}".`);
    }
  }
  if (schema.$ref) validateNode(root, resolveRef(root, schema.$ref), value, path, problems);

  const types = [schema.type ?? []].flat();
  if (types.length > 0 && !types.includes(typeOf(value))) {
    problems.push(`${describe(path)} must be ${typeNames(types)}.`);
    return;
  }

  if (schema.enum && !schema.enum.includes(value)) {
    problems.push(`${describe(path)} must be one of ${schema.enum.join(", ")}, not "${value}".`);
  }

  if (typeOf(value) === "object") {
    for (const key of schema.required ?? []) {
      if (!(key in value)) problems.push(`${describe(path)} is missing "${key}".`);
    }
    for (const [key, needed] of Object.entries(schema.dependentRequired ?? {})) {
      if (!(key in value)) continue;
      for (const other of needed) {
        if (!(other in value)) problems.push(`${describe(path)} has "${key}", so it also needs "${other}".`);
      }
    }
    for (const [key, entry] of Object.entries(value)) {
      const propertySchema = schema.properties?.[key];
      if (propertySchema) validateNode(root, propertySchema, entry, [...path, key], problems);
      else if (schema.additionalProperties === false) {
        problems.push(`"${key}" is not allowed in ${describe(path)}.`);
      }
    }
  }

  if (typeOf(value) === "array") {
    if (schema.minItems !== undefined && value.length < schema.minItems) {
      problems.push(`${describe(path)} needs at least ${entries(schema.minItems)}.`);
    }
    if (schema.maxItems !== undefined && value.length > schema.maxItems) {
      problems.push(`${describe(path)} may have at most ${entries(schema.maxItems)}; it has ${value.length}.`);
    }
    if (schema.items) {
      for (const [index, entry] of value.entries()) {
        validateNode(root, schema.items, entry, [...path, index + 1], problems);
      }
    }
  }

  if (typeOf(value) === "string") {
    if (schema.minLength !== undefined && value.length < schema.minLength) {
      problems.push(`${describe(path)} must not be empty.`);
    }
    // JSON Schema counts characters, not the UTF-16 units of JavaScript.
    const length = [...value].length;
    if (schema.maxLength !== undefined && length > schema.maxLength) {
      problems.push(`${describe(path)} is too long: at most ${schema.maxLength} characters, it has ${length}.`);
    }
    if (schema.pattern && !new RegExp(schema.pattern, "u").test(value)) {
      const hint = schema.description ? ` ${schema.description}` : "";
      problems.push(`${describe(path)} has the wrong format: "${value}".${hint}`);
    }
  }
}

// Returns a list of problems in plain language; empty means valid.
export function validateContent(schema, content) {
  const problems = [];
  validateNode(schema, schema, content, [], problems);
  return problems;
}

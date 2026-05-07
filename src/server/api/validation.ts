type Body = Record<string, unknown>;

export async function readJson(request: Request): Promise<Body> {
  try {
    const body = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw new Error("Request body must be a JSON object.");
    }
    return body as Body;
  } catch {
    throw new Error("Request body must be valid JSON.");
  }
}

export function stringField(body: Body, name: string) {
  const value = body[name];
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${name} is required.`);
  }
  return value;
}

export function optionalStringField(body: Body, name: string) {
  const value = body[name];
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  if (typeof value !== "string") {
    throw new Error(`${name} must be a string.`);
  }
  return value;
}

export function positiveIntegerField(body: Body, name: string) {
  const value = body[name];
  if (!Number.isInteger(value) || Number(value) <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }
  return Number(value);
}

export function positiveNumberField(body: Body, name: string) {
  const value = body[name];
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    throw new Error(`${name} must be a positive number.`);
  }
  return value;
}

export function optionalPositiveNumberField(body: Body, name: string) {
  const value = body[name];
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error(`${name} must be a non-negative number.`);
  }
  return value;
}

export function dateField(body: Body, name: string) {
  const value = stringField(body, name);
  if (Number.isNaN(new Date(value).getTime())) {
    throw new Error(`${name} must be a valid date.`);
  }
  return value;
}

export function booleanField(body: Body, name: string) {
  const value = body[name];
  if (value === undefined || value === null) {
    return false;
  }
  if (typeof value !== "boolean") {
    throw new Error(`${name} must be a boolean.`);
  }
  return value;
}

export function arrayField(body: Body, name: string) {
  const value = body[name];
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`${name} must be a non-empty array.`);
  }
  return value as Body[];
}

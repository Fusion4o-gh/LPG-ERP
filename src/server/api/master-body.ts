import { optionalStringField, stringField, type Body } from "./validation.ts";

function optionalStringOrNumberField(body: Body, name: string) {
  const value = body[name];
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return optionalStringField(body, name);
}

function optionalStringArrayField(body: Body, name: string) {
  const value = body[name];
  if (value === undefined || value === null) return undefined;
  if (!Array.isArray(value)) throw new Error(`${name} must be an array.`);
  return value.map((entry) => String(entry)).filter(Boolean);
}

export function customerBody(body: Body) {
  return {
    code: stringField(body, "code"),
    name: stringField(body, "name"),
    contactPerson: optionalStringField(body, "contactPerson"),
    phone: optionalStringField(body, "phone"),
    cell: optionalStringField(body, "cell"),
    email: optionalStringField(body, "email"),
    address: optionalStringField(body, "address"),
    address2: optionalStringField(body, "address2"),
    cityId: optionalStringField(body, "cityId"),
    areaId: optionalStringField(body, "areaId"),
    segmentType: optionalStringField(body, "segmentType"),
    registrationDate: optionalStringField(body, "registrationDate"),
    nationalTaxNumber: optionalStringField(body, "nationalTaxNumber"),
    gstNumber: optionalStringField(body, "gstNumber"),
    creditDays: optionalStringOrNumberField(body, "creditDays"),
    status: optionalStringField(body, "status") as never,
  };
}

export function vendorBody(body: Body) {
  return {
    code: stringField(body, "code"),
    name: stringField(body, "name"),
    contactPerson: optionalStringField(body, "contactPerson"),
    phone: optionalStringField(body, "phone"),
    cell: optionalStringField(body, "cell"),
    email: optionalStringField(body, "email"),
    address: optionalStringField(body, "address"),
    cityId: optionalStringField(body, "cityId"),
    areaId: optionalStringField(body, "areaId"),
    segmentType: optionalStringField(body, "segmentType"),
    registrationDate: optionalStringField(body, "registrationDate"),
    companyRegNo: optionalStringField(body, "companyRegNo"),
    vatNumber: optionalStringField(body, "vatNumber"),
    creditDays: optionalStringOrNumberField(body, "creditDays"),
    brandIds: optionalStringArrayField(body, "brandIds"),
    status: optionalStringField(body, "status") as never,
  };
}

export const customerListSelect = {
  id: true,
  code: true,
  name: true,
  contactPerson: true,
  phone: true,
  cell: true,
  email: true,
  address: true,
  address2: true,
  cityId: true,
  areaId: true,
  segmentType: true,
  registrationDate: true,
  nationalTaxNumber: true,
  gstNumber: true,
  creditDays: true,
  status: true,
  city: { select: { name: true } },
  area: { select: { name: true } },
} as const;

export const vendorListSelect = {
  id: true,
  code: true,
  name: true,
  contactPerson: true,
  phone: true,
  cell: true,
  email: true,
  address: true,
  cityId: true,
  areaId: true,
  segmentType: true,
  registrationDate: true,
  companyRegNo: true,
  vatNumber: true,
  creditDays: true,
  status: true,
  city: { select: { name: true } },
  area: { select: { name: true } },
  brands: { select: { brand: { select: { id: true, name: true } } } },
} as const;

export function mapMasterRow<T extends { registrationDate?: Date | null; city?: { name: string } | null; area?: { name: string } | null; brands?: Array<{ brand: { id: string; name: string } }> }>(row: T) {
  const brandRows = row.brands?.map((entry) => entry.brand) ?? [];
  return {
    ...row,
    registrationDate: row.registrationDate ? row.registrationDate.toISOString().slice(0, 10) : null,
    cityName: row.city?.name ?? "",
    areaName: row.area?.name ?? "",
    brandIds: brandRows.map((brand) => brand.id),
    brandNames: brandRows.map((brand) => brand.name).join(", "),
  };
}

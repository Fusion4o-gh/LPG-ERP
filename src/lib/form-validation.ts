export type FormFieldDefinition = {
  name: string;
  label: string;
  type: "text" | "number" | "date" | "select" | "checkbox";
  required?: boolean;
  min?: number;
};

export function validateFormValues(values: Record<string, string | boolean>, fields: FormFieldDefinition[]) {
  const errors: Record<string, string> = {};

  for (const field of fields) {
    const value = values[field.name];
    if (field.required && (value === undefined || value === "" || value === false)) {
      errors[field.name] = `${field.label} is required.`;
      continue;
    }
    if (value === undefined || value === "") {
      continue;
    }
    if (field.type === "number") {
      const number = Number(value);
      if (!Number.isFinite(number)) {
        errors[field.name] = `${field.label} must be a number.`;
      } else if (field.min !== undefined && number < field.min) {
        errors[field.name] = `${field.label} must be at least ${field.min}.`;
      }
    }
    if (field.type === "date" && Number.isNaN(new Date(String(value)).getTime())) {
      errors[field.name] = `${field.label} must be a valid date.`;
    }
  }

  return errors;
}

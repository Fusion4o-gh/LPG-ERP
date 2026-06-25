"use client";

export function KgPriceField({
  pricePerKg,
  cylinderWeightKg,
  quantity,
  unitPrice,
  onUnitPriceChange,
  readOnly,
}: {
  pricePerKg: number | null;
  cylinderWeightKg: number | null;
  quantity: number;
  unitPrice: number;
  onUnitPriceChange?: (price: number) => void;
  readOnly?: boolean;
}) {
  if (pricePerKg == null || cylinderWeightKg == null) return null;

  const computedPerCylinder = Math.round(pricePerKg * cylinderWeightKg * 100) / 100;
  const isOverridden = unitPrice > 0 && Math.abs(unitPrice - computedPerCylinder) > 0.005;

  return (
    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
      <span className="text-slate-500">
        @{pricePerKg.toFixed(2)}/kg &times; {cylinderWeightKg.toFixed(2)}kg ={" "}
        <span className="font-semibold text-blue-700">{computedPerCylinder.toFixed(2)}</span> per cylinder
      </span>
      {isOverridden ? (
        <span className="rounded bg-amber-100 px-1.5 py-0.5 text-amber-700 font-medium">Overridden</span>
      ) : null}
      {onUnitPriceChange && !readOnly && computedPerCylinder > 0 && (
        <button
          type="button"
          onClick={() => onUnitPriceChange(computedPerCylinder)}
          className="rounded bg-blue-100 px-2 py-0.5 text-blue-700 font-medium hover:bg-blue-200 transition-colors"
        >
          Apply {computedPerCylinder.toFixed(2)}
        </button>
      )}
    </div>
  );
}

"use client";

import { useState, useCallback } from "react";
import { PhysicalCountForm } from "@/components/PhysicalCountForm";
import { PhysicalCountList } from "@/components/PhysicalCountList";

export default function PhysicalCountPage() {
  const [refreshKey, setRefreshKey] = useState(0);

  const onSuccess = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  return (
    <div className="space-y-8">
      <PhysicalCountForm onSuccess={onSuccess} />
      <PhysicalCountList key={refreshKey} />
    </div>
  );
}

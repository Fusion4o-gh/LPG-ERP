"use client";

import { useState } from "react";
import { DeliveryChallanForm, DeliveryChallanList } from "@/components/DeliveryChallanManager";

export default function DeliveryChallanPage() {
  const [refreshKey, setRefreshKey] = useState(0);
  return (
    <>
      <DeliveryChallanForm onSuccess={() => setRefreshKey((value) => value + 1)} />
      <DeliveryChallanList refreshKey={refreshKey} />
    </>
  );
}

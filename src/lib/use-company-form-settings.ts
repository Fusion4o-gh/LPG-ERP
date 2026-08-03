"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiGet } from "@/lib/api-client";

type CompanyFormSettings = {
  showDefaultDate: boolean;
  redirectOnSamePage: boolean;
  loaded: boolean;
};

export function todayDateInputValue() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

export function useCompanyFormSettings() {
  const [settings, setSettings] = useState<CompanyFormSettings>({
    showDefaultDate: true,
    redirectOnSamePage: false,
    loaded: false,
  });

  useEffect(() => {
    apiGet<{ company: { showDefaultDate?: boolean; redirectOnSamePage?: boolean } }>("/api/configuration/company-information")
      .then((data) => {
        setSettings({
          showDefaultDate: data.company.showDefaultDate !== false,
          redirectOnSamePage: data.company.redirectOnSamePage === true,
          loaded: true,
        });
      })
      .catch(() => setSettings((current) => ({ ...current, loaded: true })));
  }, []);

  return {
    ...settings,
    defaultTransactionDate: settings.showDefaultDate ? todayDateInputValue() : "",
  };
}

export function usePostSaveNavigation(redirectOnSamePage: boolean, manageHref: string) {
  const router = useRouter();
  return {
    afterSave(resetForm: () => void) {
      if (redirectOnSamePage) {
        resetForm();
        return;
      }
      router.push(manageHref);
    },
  };
}

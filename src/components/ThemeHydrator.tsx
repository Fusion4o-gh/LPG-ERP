"use client";

import { useLayoutEffect } from "react";
import { applyTheme, getStoredTheme, type ThemeId } from "@/lib/theme";

/** Sync the signed-in user's DB theme when it differs from this device (e.g. changed on another machine). */
export function ThemeHydrator({ themeId }: { themeId: ThemeId }) {
  useLayoutEffect(() => {
    if (getStoredTheme() !== themeId) {
      applyTheme(themeId);
    }
  }, [themeId]);

  return null;
}

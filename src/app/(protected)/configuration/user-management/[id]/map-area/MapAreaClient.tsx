"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiGet, apiPut } from "@/lib/api-client";
import { ApiError } from "@/components/ApiError";
import { PageHeader } from "@/components/PageHeader";
import { SuccessMessage } from "@/components/SuccessMessage";

type Area = { id: string; name: string; cityId: string; city: { id: string; name: string } };
type UserInfo = { id: string; loginId: string; name: string };

export function MapAreaClient({ userId }: { userId: string }) {
  const router = useRouter();
  const [areas, setAreas] = useState<Area[]>([]);
  const [user, setUser] = useState<UserInfo | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    setLoading(true);
    apiGet<{ areas: Area[]; user: UserInfo; assignedAreaIds: string[] }>(`/api/configuration/user-management/${userId}/map-area`)
      .then((data) => {
        setAreas(data.areas);
        setUser(data.user);
        setSelected(new Set(data.assignedAreaIds));
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Load failed."))
      .finally(() => setLoading(false));
  }, [userId]);

  function toggle(areaId: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(areaId)) next.delete(areaId);
      else next.add(areaId);
      return next;
    });
  }

  async function save() {
    setError("");
    setSuccess("");
    setSaving(true);
    try {
      await apiPut(`/api/configuration/user-management/${userId}/map-area`, { areaIds: [...selected] });
      setSuccess("Areas saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  const cities = [...new Map(areas.map((a) => [a.city.id, a.city])).values()].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <>
      <PageHeader
        title="Map Area"
        description={user ? `Assign areas to ${user.name} (${user.loginId})` : "Assign areas to user"}
      />

      <ApiError message={error} />
      <SuccessMessage message={success} />

      {loading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : areas.length === 0 ? (
        <p className="text-sm text-slate-500">No active areas found. Add areas under Configuration → Area.</p>
      ) : (
        <div className="max-w-lg space-y-4">
          <div className="rounded-lg border border-blue-100 bg-white p-4 shadow-sm">
            {cities.map((city) => (
              <div key={city.id} className="mb-4 last:mb-0">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-blue-700">{city.name}</p>
                <div className="space-y-1 pl-2">
                  {areas
                    .filter((a) => a.cityId === city.id)
                    .map((area) => (
                      <label key={area.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 hover:bg-blue-50">
                        <input
                          type="checkbox"
                          checked={selected.has(area.id)}
                          onChange={() => toggle(area.id)}
                          className="accent-blue-700"
                        />
                        <span className="text-sm text-slate-700">{area.name}</span>
                      </label>
                    ))}
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <button
              onClick={save}
              disabled={saving}
              className="rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={() => router.push("/configuration/user-management")}
              className="rounded-md border border-blue-200 px-4 py-2 text-sm font-semibold text-blue-800"
            >
              Back
            </button>
          </div>
        </div>
      )}
    </>
  );
}

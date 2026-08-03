"use client";

import { FormEvent, useEffect, useState } from "react";
import { ApiError } from "@/components/ApiError";
import { PageHeader } from "@/components/PageHeader";
import { SubmitButton } from "@/components/SubmitButton";
import { SuccessMessage } from "@/components/SuccessMessage";
import { apiGet, apiPut } from "@/lib/api-client";

type Profile = { loginId: string; name: string; email: string | null };

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile>({ loginId: "", name: "", email: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    apiGet<{ profile: Profile }>("/api/auth/profile")
      .then((data) => setProfile(data.profile))
      .catch((err) => setError(err instanceof Error ? err.message : "Unable to load profile."))
      .finally(() => setLoading(false));
  }, []);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setSaving(true);
    try {
      const data = await apiPut<{ profile: Profile }>("/api/auth/profile", { name: profile.name, email: profile.email ?? "" });
      setProfile(data.profile);
      setSuccess("Profile updated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader title="My Profile" description="Update the name and email shown for your account." />
      <form onSubmit={onSubmit} className="card max-w-lg space-y-4 rounded-xl p-5">
        <ApiError message={error} />
        <SuccessMessage message={success} />
        {loading ? <p className="text-sm text-steel-500">Loading profile…</p> : (
          <>
            <label className="block text-sm"><span className="form-label">Login ID</span><input value={profile.loginId} readOnly disabled className="form-input mt-1" /></label>
            <label className="block text-sm"><span className="form-label">Name</span><input value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} className="form-input mt-1" required /></label>
            <label className="block text-sm"><span className="form-label">Email</span><input type="email" value={profile.email ?? ""} onChange={(e) => setProfile({ ...profile, email: e.target.value })} className="form-input mt-1" /></label>
            <SubmitButton loading={saving}>Save Profile</SubmitButton>
          </>
        )}
      </form>
    </>
  );
}

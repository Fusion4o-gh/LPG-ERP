"use client";

import { FormEvent, useState } from "react";
import { apiPost } from "@/lib/api-client";
import { ApiError } from "@/components/ApiError";
import { PageHeader } from "@/components/PageHeader";
import { SubmitButton } from "@/components/SubmitButton";
import { SuccessMessage } from "@/components/SuccessMessage";

export default function ChangePasswordPage() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setSuccess("");
    if (newPassword !== confirmPassword) {
      setError("New password and confirmation do not match.");
      return;
    }
    setLoading(true);
    try {
      await apiPost("/api/auth/change-password", { currentPassword, newPassword });
      setSuccess("Password updated.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <PageHeader title="Change Password" description="Update your login password." />
      <form onSubmit={onSubmit} className="card max-w-md rounded-xl p-5 space-y-4">
        <ApiError message={error} />
        <SuccessMessage message={success} />
        <label className="block text-sm">
          <span className="form-label">Current Password</span>
          <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className="form-input mt-1" required />
        </label>
        <label className="block text-sm">
          <span className="form-label">New Password</span>
          <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="form-input mt-1" required minLength={6} />
        </label>
        <label className="block text-sm">
          <span className="form-label">Confirm New Password</span>
          <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="form-input mt-1" required minLength={6} />
        </label>
        <SubmitButton loading={loading}>Update Password</SubmitButton>
      </form>
    </>
  );
}

"use client";

import { FormEvent, useEffect, useState } from "react";
import { apiGet, apiPost, apiPut } from "@/lib/api-client";
import { ApiError } from "@/components/ApiError";
import { DataTable } from "@/components/DataTable";
import { FormSection } from "@/components/FormSection";
import { PageHeader } from "@/components/PageHeader";
import { SuccessMessage } from "@/components/SuccessMessage";

type Role = { id: string; name: string };
type UserRow = {
  id: string;
  loginId: string;
  name: string;
  email: string | null;
  status: string;
  lastLoginAt: string | null;
  roles: Role[];
};

const BLANK_FORM = { loginId: "", name: "", email: "", password: "", status: "ACTIVE", roleIds: [] as string[] };

export function UserManagementClient() {
  const [rows, setRows] = useState<UserRow[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [values, setValues] = useState({ ...BLANK_FORM });
  const [editingId, setEditingId] = useState("");
  const [resetPassword, setResetPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const data = await apiGet<{ users: UserRow[]; roles: Role[] }>("/api/configuration/user-management");
      setRows(data.users);
      setRoles(data.roles);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Load failed.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function reset() {
    setValues({ ...BLANK_FORM });
    setEditingId("");
    setResetPassword("");
    setError("");
    setSuccess("");
  }

  function edit(row: UserRow) {
    setEditingId(row.id);
    setValues({
      loginId: row.loginId,
      name: row.name,
      email: row.email ?? "",
      password: "",
      status: row.status,
      roleIds: row.roles.map((r) => r.id),
    });
    setResetPassword("");
    setError("");
    setSuccess("");
  }

  function toggleRole(roleId: string) {
    setValues((current) => {
      const has = current.roleIds.includes(roleId);
      return { ...current, roleIds: has ? current.roleIds.filter((id) => id !== roleId) : [...current.roleIds, roleId] };
    });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setSuccess("");
    if (!values.loginId.trim()) return setError("Username is required.");
    if (!values.name.trim()) return setError("Full name is required.");
    if (!editingId && values.password.length < 6) return setError("Password must be at least 6 characters.");

    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        loginId: values.loginId.trim(),
        name: values.name.trim(),
        email: values.email.trim() || undefined,
        status: values.status,
        roleIds: values.roleIds,
      };
      if (!editingId) payload.password = values.password;

      if (editingId) {
        await apiPut(`/api/configuration/user-management/${editingId}`, payload);
        setSuccess("User updated.");
      } else {
        await apiPost("/api/configuration/user-management", payload);
        setSuccess("User created.");
      }
      reset();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  async function submitPasswordReset(event: FormEvent) {
    event.preventDefault();
    setError("");
    setSuccess("");
    if (resetPassword.length < 6) return setError("New password must be at least 6 characters.");

    setSaving(true);
    try {
      await apiPost(`/api/configuration/user-management/${editingId}/reset-password`, { password: resetPassword });
      setSuccess("Password reset.");
      setResetPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Password reset failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader title="User Management" description="Manage system users, roles, and access." />
      <div className="grid gap-5 xl:grid-cols-[minmax(320px,440px)_1fr]">
        <div className="space-y-4">
          <ApiError message={error} />
          <SuccessMessage message={success} />

          <form onSubmit={submit} className="space-y-4">
            <FormSection title={editingId ? "Edit User" : "Add User"}>
              <div className="space-y-3">
                <Field label="Username" required>
                  <input
                    type="text"
                    value={values.loginId}
                    onChange={(e) => setValues((c) => ({ ...c, loginId: e.target.value }))}
                    className="w-full rounded-md border border-blue-200 px-3 py-2 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
                    placeholder="e.g. jsmith"
                  />
                </Field>
                <Field label="Full Name" required>
                  <input
                    type="text"
                    value={values.name}
                    onChange={(e) => setValues((c) => ({ ...c, name: e.target.value }))}
                    className="w-full rounded-md border border-blue-200 px-3 py-2 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
                    placeholder="e.g. John Smith"
                  />
                </Field>
                <Field label="Email">
                  <input
                    type="email"
                    value={values.email}
                    onChange={(e) => setValues((c) => ({ ...c, email: e.target.value }))}
                    className="w-full rounded-md border border-blue-200 px-3 py-2 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
                    placeholder="optional"
                  />
                </Field>
                {!editingId && (
                  <Field label="Password" required>
                    <input
                      type="password"
                      value={values.password}
                      onChange={(e) => setValues((c) => ({ ...c, password: e.target.value }))}
                      className="w-full rounded-md border border-blue-200 px-3 py-2 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
                      placeholder="min. 6 characters"
                    />
                  </Field>
                )}
                <Field label="Status" required>
                  <select
                    value={values.status}
                    onChange={(e) => setValues((c) => ({ ...c, status: e.target.value }))}
                    className="w-full rounded-md border border-blue-200 bg-white px-3 py-2 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  >
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive</option>
                  </select>
                </Field>
                {roles.length > 0 && (
                  <Field label="Roles">
                    <div className="space-y-1 rounded-md border border-blue-200 bg-white p-2">
                      {roles.map((role) => (
                        <label key={role.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 hover:bg-blue-50">
                          <input
                            type="checkbox"
                            checked={values.roleIds.includes(role.id)}
                            onChange={() => toggleRole(role.id)}
                            className="accent-blue-700"
                          />
                          <span className="text-sm text-slate-700">{role.name}</span>
                        </label>
                      ))}
                    </div>
                  </Field>
                )}
              </div>
            </FormSection>
            <div className="flex gap-2">
              <button
                disabled={saving}
                className="rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {saving ? "Saving..." : editingId ? "Update" : "Create"}
              </button>
              <button
                type="button"
                onClick={reset}
                className="rounded-md border border-blue-200 px-4 py-2 text-sm font-semibold text-blue-800"
              >
                Cancel
              </button>
            </div>
          </form>

          {editingId && (
            <form onSubmit={submitPasswordReset}>
              <FormSection title="Reset Password">
                <div className="space-y-3">
                  <Field label="New Password" required>
                    <input
                      type="password"
                      value={resetPassword}
                      onChange={(e) => setResetPassword(e.target.value)}
                      className="w-full rounded-md border border-blue-200 px-3 py-2 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
                      placeholder="min. 6 characters"
                    />
                  </Field>
                </div>
                <div className="mt-3">
                  <button
                    disabled={saving}
                    className="rounded-md bg-blue-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    {saving ? "Saving..." : "Reset Password"}
                  </button>
                </div>
              </FormSection>
            </form>
          )}
        </div>

        <DataTable
          loading={loading}
          rows={rows as unknown as Record<string, unknown>[]}
          columns={[
            { key: "loginId", label: "Username" },
            { key: "name", label: "Full Name" },
            {
              key: "roles",
              label: "Roles",
              render: (row) => {
                const userRoles = (row.roles as Role[]) ?? [];
                return userRoles.length > 0
                  ? userRoles.map((r) => r.name).join(", ")
                  : <span className="text-slate-400 text-xs">No roles</span>;
              },
            },
            {
              key: "status",
              label: "Status",
              render: (row) =>
                row.status === "ACTIVE" ? (
                  <span className="rounded bg-green-100 px-2 py-1 text-xs font-semibold text-green-800">Active</span>
                ) : (
                  <span className="rounded bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">Inactive</span>
                ),
            },
            {
              key: "lastLoginAt",
              label: "Last Login",
              render: (row) =>
                row.lastLoginAt ? new Date(row.lastLoginAt as string).toLocaleDateString() : <span className="text-slate-400 text-xs">Never</span>,
            },
            {
              key: "actions",
              label: "Actions",
              render: (row) => (
                <button
                  onClick={() => edit(row as unknown as UserRow)}
                  className="rounded-md border border-blue-200 px-2 py-1 text-xs font-semibold text-blue-800"
                >
                  Edit
                </button>
              ),
            },
          ]}
        />
      </div>
    </>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block text-sm text-slate-700">
      <span className="mb-1 block font-medium">
        {label}
        {required ? <span className="text-red-600"> *</span> : null}
      </span>
      {children}
    </label>
  );
}

"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { ApiError } from "@/components/ApiError";
import { DataTable } from "@/components/DataTable";
import { FormSection } from "@/components/FormSection";
import { SuccessMessage } from "@/components/SuccessMessage";
import { apiGet, apiPost, apiPut } from "@/lib/api-client";

type Permission = { id: string; module: string; action: string; description?: string | null };
type User = { id: string; name: string; loginId: string; status: string };
type Role = {
  id: string;
  name: string;
  description?: string | null;
  status: string;
  isSystem: boolean;
  permissions: Permission[];
  users: User[];
};

const emptyForm = { name: "", description: "", status: "ACTIVE", permissionIds: [] as string[], userIds: [] as string[] };

export function RoleManagementClient({ canManage }: { canManage: boolean }) {
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState("");
  const [values, setValues] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const selectedRole = useMemo(() => roles.find((role) => role.id === selectedRoleId), [roles, selectedRoleId]);
  const groupedPermissions = useMemo(() => {
    return permissions.reduce<Record<string, Permission[]>>((groups, permission) => {
      groups[permission.module] = [...(groups[permission.module] ?? []), permission];
      return groups;
    }, {});
  }, [permissions]);

  async function load() {
    setLoading(true);
    const [roleData, permissionData] = await Promise.all([
      apiGet<{ roles: Role[]; users: User[] }>("/api/rbac/roles"),
      apiGet<{ permissions: Permission[] }>("/api/rbac/permissions"),
    ]);
    setRoles(roleData.roles);
    setUsers(roleData.users);
    setPermissions(permissionData.permissions);
    setLoading(false);
  }

  useEffect(() => {
    load().catch((err: Error) => {
      setError(err.message);
      setLoading(false);
    });
  }, []);

  function reset() {
    setSelectedRoleId("");
    setValues(emptyForm);
  }

  function edit(role: Role) {
    setSelectedRoleId(role.id);
    setValues({
      name: role.name,
      description: role.description ?? "",
      status: role.status,
      permissionIds: role.permissions.map((permission) => permission.id),
      userIds: role.users.map((user) => user.id),
    });
  }

  function toggle(list: "permissionIds" | "userIds", id: string) {
    setValues((current) => ({
      ...current,
      [list]: current[list].includes(id) ? current[list].filter((item) => item !== id) : [...current[list], id],
    }));
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setSuccess("");
    if (!canManage) {
      setError("You do not have permission to manage roles.");
      return;
    }
    if (!values.name.trim()) {
      setError("Role name is required.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: values.name,
        description: values.description,
        status: values.status,
        permissionIds: values.permissionIds,
        userIds: values.userIds,
      };
      if (selectedRoleId) {
        await apiPut(`/api/rbac/roles/${selectedRoleId}`, payload);
      } else {
        await apiPost("/api/rbac/roles", payload);
      }
      setSuccess(selectedRoleId ? "Role updated." : "Role created.");
      reset();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Role save failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(340px,460px)_1fr]">
      <form onSubmit={onSubmit} className="space-y-4">
        <ApiError message={error} />
        <SuccessMessage message={success} />
        <FormSection title={selectedRole ? `Edit ${selectedRole.name}` : "Create Role"}>
          <div className="space-y-3">
            <label className="block text-sm text-slate-700">
              <span className="mb-1 block font-medium">
                Role Name <span className="text-red-600">*</span>
              </span>
              <input disabled={!canManage} value={values.name} onChange={(event) => setValues((current) => ({ ...current, name: event.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2 disabled:bg-slate-100" />
            </label>
            <label className="block text-sm text-slate-700">
              <span className="mb-1 block font-medium">Description</span>
              <input disabled={!canManage} value={values.description} onChange={(event) => setValues((current) => ({ ...current, description: event.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2 disabled:bg-slate-100" />
            </label>
            <label className="block text-sm text-slate-700">
              <span className="mb-1 block font-medium">Status</span>
              <select disabled={!canManage} value={values.status} onChange={(event) => setValues((current) => ({ ...current, status: event.target.value }))} className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 disabled:bg-slate-100">
                <option value="ACTIVE">ACTIVE</option>
                <option value="INACTIVE">INACTIVE</option>
              </select>
            </label>
          </div>
        </FormSection>
        <FormSection title="Permissions">
          <div className="max-h-72 space-y-3 overflow-auto pr-1">
            {Object.entries(groupedPermissions).map(([module, modulePermissions]) => (
              <div key={module} className="rounded-md border border-slate-200 p-3">
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{module}</div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {modulePermissions.map((permission) => (
                    <label key={permission.id} className="flex items-center gap-2 text-sm text-slate-700">
                      <input disabled={!canManage} type="checkbox" checked={values.permissionIds.includes(permission.id)} onChange={() => toggle("permissionIds", permission.id)} />
                      {permission.action}
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </FormSection>
        <FormSection title="Users Assigned">
          <div className="max-h-48 space-y-2 overflow-auto pr-1">
            {users.map((user) => (
              <label key={user.id} className="flex items-center gap-2 text-sm text-slate-700">
                <input disabled={!canManage} type="checkbox" checked={values.userIds.includes(user.id)} onChange={() => toggle("userIds", user.id)} />
                <span>{user.name} ({user.loginId})</span>
              </label>
            ))}
          </div>
        </FormSection>
        {canManage ? (
          <div className="flex gap-2">
            <button disabled={saving} className="rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
              {saving ? "Saving..." : selectedRoleId ? "Update Role" : "Create Role"}
            </button>
            <button type="button" onClick={reset} className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">
              Reset
            </button>
          </div>
        ) : null}
      </form>
      <DataTable
        rows={roles}
        loading={loading}
        columns={[
          { key: "name", label: "Role" },
          { key: "status", label: "Status" },
          { key: "permissionCount", label: "Permissions", render: (role) => String((role.permissions as Permission[]).length) },
          { key: "userCount", label: "Users", render: (role) => String((role.users as User[]).length) },
          {
            key: "actions",
            label: "Actions",
            render: (role) => (
              <button onClick={() => edit(role as Role)} className="rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700">
                View / Edit
              </button>
            ),
          },
        ]}
      />
    </div>
  );
}

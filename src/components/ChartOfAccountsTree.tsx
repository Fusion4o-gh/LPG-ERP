"use client";

import { useEffect, useMemo, useState } from "react";
import { apiGet } from "@/lib/api-client";
import { ApiError } from "./ApiError";
import { PageHeader } from "./PageHeader";

type AccountRow = {
  id: string;
  code: string;
  name: string;
  accountType: string;
  normalBalance: string;
  parentId: string | null;
  level: number;
  status: string;
};

type TreeNode = AccountRow & { children: TreeNode[] };

function buildTree(rows: AccountRow[]) {
  const byId = new Map(rows.map((row) => [row.id, { ...row, children: [] as TreeNode[] }]));
  const roots: TreeNode[] = [];
  for (const row of byId.values()) {
    if (row.parentId && byId.has(row.parentId)) {
      byId.get(row.parentId)?.children.push(row);
    } else {
      roots.push(row);
    }
  }
  const sortNodes = (nodes: TreeNode[]) => {
    nodes.sort((left, right) => left.code.localeCompare(right.code));
    nodes.forEach((node) => sortNodes(node.children));
  };
  sortNodes(roots);
  return roots;
}

function filterTree(nodes: TreeNode[], query: string): TreeNode[] {
  if (!query) return nodes;
  return nodes.flatMap((node) => {
    const children = filterTree(node.children, query);
    const matches = `${node.code} ${node.name} ${node.accountType}`.toLowerCase().includes(query);
    return matches || children.length > 0 ? [{ ...node, children }] : [];
  });
}

function TreeRows({ nodes, depth = 0 }: { nodes: TreeNode[]; depth?: number }) {
  return (
    <>
      {nodes.map((node) => (
        <tbody key={node.id} className="contents">
          <tr className="hover:bg-slate-50">
            <td className="border border-slate-200 px-3 py-2 font-mono text-xs">{node.code}</td>
            <td className="border border-slate-200 px-3 py-2" style={{ paddingLeft: `${12 + depth * 18}px` }}>
              {depth > 0 ? <span className="mr-1 text-slate-400">└</span> : null}
              {node.name}
            </td>
            <td className="border border-slate-200 px-3 py-2">{node.accountType}</td>
            <td className="border border-slate-200 px-3 py-2">{node.normalBalance}</td>
            <td className="border border-slate-200 px-3 py-2">{node.level}</td>
            <td className="border border-slate-200 px-3 py-2">{node.status}</td>
          </tr>
          <TreeRows nodes={node.children} depth={depth + 1} />
        </tbody>
      ))}
    </>
  );
}

export function ChartOfAccountsTree() {
  const [rows, setRows] = useState<AccountRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const tree = useMemo(() => buildTree(rows), [rows]);
  const visibleTree = useMemo(() => filterTree(tree, search.trim().toLowerCase()), [tree, search]);

  useEffect(() => {
    apiGet<{ accounts: AccountRow[] }>("/api/chart-of-accounts?all=1")
      .then((data) => setRows(data.accounts ?? []))
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <PageHeader
        title="Chart of Accounts"
        description="Hierarchical account tree used by vouchers and financial transactions."
      />
      <ApiError message={error} />
      <div className="mb-3 flex items-center gap-2">
        <label htmlFor="chart-of-accounts-search" className="text-sm font-semibold text-slate-700">Search accounts</label>
        <input
          id="chart-of-accounts-search"
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Code, name, or type"
          className="form-input max-w-sm"
        />
      </div>
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-slate-100 text-left">
            <tr>
              <th className="border border-slate-200 px-3 py-2">Code</th>
              <th className="border border-slate-200 px-3 py-2">Name</th>
              <th className="border border-slate-200 px-3 py-2">Type</th>
              <th className="border border-slate-200 px-3 py-2">Normal Balance</th>
              <th className="border border-slate-200 px-3 py-2">Level</th>
              <th className="border border-slate-200 px-3 py-2">Status</th>
            </tr>
          </thead>
          {loading ? (
            <tbody>
              <tr>
                <td className="border border-slate-200 px-3 py-4 text-slate-600" colSpan={6}>
                  Loading chart of accounts...
                </td>
              </tr>
            </tbody>
          ) : visibleTree.length === 0 ? (
            <tbody>
              <tr>
                <td className="border border-slate-200 px-3 py-4 text-slate-600" colSpan={6}>
                  {search ? "No matching accounts found." : "No accounts found."}
                </td>
              </tr>
            </tbody>
          ) : (
            <TreeRows nodes={visibleTree} />
          )}
        </table>
      </div>
    </>
  );
}

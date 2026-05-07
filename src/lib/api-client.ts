"use client";

export type ApiResult<T> = { success: true } & T;

export async function apiGet<T>(url: string): Promise<ApiResult<T>> {
  const response = await fetch(url, { cache: "no-store" });
  return parseResponse<T>(response);
}

export async function apiPost<T>(url: string, body: Record<string, unknown>): Promise<ApiResult<T>> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return parseResponse<T>(response);
}

export async function apiPut<T>(url: string, body: Record<string, unknown>): Promise<ApiResult<T>> {
  const response = await fetch(url, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return parseResponse<T>(response);
}

async function parseResponse<T>(response: Response): Promise<ApiResult<T>> {
  const data = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(data?.error?.message ?? "Request failed.");
  }
  return data;
}

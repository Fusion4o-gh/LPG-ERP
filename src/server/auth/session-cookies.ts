import { cookies } from "next/headers";
import { SESSION_COOKIE, getSessionContextFromToken } from "./session.ts";

export async function getSessionContextFromCookies() {
  const store = await cookies();
  return getSessionContextFromToken(store.get(SESSION_COOKIE)?.value);
}

import { cookies } from "next/headers";

/** Legacy local JWT cookie — cleared on logout for migration cleanup. */
export const SESSION_COOKIE = "wifihub_session";

export async function clearSessionCookie() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

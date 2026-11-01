import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/auth/token";

// Optimistische Prüfung anhand des Cookies. Die verbindliche Prüfung (Rolle, aktiver
// Nutzer, Sitzungsversion) passiert in der Data Access Layer, siehe src/lib/auth/dal.ts.
// /login wird bewusst nicht umgeleitet: Ein Token kann gültig signiert, aber durch eine
// Passwort- oder Rollenänderung längst beendet sein, sonst entstünde eine Schleife.
export async function proxy(request: NextRequest) {
  // Server Actions prüfen selbst (requireUser bzw. kitchenUser). Eine Umleitung hier
  // käme im Client nur als unklarer Fehler an statt als „Sitzung abgelaufen“.
  if (request.headers.has("next-action")) return NextResponse.next();
  const session = await verifySession(
    request.cookies.get(SESSION_COOKIE)?.value,
  );
  if (!session) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(login);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/kitchen/:path*"],
};

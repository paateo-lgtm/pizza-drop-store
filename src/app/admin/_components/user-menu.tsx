import { LogOut } from "lucide-react";
import { logout } from "@/app/login/actions";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth/dal";

export async function UserMenu() {
  const user = await getCurrentUser();
  if (!user) return null;

  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{user.name}</p>
        <p className="truncate text-xs text-ink-muted">
          {user.role === "ADMIN" ? "Admin" : "Küche"}
        </p>
      </div>
      <form action={logout}>
        <Button variant="ghost" size="icon" aria-label="Abmelden">
          <LogOut />
        </Button>
      </form>
    </div>
  );
}

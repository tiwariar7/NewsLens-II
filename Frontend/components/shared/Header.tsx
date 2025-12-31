// components/shared/Header.tsx
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Logo } from "./Logo";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuthStore } from "@/lib/authStore";
import { ModeToggle } from "./ModeToggle";
import { Bookmark } from "lucide-react";

const navItems = [
  { name: "Dashboard", href: "/dashboard" },
  { name: "Discover", href: "/discover" },
  { name: "Bookmarks", href: "/bookmarks" },
  { name: "Settings", href: "/settings" },
];

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuthStore();

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  const getInitials = (name: string) => {
    return name.split(' ').map((n) => n[0]).join('').toUpperCase();
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
      <div className="container flex h-16 max-w-full px-6 items-center justify-between">
        <div className="flex items-center gap-8">
          <Logo />
          <nav className="hidden items-center gap-6 text-sm md:flex">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "transition-colors hover:text-foreground/80",
                  pathname.startsWith(item.href)
                    ? "text-foreground font-semibold"
                    : "text-foreground/60"
                )}
              >
                {item.name}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" asChild>
            <Link href="/search">Search...</Link>
          </Button>
          <Button variant="ghost" size="icon" asChild title="Bookmarks">
            <Link href="/bookmarks">
              <Bookmark className="w-5 h-5" />
              <span className="sr-only">Bookmarks</span>
            </Link>
          </Button>
          {user ? (
            <div className="flex items-center gap-2">
              <Avatar className="h-8 w-8">
                <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
              </Avatar>
              <Button onClick={handleLogout} variant="ghost" size="sm">
                Log Out
              </Button>
            </div>
          ) : (
            <Button size="sm" asChild>
              <Link href="/login">Login</Link>
            </Button>
          )}
          <ModeToggle />
        </div>
      </div>
    </header>
  );
}
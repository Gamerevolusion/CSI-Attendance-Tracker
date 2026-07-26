"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import {
  LayoutDashboard,
  ClipboardCheck,
  History,
  Users,
  FileText,
  UserCog,
  User,
  Menu,
  X,
  LogOut,
  ChevronRight,
  BookOpen,
} from "lucide-react";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/attendance/mark", label: "Mark Attendance", icon: ClipboardCheck },
  { href: "/attendance/history", label: "History", icon: History },
  { href: "/reports", label: "Reports", icon: FileText },
  { href: "/profile", label: "My Profile", icon: User },
];

const adminNavItems = [
  { href: "/roster", label: "Roster", icon: Users },
  { href: "/admin/curriculum", label: "Curriculum", icon: BookOpen },
  { href: "/admin/users", label: "Manage Users", icon: UserCog },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { user, isAdmin, signOut } = useAuth();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (!user) return <>{children}</>;

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 w-64 bg-sidebar border-r border-sidebar-border
          transform transition-transform duration-200 ease-in-out
          lg:relative lg:translate-x-0
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        <div className="flex h-full flex-col">
          {/* Logo / Header */}
          <div className="flex items-center justify-between px-4 py-5 border-b border-sidebar-border">
            <Link href="/" className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-sm">
                CSI
              </div>
              <span className="font-heading font-semibold text-sidebar-foreground">
                Attendance
              </span>
            </Link>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden text-sidebar-foreground hover:text-sidebar-foreground/80"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Nav Links */}
          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
            <p className="px-3 mb-2 text-xs font-medium text-sidebar-foreground/50 uppercase tracking-wider">
              Main
            </p>
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={`
                    flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
                    transition-colors duration-150
                    ${
                      active
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
                    }
                  `}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {item.label}
                  {active && (
                    <ChevronRight className="ml-auto h-4 w-4 opacity-50" />
                  )}
                </Link>
              );
            })}

            {isAdmin && (
              <>
                <div className="pt-4" />
                <p className="px-3 mb-2 text-xs font-medium text-sidebar-foreground/50 uppercase tracking-wider">
                  Admin
                </p>
                {adminNavItems.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setSidebarOpen(false)}
                      className={`
                        flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
                        transition-colors duration-150
                        ${
                          active
                            ? "bg-sidebar-accent text-sidebar-accent-foreground"
                            : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
                        }
                      `}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      {item.label}
                      {active && (
                        <ChevronRight className="ml-auto h-4 w-4 opacity-50" />
                      )}
                    </Link>
                  );
                })}
              </>
            )}
          </nav>

          {/* User / Sign Out */}
          <div className="border-t border-sidebar-border p-3">
            <div className="flex items-center gap-3 px-3 py-2">
              {user.photoURL ? (
                <Image
                  src={user.photoURL}
                  alt=""
                  width={32}
                  height={32}
                  className="h-8 w-8 rounded-full"
                  referrerPolicy="no-referrer"
                  unoptimized
                />
              ) : (
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium">
                  {user.displayName?.[0] || user.email?.[0] || "?"}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-sidebar-foreground truncate">
                  {user.displayName || "User"}
                </p>
                <p className="text-xs text-sidebar-foreground/50 truncate">
                  {user.email}
                </p>
              </div>
            </div>
            <button
              onClick={signOut}
              className="flex w-full items-center gap-3 px-3 py-2.5 mt-1 rounded-lg text-sm font-medium
                text-sidebar-foreground/70 hover:bg-destructive/10 hover:text-destructive transition-colors duration-150"
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top Bar (mobile) */}
        <header className="flex items-center justify-between border-b px-4 py-3 lg:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-foreground"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground font-bold text-xs">
              CSI
            </div>
            <span className="font-heading font-semibold text-sm">
              Attendance
            </span>
          </div>
          <div className="w-5" /> {/* Spacer for centering */}
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

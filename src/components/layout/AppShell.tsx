"use client";

import { useState, useEffect, type ReactNode } from "react";
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

  // Lock body scroll when mobile drawer is open
  useEffect(() => {
    if (sidebarOpen) {
      document.body.classList.add("drawer-open");
    } else {
      document.body.classList.remove("drawer-open");
    }
    return () => document.body.classList.remove("drawer-open");
  }, [sidebarOpen]);

  if (!user) return <>{children}</>;

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  return (
    <div className="flex h-dvh overflow-hidden" style={{ background: "var(--neo-bg)" }}>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar — neomorphic panel */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 w-64
          transform transition-transform duration-200 ease-in-out
          lg:relative lg:translate-x-0
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
        `}
        style={{
          background: "var(--neo-bg)",
          boxShadow: "6px 0 16px var(--neo-shadow-dark)",
        }}
      >
        <div className="flex h-full flex-col">
          {/* Logo / Header */}
          <div className="flex items-center justify-between px-4 py-5">
            <Link href="/" className="flex items-center gap-2.5">
              <Image
                src="/csi.png"
                alt="CSI Logo"
                width={36}
                height={36}
                className="h-9 w-9 object-contain drop-shadow-sm shrink-0"
              />
              <span
                className="font-heading font-semibold"
                style={{ color: "var(--neo-text)" }}
              >
                Attendance
              </span>
            </Link>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden"
              style={{ color: "var(--neo-text-muted)" }}
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Nav Links */}
          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
            <p
              className="px-3 mb-2 text-xs font-medium uppercase tracking-wider"
              style={{ color: "var(--neo-text-muted)", opacity: 0.7 }}
            >
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
                    flex items-center gap-3 px-3 py-3.5 text-sm font-medium
                    transition-all duration-150
                    ${active ? "neo-raised neo-nav-link-active" : ""}
                  `}
                  style={{
                    borderRadius: 12,
                    color: active ? "var(--neo-text)" : "var(--neo-text-muted)",
                  }}
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
                <p
                  className="px-3 mb-2 text-xs font-medium uppercase tracking-wider"
                  style={{ color: "var(--neo-text-muted)", opacity: 0.7 }}
                >
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
                        flex items-center gap-3 px-3 py-3.5 text-sm font-medium
                        transition-all duration-150
                        ${active ? "neo-raised neo-nav-link-active" : ""}
                      `}
                      style={{
                        borderRadius: 12,
                        color: active ? "var(--neo-text)" : "var(--neo-text-muted)",
                      }}
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
          <div className="p-3">
            <div
              className="neo-pressed flex items-center gap-3 px-3 py-2.5"
              style={{ borderRadius: 12 }}
            >
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
                <div
                  className="neo-raised h-8 w-8 rounded-full flex items-center justify-center text-xs font-medium"
                  style={{ color: "var(--neo-text)" }}
                >
                  {user.displayName?.[0] || user.email?.[0] || "?"}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p
                  className="text-sm font-medium truncate"
                  style={{ color: "var(--neo-text)" }}
                >
                  {user.displayName || "User"}
                </p>
                <p
                  className="text-xs truncate"
                  style={{ color: "var(--neo-text-muted)" }}
                >
                  {user.email}
                </p>
              </div>
            </div>
            <button
              onClick={signOut}
              className="neo-btn flex w-full items-center gap-3 px-3 py-2.5 mt-2 text-sm font-medium"
              style={{ color: "var(--neo-red)" }}
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
        <header
          className="flex items-center justify-between px-4 py-3 lg:hidden"
          style={{
            background: "var(--neo-bg)",
            boxShadow: "0 4px 8px var(--neo-shadow-dark)",
          }}
        >
          <button
            onClick={() => setSidebarOpen(true)}
            className="flex items-center justify-center h-10 w-10 rounded-xl"
            style={{ color: "var(--neo-text)" }}
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2">
            <Image
              src="/csi.png"
              alt="CSI Logo"
              width={28}
              height={28}
              className="h-7 w-7 object-contain drop-shadow-sm shrink-0"
            />
            <span
              className="font-heading font-semibold text-sm"
              style={{ color: "var(--neo-text)" }}
            >
              Attendance
            </span>
          </div>
          <div className="w-10" />
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto" style={{ background: "var(--neo-bg)" }}>
          <div className="mx-auto max-w-7xl px-3 py-4 sm:px-6 lg:px-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

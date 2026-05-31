"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Activity, BarChart3, CalendarDays, ChevronsLeft, ChevronsRight, History, LayoutDashboard, User, LogOut, Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import { clearSession, getStoredUser, AuthUser } from "@/lib/auth";
import { logout } from "@/lib/api";

const navLinks = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/history", label: "History", icon: History },
  { href: "/dashboard/plans", label: "Plans", icon: CalendarDays },
  { href: "/dashboard/statistics", label: "Statistics", icon: BarChart3 },
  { href: "/dashboard/profile", label: "Profile", icon: User },
];

export default function DashboardNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    const syncUser = () => setUser(getStoredUser());
    syncUser();
    window.addEventListener("gymfixer-auth-change", syncUser);
    return () => window.removeEventListener("gymfixer-auth-change", syncUser);
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem("ptt_sidebar_collapsed");
    setCollapsed(stored === "true");
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((current) => {
      const next = !current;
      localStorage.setItem("ptt_sidebar_collapsed", String(next));
      return next;
    });
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch {
    } finally {
      clearSession();
      router.push("/auth/login");
    }
  };

  const isActive = (href: string) => href === "/dashboard" ? pathname === href : pathname === href || pathname.startsWith(href + "/");
  const initial = (user?.name || user?.email || "U").slice(0, 1).toUpperCase();

  const navItems = (
    <nav className="app-nav-list">
      {navLinks.map(({ href, label, icon: Icon }) => {
        const active = isActive(href);
        return (
          <Link key={href} href={href} className={`app-nav-item ${active ? "active" : ""}`} onClick={() => setMobileOpen(false)} title={label}>
            <Icon size={17} />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );

  const userBlock = (
    <>
      <div className="app-user-card" title={user?.email || "Signed in"}>
        <div className="app-user-avatar">{initial}</div>
        <div className="app-user-meta">
          <p>{user?.name || "PTT User"}</p>
          <span>{user?.email || "Signed in"}</span>
        </div>
      </div>
      <button onClick={handleLogout} className="app-logout" title="Sign out">
        <LogOut size={15} />
        <span>Sign out</span>
      </button>
    </>
  );

  return (
    <>
      <aside className={`app-sidebar ${collapsed ? "collapsed" : ""}`}>
        <div className="app-brand">
          <span className="brand-mark"><Activity size={16} /></span>
          <span>PTT</span>
        </div>
        <div className="app-nav-label">Workspace</div>
        {navItems}
        {userBlock}
        <button
          type="button"
          onClick={toggleCollapsed}
          className="app-sidebar-handle"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronsRight size={16} /> : <ChevronsLeft size={16} />}
        </button>
      </aside>

      <div className="app-mobilebar">
        <div className="app-brand compact">
          <span className="brand-mark"><Activity size={15} /></span>
          <span>PTT</span>
        </div>
        <button onClick={() => setMobileOpen(!mobileOpen)} className="app-menu-button" aria-label="Toggle navigation">
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="app-mobile-drawer">
            <div className="app-nav-label">Workspace</div>
            {navItems}
            {userBlock}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

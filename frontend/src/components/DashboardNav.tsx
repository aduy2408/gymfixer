"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Activity, LayoutDashboard, User, LogOut, Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import { clearSession, getStoredUser, AuthUser } from "@/lib/auth";
import { logout } from "@/lib/api";

const navLinks = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/profile", label: "Profile", icon: User },
];

export default function DashboardNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    const syncUser = () => setUser(getStoredUser());
    syncUser();
    window.addEventListener("gymfixer-auth-change", syncUser);
    return () => window.removeEventListener("gymfixer-auth-change", syncUser);
  }, []);

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
          <Link key={href} href={href} className={`app-nav-item ${active ? "active" : ""}`} onClick={() => setMobileOpen(false)}>
            <Icon size={17} />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );

  const userBlock = (
    <>
      <div className="app-user-card">
        <div className="app-user-avatar">{initial}</div>
        <div className="app-user-meta">
          <p>{user?.name || "GymFixer User"}</p>
          <span>{user?.email || "Signed in"}</span>
        </div>
      </div>
      <button onClick={handleLogout} className="app-logout">
        <LogOut size={15} />
        <span>Sign out</span>
      </button>
    </>
  );

  return (
    <>
      <aside className="app-sidebar">
        <div className="app-brand">
          <span className="brand-mark"><Activity size={16} /></span>
          <span>GymFixer</span>
        </div>
        <div className="app-nav-label">Workspace</div>
        {navItems}
        {userBlock}
      </aside>

      <div className="app-mobilebar">
        <div className="app-brand compact">
          <span className="brand-mark"><Activity size={15} /></span>
          <span>GymFixer</span>
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

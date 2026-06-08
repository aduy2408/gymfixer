"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Activity, BarChart3, CalendarDays, ChevronsLeft, ChevronsRight, History, LayoutDashboard, User, LogOut, Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import { clearSession, getStoredUser, AuthUser } from "@/lib/auth";
import { logout, fetchUserProfile } from "@/lib/api";
import { tierLabel, useI18n } from "@/lib/i18n";
import LanguageToggle from "@/components/LanguageToggle";

const navLinks = [
  { href: "/dashboard", labelKey: "nav.dashboard", icon: LayoutDashboard },
  { href: "/dashboard/history", labelKey: "nav.history", icon: History },
  { href: "/dashboard/plans", labelKey: "nav.plans", icon: CalendarDays },
  { href: "/dashboard/statistics", labelKey: "nav.statistics", icon: BarChart3 },
  { href: "/dashboard/profile", labelKey: "nav.profile", icon: User },
];

export default function DashboardNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useI18n();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("ptt_sidebar_collapsed") === "true";
  });
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    const syncUser = () => setUser(getStoredUser());
    syncUser();
    window.addEventListener("gymfixer-auth-change", syncUser);

    const handleProfileUpdate = async () => {
      try {
        const profile = await fetchUserProfile();
        setUser((prev) => {
          const base = prev || getStoredUser();
          return base ? { ...base, name: profile.name, email: profile.email } : null;
        });
      } catch (err) {
        console.error("Lỗi khi đồng bộ dữ liệu user trên Nav:", err);
      }
    };

    handleProfileUpdate();
    window.addEventListener("userProfileUpdated", handleProfileUpdate);

    return () => {
      window.removeEventListener("gymfixer-auth-change", syncUser);
      window.removeEventListener("userProfileUpdated", handleProfileUpdate);
    };
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
      {navLinks.map(({ href, labelKey, icon: Icon }) => {
        const active = isActive(href);
        const label = t(labelKey);
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
      <div className="app-user-card" title={user?.email || t("auth.signIn")}>
        <div className="app-user-avatar">{initial}</div>
        <div className="app-user-meta">
          <p>{user?.name || t("common.defaultUser")}</p>
          <span>{user?.email || t("auth.signIn")} · {tierLabel(user?.subscription_tier || "free", t)}</span>
        </div>
      </div>
      <button onClick={handleLogout} className="app-logout" title={t("auth.signOut")}>
        <LogOut size={15} />
        <span>{t("auth.signOut")}</span>
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
        <div className="app-nav-label">{t("nav.workspace")}</div>
        {navItems}
        <div style={{ padding: collapsed ? "0 0.55rem" : "0 0.85rem", marginTop: "0.75rem" }}>
          <LanguageToggle compact={collapsed} />
        </div>
        {userBlock}
        <button
          type="button"
          onClick={toggleCollapsed}
          className="app-sidebar-handle"
          aria-label={collapsed ? t("nav.expandSidebar") : t("nav.collapseSidebar")}
          title={collapsed ? t("nav.expandSidebar") : t("nav.collapseSidebar")}
        >
          {collapsed ? <ChevronsRight size={16} /> : <ChevronsLeft size={16} />}
        </button>
      </aside>

      <div className="app-mobilebar">
        <div className="app-brand compact">
          <span className="brand-mark"><Activity size={15} /></span>
          <span>PTT</span>
        </div>
        <button onClick={() => setMobileOpen(!mobileOpen)} className="app-menu-button" aria-label={t("nav.toggle")}>
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="app-mobile-drawer">
            <div className="app-nav-label">{t("nav.workspace")}</div>
            <div style={{ padding: "0 0.85rem 0.75rem" }}>
              <LanguageToggle />
            </div>
            {navItems}
            {userBlock}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

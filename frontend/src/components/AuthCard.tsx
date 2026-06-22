"use client";

import Link from "next/link";
import { Activity } from "lucide-react";

export default function AuthCard({
  eyebrow,
  title,
  copy,
  children,
  footer,
}: {
  eyebrow: string;
  title: string;
  copy: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="auth-page">
      <div className="auth-card surface-card">
        <Link href="/" className="auth-brand">
          <span className="brand-mark"><Activity size={16} /></span>
          <span>GymFixer</span>
        </Link>
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="auth-title">{title}</h1>
        <p className="auth-copy">{copy}</p>
        {children}
        {footer ? <div className="auth-footer">{footer}</div> : null}
      </div>
    </div>
  );
}

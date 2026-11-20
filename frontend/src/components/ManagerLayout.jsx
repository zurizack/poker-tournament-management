import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

// Hebrew labels per spec — the rest of the manager UI stays English/LTR,
// this is a deliberate exception for the five sidebar tabs only.
const NAV_ITEMS = [
  { to: "/manager", label: "דף הבית", end: true },
  { to: "/manager/tournaments", label: "טורנירים" },
  { to: "/manager/templates", label: "טמפלייטים" },
  { to: "/manager/history", label: "היסטוריה" },
  { to: "/manager/players", label: "שחקנים" },
];

function SidebarLinks({ onNavigate }) {
  return (
    <nav className="flex flex-1 flex-col gap-1 px-3 py-4">
      {NAV_ITEMS.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          onClick={onNavigate}
          className={({ isActive }) =>
            `rounded-lg px-4 py-3 text-base font-semibold transition-colors ${
              isActive ? "bg-emerald-600 text-white" : "text-slate-300 hover:bg-slate-800"
            }`
          }
        >
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}

export function ManagerLayout() {
  const { username, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 sm:flex">
      {/* Mobile top bar */}
      <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3 sm:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="rounded-lg bg-slate-800 px-3 py-2 text-sm font-semibold text-slate-100"
          aria-label="Open menu"
        >
          ☰
        </button>
        <span className="text-sm text-slate-400">{username}</span>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex sm:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
          <div className="relative flex w-64 flex-col border-r border-slate-800 bg-slate-900">
            <div className="border-b border-slate-800 px-4 py-4">
              <p className="text-sm font-semibold text-slate-100">{username}</p>
            </div>
            <SidebarLinks onNavigate={() => setMobileOpen(false)} />
            <div className="border-t border-slate-800 p-3">
              <button
                type="button"
                onClick={logout}
                className="w-full rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-700"
              >
                Log out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <div className="hidden w-64 shrink-0 flex-col border-r border-slate-800 bg-slate-900 sm:flex">
        <div className="border-b border-slate-800 px-5 py-5">
          <p className="text-sm text-slate-400">Signed in as</p>
          <p className="truncate font-semibold text-slate-100">{username}</p>
        </div>
        <SidebarLinks />
        <div className="border-t border-slate-800 p-3">
          <button
            type="button"
            onClick={logout}
            className="w-full rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-700"
          >
            Log out
          </button>
        </div>
      </div>

      <div className="min-w-0 flex-1">
        <Outlet />
      </div>
    </div>
  );
}

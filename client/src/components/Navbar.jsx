import { NavLink } from "react-router-dom";
import { motion } from "framer-motion";
import { Home, Radio, LayoutGrid, BarChart3, Download, Wifi } from "lucide-react";

const links = [
  { to: "/", label: "Home", icon: Home, end: true },
  { to: "/live-response", label: "Live Response", icon: Radio },
  { to: "/monitoring-dashboard", label: "Monitoring Dashboard", icon: LayoutGrid },
  { to: "/data-analyst", label: "Data Analyst", icon: BarChart3 }
];

export default function Navbar() {
  return (
    <header className="nav">
      <div className="nav-inner">
        <NavLink to="/" className="brand">
          <img src="/logo-bri.svg" alt="BRI" />
          <span>
            <b>BRI Region 12 Surabaya</b>
            <small>OPERATION, SERVICE, AND E-CHANNEL (OSE)</small>
          </span>
        </NavLink>

        <nav className="nav-links">
          {links.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className="nav-link">
              {({ isActive }) => (
                <>
                  {isActive && (
                    <motion.span layoutId="nav-pill" className="nav-pill" transition={{ type: "spring", stiffness: 420, damping: 34 }} />
                  )}
                  <span className={`nav-link-in ${isActive ? "on" : ""}`}>
                    <Icon size={16} />
                    {label}
                  </span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="nav-right">
          <span className="live"><Wifi size={14} /> LIVE</span>
          <a className="icon-btn" href="/api/export.xlsx" title="Unduh data Excel"><Download size={16} /></a>
        </div>
      </div>
    </header>
  );
}

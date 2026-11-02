import { Routes, Route, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import Navbar from "./components/Navbar.jsx";
import Home from "./pages/Home.jsx";
import LiveResponse from "./pages/LiveResponse.jsx";
import MonitoringDashboard from "./pages/MonitoringDashboard.jsx";
import DataAnalyst from "./pages/DataAnalyst.jsx";

export default function App() {
  const location = useLocation();
  return (
    <>
      <Navbar />
      <AnimatePresence mode="wait" initial={false}>
        <Routes location={location} key={location.pathname}>
          <Route path="/" element={<Home />} />
          <Route path="/live-response" element={<LiveResponse />} />
          <Route path="/monitoring-dashboard" element={<MonitoringDashboard />} />
          <Route path="/data-analyst" element={<DataAnalyst />} />
          <Route path="*" element={<Home />} />
        </Routes>
      </AnimatePresence>
    </>
  );
}

import { useState, useMemo } from "react";
import { NavLink, Routes, Route, useLocation } from "react-router-dom";
import {
  Droplets,
  LayoutGrid,
  Table2,
  Cpu,
  Network,
  GitCompare,
  FileText,
  Menu,
} from "lucide-react";
import { Ctx } from "./store.js";
import { demo, validate } from "./data.js";
import { optimizeApi } from "./api.js";
import { adaptResult } from "./adapter.js";
import {
  Overview,
  Input,
  Optimization,
  Simulation,
  WhatIf,
  Reports,
} from "./pages.jsx";
const nav = [
  ["/", "Overview", LayoutGrid, "Summary of the current dataset and results"],
  [
    "/input",
    "Input Data",
    Table2,
    "Edit supply, demand, costs and route restrictions",
  ],
  [
    "/optimization",
    "Optimization",
    Cpu,
    "VAM initial solution and verified optimal plan",
  ],
  ["/simulation", "Simulation", Network, "Step through the allocation plan"],
  [
    "/whatif",
    "What-if Analysis",
    GitCompare,
    "Compare scenarios against the baseline",
  ],
  ["/reports", "Reports", FileText, "Tables, CSV export and print"],
];
export default function App() {
  const [d, setD] = useState(demo());
  const [run, setRun] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [scn, setScn] = useState(null);
  const [open, setOpen] = useState(false);
  const v = useMemo(() => validate(d), [d]);
  const stale = !!run && run.snap !== JSON.stringify(d);
 const doRun = async () => {
  if (loading || v.errors.length) return;

  setLoading(true);
  setError(null);

  const snapshot = JSON.stringify(d);

  try {
    const response = await optimizeApi(d);
    const adapted = adaptResult(response, d);

    setRun({
      snap: snapshot,
      ...adapted,
      at: new Date().toLocaleString(),
    });

    setScn(null);
  } catch (err) {
    const detail = err.response?.data?.detail;

    setError(
      typeof detail === "string"
        ? detail
        : detail
          ? JSON.stringify(detail)
          : "Failed to connect to optimization server"
    );
  } finally {
    setLoading(false);
  }
};
  const loc = useLocation();
  const cur = nav.find((n) => n[0] === loc.pathname) || nav[0];
  const st = v.errors.length
    ? ["Invalid input", "bg-clay"]
    : !run
      ? ["Not run yet", "bg-mute"]
      : stale
        ? ["Results outdated", "bg-ochre"]
        : ["Results current", "bg-moss"];
  return (
    <Ctx.Provider
  value={{
    d,
    setD,
    v,
    run,
    stale,
    doRun,
    scn,
    setScn,
    loading,
    error,
  }}
>
      <div className="min-h-screen lg:flex">
        <aside
          className={`${open ? "block" : "hidden"} lg:block lg:w-60 shrink-0 bg-mist border-r border-sage p-4 lg:sticky lg:top-0 lg:h-screen`}
        >
          <div className="flex items-center gap-2 mb-6 text-forest">
            <Droplets size={22} />
            <span className="font-semibold text-lg">BloodFlow</span>
          </div>
          <nav className="space-y-1">
            {nav.map(([to, l, I]) => (
              <NavLink
                key={to}
                to={to}
                end
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 px-3 py-2 rounded-md text-sm ${isActive ? "bg-sage text-forest font-medium" : "text-ink hover:bg-sage/50"}`
                }
              >
                <I size={17} />
                {l}
              </NavLink>
            ))}
          </nav>
        </aside>
        <div className="flex-1 min-w-0">
          <header className="flex flex-wrap items-center gap-3 px-6 py-4 border-b border-sage bg-paper">
            <button
              className="lg:hidden"
              aria-label="Menu"
              onClick={() => setOpen(!open)}
            >
              <Menu />
            </button>
            <div className="mr-auto">
              <h1 className="text-xl font-semibold text-forest">{cur[1]}</h1>
              <p className="text-sm text-mute">{cur[3]}</p>
            </div>
            <span
              className="text-xs text-mute max-w-[16rem] truncate"
              title={d.name}
            >
              {d.name}
            </span>
            <span className="flex items-center gap-1.5 text-xs">
              <i className={`w-2 h-2 rounded-full ${st[1]}`} />
              {st[0]}
            </span>
           <button
  onClick={doRun}
  disabled={!!v.errors.length || loading}
  className="bg-forest text-white text-sm px-3.5 py-2 rounded-md hover:bg-moss disabled:opacity-40 disabled:cursor-not-allowed"
>
  {loading ? "Optimizing..." : "Run optimization"}
</button>
          </header>
          {error && (
  <div className="mx-6 mt-4 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700">
    {error}
  </div>
)}
          <main className="p-6 max-w-6xl">
            <Routes>
              <Route path="/" element={<Overview />} />
              <Route path="/input" element={<Input />} />
              <Route path="/optimization" element={<Optimization />} />
              <Route path="/simulation" element={<Simulation />} />
              <Route path="/whatif" element={<WhatIf />} />
              <Route path="/reports" element={<Reports />} />
            </Routes>
          </main>
        </div>
      </div>
    </Ctx.Provider>
  );
}

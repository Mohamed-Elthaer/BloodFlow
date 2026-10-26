import { useContext, useState, useEffect } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";
import { Ctx } from "./store.js";
import { demo, empty, validate, sum } from "./data.js";
import { checkPlan } from "./solver.js";
import { optimizeApi } from "./api.js";
import { adaptResult } from "./adapter.js";
const Card = ({ title, right, children, className = "" }) => (
  <section
    className={`bg-white border border-sage rounded-lg p-5 ${className}`}
  >
    <div className="flex items-center justify-between mb-3">
      <h3 className="font-semibold">{title}</h3>
      {right}
    </div>
    {children}
  </section>
);
const Btn = ({ kind = "p", ...p }) => (
  <button
    {...p}
    className={`px-3.5 py-2 rounded-md text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed ${kind === "p" ? "bg-forest text-white hover:bg-moss" : "border border-sage text-forest hover:bg-mist"}`}
  />
);
const Tip = ({ t, children }) => (
  <span title={t} className="underline decoration-dotted cursor-help">
    {children}
  </span>
);
const Note = ({ kind = "info", children }) => (
  <div
    className={`text-sm rounded-md px-3 py-2 border ${kind === "err" ? "bg-clay/10 border-clay text-clay" : kind === "warn" ? "bg-ochre/10 border-ochre text-ink" : "bg-ok border-sage text-forest"}`}
  >
    {children}
  </div>
);
const Empty = ({ children }) => (
  <div className="border border-dashed border-sage rounded-lg p-8 text-center text-mute text-sm">
    {children}
  </div>
);
const Stat = ({ l, v }) => (
  <div className="bg-white border border-sage rounded-lg p-4">
    <div className="text-xs text-mute">{l}</div>
    <div className="text-2xl font-semibold text-forest mt-1">{v}</div>
  </div>
);
function Mat({ d, cell, rowT, colT, hl }) {
  return (
    <div className="overflow-x-auto">
      <table className="text-sm w-full">
        <thead>
          <tr>
            <th></th>
            {d.hospitals.map((h) => (
              <th key={h} className="font-medium text-mute">
                {h}
              </th>
            ))}
            {rowT && <th className="text-mute">Σ</th>}
          </tr>
        </thead>
        <tbody>
          {d.banks.map((b, i) => (
            <tr key={b}>
              <td className="font-medium">{b}</td>
              {d.hospitals.map((_, j) => (
                <td
                  key={j}
                  className={
                    d.mode[i][j] === "ban"
                      ? "bg-clay/10 text-clay"
                      : d.mode[i][j] === "cap"
                        ? "bg-ochre/10"
                        : ""
                  }
                  style={
                    hl && hl[0] === i && hl[1] === j
                      ? { outline: "2px solid #2E5A47" }
                      : {}
                  }
                >
                  {cell(i, j)}
                </td>
              ))}
              {rowT && <td className="text-mute">{rowT(i)}</td>}
            </tr>
          ))}
          {colT && (
            <tr>
              <td className="text-mute">Σ</td>
              {d.hospitals.map((_, j) => (
                <td key={j} className="text-mute">
                  {colT(j)}
                </td>
              ))}
              {rowT && <td />}
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
const allocCell = (d, al) => (i, j) =>
  d.mode[i][j] === "ban" ? "✕" : al[i][j] || "·";
const money = (n) => n.toLocaleString();
const Legend2 = () => (
  <p className="text-xs text-mute mt-2">
    <span className="text-clay">✕ / coral</span> ={" "}
    <Tip t="Prohibited lane: allocation fixed at zero">prohibited lane</Tip> ·{" "}
    <span className="bg-ochre/10 px-1">amber</span> ={" "}
    <Tip t="Capacity cap: upper bound on units on this route">capacity cap</Tip>
  </p>
);

export function Overview() {
  const { d, v, run, stale } = useContext(Ctx);
  const sol = run?.sol;
  const data = [
    ...d.banks.map((n, i) => ({ n, Supply: +d.supply[i] })),
    ...d.hospitals.map((n, j) => ({ n, Demand: +d.demand[j] })),
  ];
  const init = run?.vam.complete ? run.vam.cost : null;
  const checks = sol?.feasible ? checkPlan(d, sol.alloc) : null;
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <Stat l="Blood banks" v={d.banks.length} />
        <Stat l="Hospitals" v={d.hospitals.length} />
        <Stat l="Total supply (units)" v={sum(d.supply)} />
        <Stat l="Total demand (units)" v={sum(d.demand)} />
        <Stat l="Initial cost (VAM)" v={init != null ? money(init) : "—"} />
        <Stat l="Optimized cost" v={sol?.feasible ? money(sol.cost) : "—"} />
      </div>
      {stale && (
        <Note kind="warn">
          The dataset changed after the last run. Results below are outdated.
        </Note>
      )}
      <div className="grid lg:grid-cols-2 gap-5">
        <Card title="Initial vs optimized cost">
          {sol?.feasible && init != null ? (
            <ResponsiveContainer height={220}>
              <BarChart
                data={[
                  { n: "VAM initial", c: init },
                  { n: "Optimal", c: sol.cost },
                ]}
              >
                <CartesianGrid stroke="#E3EAE0" vertical={false} />
                <XAxis dataKey="n" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="c" fill="#4B7F63" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <Empty>Run the optimization to compare costs.</Empty>
          )}
        </Card>
        <Card title="Supply vs demand">
          <ResponsiveContainer height={220}>
            <BarChart data={data}>
              <CartesianGrid stroke="#E3EAE0" vertical={false} />
              <XAxis dataKey="n" fontSize={11} />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="Supply" fill="#2E5A47" />
              <Bar dataKey="Demand" fill="#C79A3E" />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>
      <div className="grid lg:grid-cols-2 gap-5">
        <Card title="Constraint status">
          {v.errors.length ? (
            <div className="space-y-1">
              {v.errors.map((e) => (
                <Note key={e} kind="err">
                  {e}
                </Note>
              ))}
            </div>
          ) : checks ? (
            <ul className="text-sm space-y-1.5">
              {checks.map(([l, ok]) => (
                <li key={l} className="flex justify-between">
                  <span>{l}</span>
                  <span className={ok ? "text-moss" : "text-clay"}>
                    {ok ? "Satisfied" : "Violated"}
                  </span>
                </li>
              ))}
              <li className="flex justify-between font-semibold border-t border-sage pt-1.5">
                <span>Overall</span>
                <span className="text-forest">
                  {checks.every((c) => c[1]) ? "Valid" : "Invalid"}
                </span>
              </li>
            </ul>
          ) : (
            <p className="text-sm text-mute">
              Input is valid. Run the optimization to check the plan.
            </p>
          )}
        </Card>
        <Card title="Recent activity">
          <ul className="text-sm space-y-1.5">
            <li>Dataset: {d.name}</li>
            <li>Last run: {run ? run.at : "none"}</li>
            <li>
              Status: {!run ? "No results" : stale ? "Outdated" : "Current"}
            </li>
            <li>Solver result: {sol ? sol.status : "—"}</li>
          </ul>
        </Card>
      </div>
    </div>
  );
}

export function Input() {
  const { d, setD, v } = useContext(Ctx);
  const set = (f) =>
    setD((p) => {
      const n = structuredClone(p);
      f(n);
      return n;
    });
  const addBank = () =>
    set((n) => {
      n.banks.push("Bank " + (n.banks.length + 1));
      n.supply.push(0);
      n.cost.push(n.hospitals.map(() => 0));
      n.mode.push(n.hospitals.map(() => "ok"));
      n.cap.push(n.hospitals.map(() => 0));
    });
  const addHosp = () =>
    set((n) => {
      n.hospitals.push("Hospital " + (n.hospitals.length + 1));
      n.demand.push(0);
      n.cost.forEach((r) => r.push(0));
      n.mode.forEach((r) => r.push("ok"));
      n.cap.forEach((r) => r.push(0));
    });
  const delBank = (i) =>
    d.banks.length > 1 &&
    set((n) => {
      [n.banks, n.supply, n.cost, n.mode, n.cap].forEach((a) => a.splice(i, 1));
    });
  const delHosp = (j) =>
    d.hospitals.length > 1 &&
    set((n) => {
      n.hospitals.splice(j, 1);
      n.demand.splice(j, 1);
      [n.cost, n.mode, n.cap].forEach((m) => m.forEach((r) => r.splice(j, 1)));
    });
  const num = (x) => (x === "" ? "" : +x);
  const w = "w-16 text-right";
  const [msg, setMsg] = useState(null);
  const restrictions = [];
  d.mode.forEach((r, i) =>
    r.forEach((m, j) => m !== "ok" && restrictions.push([i, j, m])),
  );
  return (
    <div className="space-y-5">
      <Card
        title="Data actions"
        right={
          <div className="flex gap-2 flex-wrap">
            <Btn kind="s" onClick={() => setMsg(validate(d))}>
              Validate data
            </Btn>
            <Btn kind="s" onClick={() => setD(demo())}>
              Load demo data
            </Btn>
            <Btn
              kind="s"
              onClick={() =>
                confirm(
                  "Reset to an empty dataset? Current data will be lost.",
                ) && setD(empty())
              }
            >
              Reset dataset
            </Btn>
          </div>
        }
      >
        <p className="text-sm text-mute">
          Edits are kept in the application state as you type. Total supply must
          equal total demand; the app never adjusts your numbers to force
          balance.
        </p>
        {msg &&
          (msg.errors.length ? (
            <div className="mt-3 space-y-1">
              {msg.errors.map((e) => (
                <Note key={e} kind="err">
                  {e}
                </Note>
              ))}
            </div>
          ) : (
            <div className="mt-3">
              <Note>Data is valid and balanced.</Note>
            </div>
          ))}
        {!msg && v.errors.length > 0 && (
          <div className="mt-3 space-y-1">
            {v.errors.map((e) => (
              <Note key={e} kind="err">
                {e}
              </Note>
            ))}
          </div>
        )}
      </Card>
      <div className="grid lg:grid-cols-2 gap-5">
        <Card
          title="Blood banks and supply"
          right={
            <Btn kind="s" onClick={addBank}>
              Add bank
            </Btn>
          }
        >
          <table className="w-full text-sm">
            <tbody>
              {d.banks.map((b, i) => (
                <tr key={i}>
                  <td>
                    <input
                      aria-label="Bank name"
                      value={b}
                      onChange={(e) =>
                        set((n) => {
                          n.banks[i] = e.target.value;
                        })
                      }
                    />
                  </td>
                  <td>
                    <input
                      aria-label={`Supply ${b}`}
                      type="number"
                      min="0"
                      className={w}
                      value={d.supply[i]}
                      onChange={(e) =>
                        set((n) => {
                          n.supply[i] = num(e.target.value);
                        })
                      }
                    />
                  </td>
                  <td>
                    <button
                      className="text-clay text-xs border-2 border-clay p-1.5 rounded-lg"
                      onClick={() => delBank(i)}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <Card
          title="Hospitals and demand"
          right={
            <Btn kind="s" onClick={addHosp}>
              Add hospital
            </Btn>
          }
        >
          <table className="w-full text-sm">
            <tbody>
              {d.hospitals.map((b, j) => (
                <tr key={j}>
                  <td>
                    <input
                      aria-label="Hospital name"
                      value={b}
                      onChange={(e) =>
                        set((n) => {
                          n.hospitals[j] = e.target.value;
                        })
                      }
                    />
                  </td>
                  <td>
                    <input
                      aria-label={`Demand ${b}`}
                      type="number"
                      min="0"
                      className={w}
                      value={d.demand[j]}
                      onChange={(e) =>
                        set((n) => {
                          n.demand[j] = num(e.target.value);
                        })
                      }
                    />
                  </td>
                  <td>
                    <button
                      className="text-clay text-xs border-2 border-clay p-1.5 rounded-lg"
                      onClick={() => delHosp(j)}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
      <Card title="Transportation cost matrix (per unit)">
        <div className="overflow-x-auto">
          <table className="text-sm">
            <thead>
              <tr>
                <th></th>
                {d.hospitals.map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {d.banks.map((b, i) => (
                <tr key={i}>
                  <td className="font-medium">{b}</td>
                  {d.hospitals.map((_, j) => {
                    const m = d.mode[i][j];
                    return (
                      <td
                        key={j}
                        className={
                          m === "ban"
                            ? "bg-clay/10"
                            : m === "cap"
                              ? "bg-ochre/10"
                              : ""
                        }
                      >
                        <input
                          aria-label={`Cost ${b} to ${d.hospitals[j]}`}
                          type="number"
                          min="0"
                          disabled={m === "ban"}
                          className="w-14 text-right"
                          value={m === "ban" ? "" : d.cost[i][j]}
                          onChange={(e) =>
                            set((n) => {
                              n.cost[i][j] = num(e.target.value);
                            })
                          }
                        />
                        <div className="mt-1 flex gap-1">
                          <select
                            aria-label="Route type"
                            value={m}
                            onChange={(e) =>
                              set((n) => {
                                n.mode[i][j] = e.target.value;
                                if (e.target.value === "cap" && !n.cap[i][j])
                                  n.cap[i][j] = 10;
                              })
                            }
                          >
                            <option value="ok">Allowed</option>
                            <option value="ban">Prohibited</option>
                            <option value="cap">Cap</option>
                          </select>
                          {m === "cap" && (
                            <input
                              aria-label="Capacity"
                              type="number"
                              min="0"
                              className="w-14"
                              value={d.cap[i][j]}
                              onChange={(e) =>
                                set((n) => {
                                  n.cap[i][j] = num(e.target.value);
                                })
                              }
                            />
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Legend2 />
      </Card>
      <Card title="Route restrictions">
        {restrictions.length ? (
          <ul className="text-sm divide-y divide-mist">
            {restrictions.map(([i, j, m]) => (
              <li key={i + "-" + j} className="py-1.5 flex justify-between">
                <span>
                  {d.banks[i]} → {d.hospitals[j]}:{" "}
                  {m === "ban"
                    ? "prohibited (allocation = 0)"
                    : `capped at ${d.cap[i][j]} units`}
                </span>
                <button
                  className="text-clay text-xs border-2 border-clay p-1.5 rounded-lg"
                  onClick={() =>
                    set((n) => {
                      n.mode[i][j] = "ok";
                    })
                  }
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-mute">
            No restrictions. Set a route type in the matrix above to add one.
          </p>
        )}
      </Card>
    </div>
  );
}

export function Optimization() {
  const { d, v, run, stale, doRun } = useContext(Ctx);
  const [k, setK] = useState(0);
  useEffect(() => setK(0), [run]);
  if (v.errors.length)
    return <Note kind="err">Fix the input errors first ({v.errors[0]}).</Note>;
  if (!run)
    return (
      <Empty>
        <p className="mb-3">No results yet.</p>
        <Btn onClick={doRun}>Run optimization</Btn>
      </Empty>
    );
  const { vam: V, sol } = run;
  const s = V.steps[k - 1];



const selectedCell = s?.cell ?? null;
const al = s?.al ?? null;
  const stages = [
    "Input validation",
    "VAM initial solution",
    "Exact solver",
    "Optimality verification",
  ];
  return (
    <div className="space-y-5">
      {stale && (
        <Note kind="warn">
          Dataset changed since this run. Press "Run optimization" in the header
          to refresh.
        </Note>
      )}
      <div className="flex flex-wrap gap-2 text-sm">
        {stages.map((x, i) => (
          <span key={x} className="px-3 py-1.5 rounded-md bg-ok text-forest">
            {i + 1}. {x}
          </span>
        ))}
      </div>
      <Card
        title="VAM: Vogel's Approximation Method"
        right={
          <div className="flex gap-2">
            <Btn kind="s" disabled={k === 0} onClick={() => setK(k - 1)}>
              Previous step
            </Btn>
            <Btn
              kind="s"
              disabled={k >= V.steps.length}
              onClick={() => setK(k + 1)}
            >
              Next step
            </Btn>
          </div>
        }
      >
        <p className="text-sm text-mute mb-3">
          Step {k} of {V.steps.length}. Prohibited cells are excluded and capped
          cells stop at their bound. VAM is a heuristic, so its result is a
          starting point and not necessarily optimal.
        </p>
      <Mat
  d={d}
  cell={(i, j) =>
    d.mode[i][j] === "ban"
      ? "✕"
      : `${d.cost[i][j]} [${al?.[i]?.[j] ?? 0}]`
  }
  hl={selectedCell}
  rowT={(i) => (s ? s.rs[i] : d.supply[i])}
  colT={(j) => (s ? s.cs[j] : d.demand[j])}
/>
       
        {s ? (
  <div className="mt-3 text-sm space-y-1">
    <p>
      Selected line: <b>{s.chosen_line}</b>
    </p>

    <p>
      Maximum penalty: <b>{s.max_penalty}</b>
    </p>

    <p>
      Selected route: <b>{s.route}</b>
    </p>

    <p>
      Allocated units: <b>{s.allocated}</b>
    </p>

    <p>
      Unit cost: <b>{s.unit_cost}</b>
    </p>

    {s.cap_reached && (
      <p className="text-amber-700">
        Capacity limit reached.
      </p>
    )}
  </div>
) : (
  <p className="mt-3 text-sm text-mute">
    Press Next step to inspect the VAM decisions.
  </p>
)}
        <div className="mt-3 text-sm">
          Initial plan:{" "}
          {V.complete ? (
            <>
              cost <b>{money(V.cost)}</b>
            </>
          ) : (
            <span className="text-clay">
              VAM could not place all units under the restrictions. The exact
              solver below still decides feasibility.
            </span>
          )}
        </div>
      </Card>
      <Card
        title="Exact solver result"
        right={
          <span
            className={`text-sm font-medium ${sol.feasible ? "text-moss" : "text-clay"}`}
          >
            {sol.feasible ? "Optimal (verified)" : "Infeasible"}
          </span>
        }
      >
        <Card title="MODI Optimization Iterations">
  <div className="overflow-x-auto">
    <table className="w-full text-sm">
      <thead>
        <tr>
          <th>Iteration</th>
          <th>Cost (Z)</th>
          <th>Entering</th>
          <th>Delta</th>
          <th>Theta</th>
          <th>Leaving</th>
        </tr>
      </thead>

      <tbody>
        {(run.raw?.modi_iterations ?? []).map((step) => (
          <tr key={step.iteration}>
            <td>{step.iteration}</td>
            <td>{step.Z}</td>
            <td>{step.entering}</td>
            <td>{step.delta_entering ?? "—"}</td>
            <td>{step.theta ?? "—"}</td>
            <td>{step.leaving ?? "—"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
</Card>
        {sol.feasible ? (
          <>
            <p className="text-sm text-mute mb-3">
  The initial solution is calculated using VAM,
  then improved using MODI to reach the optimal allocation.
  The final solution is independently verified using
  SciPy Linear Programming.
</p>
            <Mat
              d={d}
              cell={allocCell(d, sol.alloc)}
              rowT={(i) => sum(sol.alloc[i])}
              colT={(j) => sol.alloc.reduce((s, r) => s + r[j], 0)}
            />
            <Legend2 />
            <div className="grid grid-cols-3 gap-3 mt-4 text-sm">
              <div>
                Final cost
                <div className="text-xl font-semibold text-forest">
                  {money(sol.cost)}
                </div>
              </div>
              <div>
                Initial (VAM)
                <div className="text-xl font-semibold">
                  {V.complete ? money(V.cost) : "—"}
                </div>
              </div>
              <div>
                Reduction
                <div className="text-xl font-semibold text-moss">
                  {V.complete
                    ? `${money(V.cost - sol.cost)} (${V.cost ? (((V.cost - sol.cost) / V.cost) * 100).toFixed(1) : 0}%)`
                    : "—"}
                </div>
              </div>
            </div>
            <ul className="mt-4 text-sm space-y-1">
              {checkPlan(d, sol.alloc).map(([l, ok]) => (
                <li key={l} className="flex justify-between">
                  <span>{l}</span>
                  <span className={ok ? "text-moss" : "text-clay"}>
                    {ok ? "Satisfied" : "Violated"}
                  </span>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <Note kind="err">
            No plan satisfies all supply, demand, prohibited-route and capacity
            constraints. Relax a restriction.
          </Note>
        )}
      </Card>
    </div>
  );
}

export function Simulation() {
  const { d, run, stale } = useContext(Ctx);
  const [k, setK] = useState(0),
    [play, setPlay] = useState(false),
    [spd, setSpd] = useState(900),
    [sel, setSel] = useState(null);
  const sol = run?.sol;
  const routes = [];
  if (sol?.feasible)
    sol.alloc.forEach((r, i) =>
      r.forEach((q, j) => q > 0 && routes.push({ i, j, q })),
    );
  useEffect(() => {
    setK(0);
    setPlay(false);
  }, [run]);
  useEffect(() => {
    if (!play) return;
    if (k >= routes.length) {
      setPlay(false);
      return;
    }
    const t = setTimeout(() => setK((x) => x + 1), spd);
    return () => clearTimeout(t);
  }, [play, k, spd, routes.length]);
  if (!sol?.feasible)
    return (
      <Empty>
        No valid allocation plan. Run the optimization on a valid dataset first.
      </Empty>
    );
  const done = routes.slice(0, k),
    sent = (i) => done.filter((r) => r.i === i).reduce((s, r) => s + r.q, 0),
    got = (j) => done.filter((r) => r.j === j).reduce((s, r) => s + r.q, 0);
  const H = Math.max(d.banks.length, d.hospitals.length) * 70 + 30,
    y = (n, c) => 30 + ((H - 30) / c) * (n + 0.5);
  const maxQ = Math.max(...routes.map((r) => r.q));
  return (
    <div className="space-y-4">
      {stale && (
        <Note kind="warn">Plan is outdated. Re-run the optimization.</Note>
      )}
      <Card
        title="Allocation plan playback"
        right={
          <div className="flex gap-2 items-center flex-wrap noprint">
            <Btn
              onClick={() => setPlay(!play)}
              disabled={k >= routes.length && !play}
            >
              {play ? "Pause" : "Play"}
            </Btn>
            <Btn
              kind="s"
              onClick={() => setK(Math.max(0, k - 1))}
              disabled={!k}
            >
              Previous
            </Btn>
            <Btn
              kind="s"
              onClick={() => setK(Math.min(routes.length, k + 1))}
              disabled={k >= routes.length}
            >
              Next step
            </Btn>
            <Btn
              kind="s"
              onClick={() => {
                setK(0);
                setPlay(false);
              }}
            >
              Reset
            </Btn>
            <select
              aria-label="Speed"
              value={spd}
              onChange={(e) => setSpd(+e.target.value)}
            >
              <option value={1600}>Slow</option>
              <option value={900}>Normal</option>
              <option value={350}>Fast</option>
            </select>
          </div>
        }
      >
        <p className="text-sm text-mute mb-2">
          Step {k} of {routes.length}. Each step releases one route of the
          computed plan. This is an illustration of the plan, not vehicle
          tracking.
        </p>
        <svg
          viewBox={`0 0 760 ${H}`}
          className="w-full"
          role="img"
          aria-label="Distribution network"
        >
          {d.banks.flatMap((_, i) =>
            d.hospitals.map((_, j) =>
              d.mode[i][j] === "ban" ? (
                <line
                  key={i + "b" + j}
                  x1="170"
                  y1={y(i, d.banks.length)}
                  x2="590"
                  y2={y(j, d.hospitals.length)}
                  stroke="#C4685C"
                  strokeDasharray="4 5"
                  opacity=".45"
                />
              ) : null,
            ),
          )}
          {routes.map((r, n) => {
            const on = n < k,
              cap = d.mode[r.i][r.j] === "cap" && r.q >= d.cap[r.i][r.j],
              x1 = 170,
              y1 = y(r.i, d.banks.length),
              x2 = 590,
              y2 = y(r.j, d.hospitals.length);
            return (
              <g
                key={n}
                onClick={() => setSel({ t: "route", ...r })}
                style={{ cursor: "pointer" }}
                tabIndex={0}
                onKeyDown={(e) =>
                  e.key === "Enter" && setSel({ t: "route", ...r })
                }
                aria-label={`${d.banks[r.i]} to ${d.hospitals[r.j]}: ${r.q} units`}
              >
                <line
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke={cap ? "#C79A3E" : "#4B7F63"}
                  strokeWidth={2 + (r.q / maxQ) * 9}
                  opacity={on ? 0.9 : 0.12}
                  strokeLinecap="round"
                />
                <text
                  x={(x1 + x2) / 2}
                  y={(y1 + y2) / 2 - 5}
                  fontSize="12"
                  textAnchor="middle"
                  fill="#2F3A33"
                  opacity={on ? 1 : 0.25}
                >
                  {r.q}
                </text>
              </g>
            );
          })}
          {d.banks.map((b, i) => (
            <g
              key={b}
              onClick={() => setSel({ t: "bank", i })}
              style={{ cursor: "pointer" }}
            >
              <rect
                x="20"
                y={y(i, d.banks.length) - 22}
                width="150"
                height="44"
                rx="6"
                fill="#EBF0E7"
                stroke="#2E5A47"
              />
              <text
                x="30"
                y={y(i, d.banks.length) - 3}
                fontSize="13"
                fill="#2E5A47"
                fontWeight="600"
              >
                {b}
              </text>
              <text
                x="30"
                y={y(i, d.banks.length) + 14}
                fontSize="11"
                fill="#7A8478"
              >
                left {d.supply[i] - sent(i)} of {d.supply[i]}
              </text>
            </g>
          ))}
          {d.hospitals.map((b, j) => (
            <g
              key={b}
              onClick={() => setSel({ t: "hosp", j })}
              style={{ cursor: "pointer" }}
            >
              <rect
                x="590"
                y={y(j, d.hospitals.length) - 22}
                width="150"
                height="44"
                rx="6"
                fill="#fff"
                stroke="#4B7F63"
              />
              <text
                x="600"
                y={y(j, d.hospitals.length) - 3}
                fontSize="13"
                fill="#2E5A47"
                fontWeight="600"
              >
                {b}
              </text>
              <text
                x="600"
                y={y(j, d.hospitals.length) + 14}
                fontSize="11"
                fill="#7A8478"
              >
                got {got(j)} of {d.demand[j]}
              </text>
            </g>
          ))}
        </svg>
        <div className="flex gap-4 text-xs text-mute mt-1">
          <span>
            <i className="inline-block w-4 h-1 bg-moss align-middle" /> active
            route
          </span>
          <span>
            <i className="inline-block w-4 h-1 bg-ochre align-middle" /> at
            capacity cap
          </span>
          <span>
            <i className="inline-block w-4 border-t border-dashed border-clay align-middle" />{" "}
            prohibited
          </span>
        </div>
      </Card>
      <div className="grid lg:grid-cols-2 gap-4">
        <Card title="Fulfillment">
          {d.hospitals.map((h, j) => (
            <div key={h} className="mb-2 text-sm">
              <div className="flex justify-between">
                <span>{h}</span>
                <span>{Math.round((got(j) / d.demand[j]) * 100) || 0}%</span>
              </div>
              <div className="h-2 bg-mist rounded">
                <div
                  className="h-2 bg-moss rounded"
                  style={{ width: `${(got(j) / d.demand[j]) * 100 || 0}%` }}
                />
              </div>
            </div>
          ))}
        </Card>
        <Card title="Details">
          {!sel ? (
            <p className="text-sm text-mute">
              Select a bank, hospital or route.
            </p>
          ) : sel.t === "route" ? (
            <p className="text-sm">
              {d.banks[sel.i]} → {d.hospitals[sel.j]}
              <br />
              Units: {sel.q}
              <br />
              Unit cost: {d.cost[sel.i][sel.j]} · Route cost:{" "}
              {sel.q * d.cost[sel.i][sel.j]}
              <br />
              {d.mode[sel.i][sel.j] === "cap"
                ? `Capacity use: ${sel.q}/${d.cap[sel.i][sel.j]} (${Math.round((sel.q / d.cap[sel.i][sel.j]) * 100)}%)`
                : "No capacity cap"}
            </p>
          ) : sel.t === "bank" ? (
            <p className="text-sm">
              {d.banks[sel.i]}
              <br />
              Supply: {d.supply[sel.i]} · Shipped so far: {sent(sel.i)}
            </p>
          ) : (
            <p className="text-sm">
              {d.hospitals[sel.j]}
              <br />
              Demand: {d.demand[sel.j]} · Delivered so far: {got(sel.j)}
            </p>
          )}
        </Card>
      </div>
    </div>
  );
}

export function WhatIf() {
 const { d, run, setScn, scn, stale } = useContext(Ctx);

  const [scenarioLoading, setScenarioLoading] = useState(false);
  const [scenarioError, setScenarioError] = useState(null);

  const [type, setType] = useState("cost"),
    [j, setJ] = useState(0),
    [i, setI] = useState(0),
    [val, setVal] = useState(20);
  const base = run?.sol;
  const go = async () => {
  if (scenarioLoading || stale) return;

  const c = structuredClone(d);
  let label = "";

  const bankIndex = Number(i);
  const hospitalIndex = Number(j);
  const value = Number(val);

  if (type === "cost") {
   c.cost.forEach((row, bankIndex) => {
  if (c.mode[bankIndex][hospitalIndex] === "ban") return;

  row[hospitalIndex] =
    Math.round(
      Number(row[hospitalIndex]) * (1 + value / 100) * 100
    ) / 100;
});

    label = `Costs to ${d.hospitals[hospitalIndex]} +${value}%`;
  }

  if (type === "demand") {
    c.demand[hospitalIndex] = value;
    label = `Demand of ${d.hospitals[hospitalIndex]} = ${value}`;
  }

  if (type === "cap") {
    c.mode[bankIndex][hospitalIndex] = "cap";
    c.cap[bankIndex][hospitalIndex] = value;

    label = `Capacity ${d.banks[bankIndex]} → ${d.hospitals[hospitalIndex]} = ${value}`;
  }

  if (type === "ban") {
    c.mode[bankIndex][hospitalIndex] = "ban";

    label = `Prohibit ${d.banks[bankIndex]} → ${d.hospitals[hospitalIndex]}`;
  }

  const vv = validate(c);

  if (vv.errors.length) {
    setScenarioError(null);
    setScn({
      label,
      data: c,
      errors: vv.errors,
      sol: null,
    });
    return;
  }

  setScenarioLoading(true);
  setScenarioError(null);
  setScn(null);

  try {
    const response = await optimizeApi(c);
    const adapted = adaptResult(response, c);

    setScn({
      label,
      data: c,
      errors: [],
      sol: adapted.sol,
      vam: adapted.vam,
      raw: response,
    });
  } catch (err) {
    const detail = err.response?.data?.detail;

    setScenarioError(
      typeof detail === "string"
        ? detail
        : detail
          ? JSON.stringify(detail)
          : "Failed to run scenario"
    );
  } finally {
    setScenarioLoading(false);
  }
};
  if (!base?.feasible)
    return <Empty>Run a successful baseline optimization first.</Empty>;
  const s = scn?.sol,
    changed = [];
  if (s?.feasible)
    d.banks.forEach((b, a) =>
      d.hospitals.forEach(
        (h, c) =>
          base.alloc[a][c] !== s.alloc[a][c] &&
          changed.push(`${b} → ${h}: ${base.alloc[a][c]} → ${s.alloc[a][c]}`),
      ),
    );
  const needsRoute = type === "cap" || type === "ban";
  return (
    <div className="space-y-5">
      <Card title="Scenario controls">
        <p className="text-sm text-mute mb-3">
          Each run uses a separate copy of the dataset. The baseline is never
          changed. Results are recomputed by the exact solver.
        </p>
        <div className="flex flex-wrap gap-3 items-end text-sm">
          <label>
            Scenario
            <br />
            <select value={type} onChange={(e) => setType(e.target.value)}>
              <option value="cost">Raise cost to hospital</option>
              <option value="demand">Change hospital demand</option>
              <option value="cap">Reduce route capacity</option>
              <option value="ban">Prohibit a route</option>
            </select>
          </label>
          {needsRoute && (
            <label>
              Bank
              <br />
              <select value={i} onChange={(e) => setI(+e.target.value)}>
                {d.banks.map((b, x) => (
                  <option key={b} value={x}>
                    {b}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label>
            Hospital
            <br />
            <select value={j} onChange={(e) => setJ(+e.target.value)}>
              {d.hospitals.map((b, x) => (
                <option key={b} value={x}>
                  {b}
                </option>
              ))}
            </select>
          </label>
          {type !== "ban" && (
            <label>
              {type === "cost"
                ? "Increase (%)"
                : type === "demand"
                  ? "New demand"
                  : "New cap"}
              <br />
              <input
                type="number"
                min="0"
                className="w-24"
                value={val}
                onChange={(e) => setVal(e.target.value)}
              />
            </label>
          )}
          <Btn
  onClick={go}
 disabled={scenarioLoading || stale || !base?.feasible}
>
  {scenarioLoading ? "Calculating..." : "Run scenario"}
</Btn>
          <Btn kind="s" onClick={() => setScn(null)}>
            Reset to baseline
          </Btn>
        </div>
      </Card>
      {stale && (
  <Note kind="warn">
    Baseline results are outdated. Run optimization again first.
  </Note>
)}

{scenarioError && (
  <Note kind="err">
    {scenarioError}
  </Note>
)}
      {scn && (
        <Card title={`Scenario: ${scn.label}`}>
          {scn.errors.length ? (
            <div className="space-y-1">
              {scn.errors.map((e) => (
                <Note key={e} kind="err">
                  {e}
                </Note>
              ))}
              <p className="text-sm text-mute">
                Infeasible or unbalanced scenario: no cost is shown.
              </p>
            </div>
          ) : !s?.feasible ? (
            <Note kind="err">
              Infeasible: constraints cannot all be satisfied.
            </Note>
          ) : (
            <>
              <div className="grid grid-cols-4 gap-3 text-sm mb-4">
                <div>
                  Baseline
                  <div className="text-xl font-semibold">
                    {money(base.cost)}
                  </div>
                </div>
                <div>
                  Scenario
                  <div className="text-xl font-semibold text-forest">
                    {money(s.cost)}
                  </div>
                </div>
                <div>
                  Difference
                  <div className="text-xl font-semibold">
                    {s.cost - base.cost > 0 ? "+" : ""}
                    {Math.round((s.cost - base.cost) * 100) / 100}
                  </div>
                </div>
                <div>
                  Change
                  <div className="text-xl font-semibold">
                    {base.cost
                      ? (((s.cost - base.cost) / base.cost) * 100).toFixed(1)
                      : 0}
                    %
                  </div>
                </div>
              </div>
              <div className="grid lg:grid-cols-2 gap-4">
                <div>
                  <h4 className="text-sm font-medium mb-1">
                    Baseline allocation
                  </h4>
                  <Mat d={d} cell={allocCell(d, base.alloc)} />
                </div>
                <div>
                  <h4 className="text-sm font-medium mb-1">
                    Scenario allocation
                  </h4>
                  <Mat d={scn.data} cell={allocCell(scn.data, s.alloc)} />
                </div>
              </div>
              <p className="text-sm mt-3">
                <b>Changed routes:</b>{" "}
                {changed.length ? changed.join(" · ") : "none"}
              </p>
              <p className="text-sm text-moss mt-1">
                Feasible and optimal under the scenario constraints.
              </p>
            </>
          )}
        </Card>
      )}
    </div>
  );
}

const csv = (rows, name) => {
  const t = rows
    .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([t], { type: "text/csv" }));
  a.download = name;
  a.click();
};
function Tbl({ title, head, rows, file }) {
  return (
    <Card
      title={title}
      right={
        <Btn kind="s" onClick={() => csv([head, ...rows], file)}>
          Export CSV
        </Btn>
      }
    >
      <div className="overflow-x-auto">
        <table className="text-sm w-full">
          <thead>
            <tr>
              {head.map((h) => (
                <th key={h} className="text-mute font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                {r.map((c, k) => (
                  <td key={k}>{c}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
export function Reports() {
  const { d, run, scn, stale } = useContext(Ctx);
  const sol = run?.sol,
    V = run?.vam;
  const mat = (al) =>
    d.banks.map((b, i) => [
      b,
      ...d.hospitals.map((_, j) =>
        d.mode[i][j] === "ban" ? "prohibited" : al[i][j],
      ),
    ]);
  const hd = ["", ...d.hospitals];
  return (
    <div className="space-y-5">
      <div className="flex justify-between items-center noprint">
        <p className="text-sm text-mute">
          {d.name}
          {stale && " · results outdated"}
        </p>
        <Btn onClick={() => window.print()}>Print / save as PDF</Btn>
      </div>
      <Tbl
        title="Supply and demand"
        head={["Node", "Type", "Units"]}
        file="supply_demand.csv"
        rows={[
          ...d.banks.map((b, i) => [b, "Supply", d.supply[i]]),
          ...d.hospitals.map((b, j) => [b, "Demand", d.demand[j]]),
        ]}
      />
      <Tbl
        title="Transportation cost matrix"
        head={hd}
        file="costs.csv"
        rows={d.banks.map((b, i) => [
          b,
          ...d.hospitals.map((_, j) =>
            d.mode[i][j] === "ban" ? "prohibited" : d.cost[i][j],
          ),
        ])}
      />
      <Tbl
        title="Constraint configuration"
        head={["Route", "Restriction"]}
        file="constraints.csv"
        rows={d.banks
          .flatMap((b, i) =>
            d.hospitals.map((h, j) =>
              d.mode[i][j] === "ok"
                ? null
                : [
                    `${b} → ${h}`,
                    d.mode[i][j] === "ban"
                      ? "Prohibited (0)"
                      : `Cap ${d.cap[i][j]}`,
                  ],
            ),
          )
          .filter(Boolean)}
      />
      {sol ? (
        <>
          {V.complete && (
            <Tbl
              title={`Initial allocation (VAM), cost ${money(V.cost)}`}
              head={hd}
              rows={mat(V.alloc)}
              file="initial_allocation.csv"
            />
          )}
          {sol.feasible ? (
            <Tbl
              title={`Final allocation, cost ${money(sol.cost)}, status: optimal (verified by ${sol.engine})`}
              head={hd}
              rows={mat(sol.alloc)}
              file="final_allocation.csv"
            />
          ) : (
            <Note kind="err">Optimization status: infeasible.</Note>
          )}
          {sol.feasible && (
            <Tbl
              title="Constraint validation summary"
              head={["Constraint", "Result"]}
              file="validation.csv"
              rows={checkPlan(d, sol.alloc).map(([l, o]) => [
                l,
                o ? "Satisfied" : "Violated",
              ])}
            />
          )}
        </>
      ) : (
        <Empty>
          Run the optimization to include allocations in the report.
        </Empty>
      )}
      {scn?.sol?.feasible && sol?.feasible && (
        <Tbl
          title={`Scenario comparison: ${scn.label}`}
          head={["Metric", "Value"]}
          file="scenario.csv"
          rows={[
            ["Baseline cost", sol.cost],
            ["Scenario cost", scn.sol.cost],
            ["Difference", scn.sol.cost - sol.cost],
          ]}
        />
      )}
    </div>
  );
}


//  {s ? (
//           <p className="text-sm mt-3">
//             Selected {s.kind}{" "}
//             <b>{s.kind === "row" ? d.banks[s.idx] : d.hospitals[s.idx]}</b>{" "}
//             (largest penalty). Allocated <b>{s.q}</b> units to{" "}
//             {d.banks[s.cell[0]]} → {d.hospitals[s.cell[1]]}. Remaining supply:{" "}
//             {s.rs.join(", ")}. Remaining demand: {s.cs.join(", ")}.
//           </p>
//         ) : (
//           <p className="text-sm mt-3 text-mute">
//             Press Next step. The last column and row show the{" "}
//             <Tip t="Difference between the two lowest available costs in a row or column">
//               penalties
//             </Tip>
//             .
//           </p>
//         )}
// Optimization service layer. Swap these functions for FastAPI calls later.
import { sum } from "./data.js";
export const planCost = (d, al) =>
  al.reduce((s, r, i) => s + r.reduce((t, q, j) => t + q * d.cost[i][j], 0), 0);

// VAM heuristic: prohibited cells are excluded; capped cells stop at their bound.
export function vam(d) {
  const m = d.banks.length,
    h = d.hospitals.length,
    rs = [...d.supply],
    cs = [...d.demand];
  const al = Array.from({ length: m }, () => Array(h).fill(0));
  const room = (i, j) =>
    d.mode[i][j] === "ban"
      ? 0
      : d.mode[i][j] === "cap"
        ? d.cap[i][j] - al[i][j]
        : Infinity;
  const steps = [];
  for (;;) {
    const R = [...Array(m).keys()].filter((i) => rs[i] > 0),
      C = [...Array(h).keys()].filter((j) => cs[j] > 0);
    if (!R.length || !C.length) break;
    const live = (i, j) => room(i, j) > 0;
    const pen = (a) => {
      const s = a.filter((x) => x != null).sort((x, y) => x - y);
      return !s.length ? -1 : s.length === 1 ? 1e6 : s[1] - s[0];
    };
    const rp = R.map((i) =>
      pen(C.map((j) => (live(i, j) ? d.cost[i][j] : null))),
    );
    const cp = C.map((j) =>
      pen(R.map((i) => (live(i, j) ? d.cost[i][j] : null))),
    );
    const best = Math.max(...rp, ...cp);
    if (best < 0) break;
    let kind, idx;
    const ri = rp.indexOf(best);
    if (ri >= 0) {
      kind = "row";
      idx = R[ri];
    } else {
      kind = "col";
      idx = C[cp.indexOf(best)];
    }
    let bi = -1,
      bj = -1,
      bc = Infinity;
    R.forEach((i) =>
      C.forEach((j) => {
        if (
          (kind === "row" ? i === idx : j === idx) &&
          live(i, j) &&
          d.cost[i][j] < bc
        ) {
          bc = d.cost[i][j];
          bi = i;
          bj = j;
        }
      }),
    );
    const q = Math.min(rs[bi], cs[bj], room(bi, bj));
    al[bi][bj] += q;
    rs[bi] -= q;
    cs[bj] -= q;
    const rowPen = Array(m).fill(null),
      colPen = Array(h).fill(null);
    R.forEach((i, k) => (rowPen[i] = rp[k]));
    C.forEach((j, k) => (colPen[j] = cp[k]));
    steps.push({
      kind,
      idx,
      rowPen,
      colPen,
      cell: [bi, bj],
      q,
      rs: [...rs],
      cs: [...cs],
      al: al.map((r) => [...r]),
    });
  }
  return {
    steps,
    alloc: al,
    cost: planCost(d, al),
    complete: sum(rs) === 0 && sum(cs) === 0,
  };
}

// Exact solver: min-cost max-flow (successive shortest paths). Prohibited route = no arc (flow 0),
// capped route = arc with upper bound. Optimal when max flow meets all demand and no negative cycle remains.
export function solve(d) {
  const m = d.banks.length,
    h = d.hospitals.length,
    S = m + h,
    T = S + 1,
    N = T + 1,
    E = [],
    G = Array.from({ length: N }, () => []);
  const add = (u, v, c, w) => {
    G[u].push(E.length);
    E.push({ v, c, w });
    G[v].push(E.length);
    E.push({ v: u, c: 0, w: -w });
  };
  const tot = sum(d.supply),
    idx = {};
  d.supply.forEach((s, i) => add(S, i, +s, 0));
  d.demand.forEach((q, j) => add(m + j, T, +q, 0));
  for (let i = 0; i < m; i++)
    for (let j = 0; j < h; j++)
      if (d.mode[i][j] !== "ban") {
        idx[i + "," + j] = E.length;
        add(
          i,
          m + j,
          d.mode[i][j] === "cap" ? +d.cap[i][j] : tot,
          +d.cost[i][j],
        );
      }
  let flow = 0;
  for (;;) {
    const dist = Array(N).fill(Infinity),
      prev = Array(N).fill(-1),
      inq = Array(N).fill(false);
    dist[S] = 0;
    const q = [S];
    while (q.length) {
      const u = q.shift();
      inq[u] = false;
      for (const e of G[u]) {
        const x = E[e];
        if (x.c > 0 && dist[u] + x.w < dist[x.v]) {
          dist[x.v] = dist[u] + x.w;
          prev[x.v] = e;
          if (!inq[x.v]) {
            inq[x.v] = true;
            q.push(x.v);
          }
        }
      }
    }
    if (dist[T] === Infinity) break;
    let f = Infinity,
      v = T;
    while (v !== S) {
      const e = prev[v];
      f = Math.min(f, E[e].c);
      v = E[e ^ 1].v;
    }
    v = T;
    while (v !== S) {
      const e = prev[v];
      E[e].c -= f;
      E[e ^ 1].c += f;
      v = E[e ^ 1].v;
    }
    flow += f;
  }
  const alloc = Array.from({ length: m }, (_, i) =>
    Array.from({ length: h }, (_, j) =>
      idx[i + "," + j] != null ? E[idx[i + "," + j] ^ 1].c : 0,
    ),
  );
  const feasible = flow === sum(d.demand) && sum(d.supply) === sum(d.demand);
  return {
    alloc,
    cost: planCost(d, alloc),
    feasible,
    status: feasible ? "optimal" : "infeasible",
    flow,
    engine: "Min-cost flow (verified)",
  };
}

export function checkPlan(d, al) {
  const m = d.banks.length,
    h = d.hospitals.length;
  const rowOk = al.every((r, i) => sum(r) === +d.supply[i]);
  const colOk = d.demand.every(
    (q, j) => al.reduce((s, r) => s + r[j], 0) === +q,
  );
  const banOk = al.every((r, i) =>
    r.every((x, j) => d.mode[i][j] !== "ban" || x === 0),
  );
  const capOk = al.every((r, i) =>
    r.every((x, j) => d.mode[i][j] !== "cap" || x <= d.cap[i][j]),
  );
  const nn = al.every((r) => r.every((x) => x >= 0));
  return [
    ["Supply constraints", rowOk],
    ["Demand constraints", colOk],
    ["Prohibited routes (zero allocation)", banOk],
    ["Capacity caps", capOk],
    ["Non-negativity", nn],
  ];
}

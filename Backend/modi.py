

import pandas as pd
import config
from vam import vam

TOL = 1e-8
INF = float('inf')


def modi(sources, dests, cost, supply, demand, prohibited, capacity,
         init_table, verbose=True, max_iter=200):
    """Bounded transportation simplex (MODI / u-v method).

    Returns (final_table, final_cost, iteration_log, delta_table, u, v).
    """
    sources, dests = list(sources), list(dests)
    prohibited = set(prohibited)
    m, n = len(sources), len(dests)
    if not m or not n:
        raise ValueError('Supply and demand dimensions must be nonempty')

    def c(cell):
        s, d = cell
        return float(cost[s][dests.index(d)])

    def upper(cell):
        return float(capacity.get(cell, INF))

    cells = [(s, d) for s in sources for d in dests
             if (s, d) not in prohibited and upper((s, d)) > TOL]
    x = {k: float(init_table.loc[k[0], k[1]]) for k in cells}

    for s in sources:
        if abs(sum(x.get((s, d), 0.0) for d in dests) - float(supply[s])) > 1e-6:
            raise ValueError(f'Initial allocation violates supply for {s}')
    for d in dests:
        if abs(sum(x.get((s, d), 0.0) for s in sources) - float(demand[d])) > 1e-6:
            raise ValueError(f'Initial allocation violates demand for {d}')
    for k in cells:
        if x[k] < -TOL or x[k] > upper(k) + TOL:
            raise ValueError(f'Initial allocation violates bounds: {k}')
        if abs(x[k]) < TOL: x[k] = 0.0
        if upper(k) < INF and abs(x[k] - upper(k)) < TOL: x[k] = upper(k)

    # A feasible transportation flow need not be a basic feasible solution.
    # Remove support cycles without changing any supply/demand totals.
    def support_cycle():
        parent = {}
        def find(a):
            parent.setdefault(a, a)
            if parent[a] != a: parent[a] = find(parent[a])
            return parent[a]
        forest = []
        for k in cells:
            if not (TOL < x[k] < upper(k) - TOL):
                continue
            a, b = ('r', k[0]), ('c', k[1])
            ra, rb = find(a), find(b)
            if ra != rb:
                parent[ra] = rb
                forest.append(k)
            else:
                adj = {}
                for e in forest:
                    u, v = ('r', e[0]), ('c', e[1])
                    adj.setdefault(u, []).append((v, e))
                    adj.setdefault(v, []).append((u, e))
                queue = [(a, [])]
                seen = {a}
                for node, path in queue:
                    if node == b:
                        return [k] + list(reversed(path))
                    for nxt, e in adj.get(node, []):
                        if nxt not in seen:
                            seen.add(nxt)
                            queue.append((nxt, path + [e]))
        return None

    # Convert a nonbasic feasible flow into a basic one by cost-improving
    # or cost-neutral cycle moves, if necessary.
    for _ in range(len(cells) + 1):
        cyc = support_cycle()
        if cyc is None:
            break
        # cycle starts with +, then alternating - / + ...
        plus = cyc[::2]
        minus = cyc[1::2]
        slope = sum(c(k) for k in plus) - sum(c(k) for k in minus)
        if slope <= 0:
            signs = {k: (1 if i % 2 == 0 else -1) for i, k in enumerate(cyc)}
        else:
            signs = {k: (-1 if i % 2 == 0 else 1) for i, k in enumerate(cyc)}
        theta = min((upper(k) - x[k] if sg > 0 else x[k]) for k, sg in signs.items())
        if theta <= TOL:
            raise ValueError('Could not remove a support cycle')
        for k, sg in signs.items():
            x[k] += sg * theta
            if abs(x[k]) < TOL: x[k] = 0.0
            if upper(k) < INF and abs(x[k] - upper(k)) < TOL: x[k] = upper(k)
    else:
        raise ValueError('Could not construct a cycle-free initial basis')

    # Basic arcs form a spanning forest; add zero arcs to connect components.
    def build_basis():
        basis = {k for k in cells if TOL < x[k] < upper(k) - TOL}
        parent = {}
        def find(a):
            parent.setdefault(a, a)
            if parent[a] != a: parent[a] = find(parent[a])
            return parent[a]
        for k in sorted(basis):
            a, b = ('r', k[0]), ('c', k[1])
            ra, rb = find(a), find(b)
            if ra == rb:
                raise ValueError('Cycle remains in initial basis')
            parent[ra] = rb
        # Fixed-at-upper arcs cannot be basic in this representation.
        for k in sorted(cells, key=lambda k: (c(k), k)):
            if k in basis or x[k] > TOL:
                continue
            a, b = ('r', k[0]), ('c', k[1])
            ra, rb = find(a), find(b)
            if ra != rb:
                basis.add(k)
                parent[ra] = rb
        if len(basis) != m + n - 1:
            raise ValueError('Allowed routes cannot form a connected MODI basis')
        return basis

    basis = build_basis()

    def total_cost():
        return sum(x[k] * c(k) for k in cells)

    def potentials():
        u, v = {sources[0]: 0.0}, {}
        for _ in range(m + n):
            for s, d in basis:
                if s in u and d not in v:
                    v[d] = c((s, d)) - u[s]
                elif d in v and s not in u:
                    u[s] = c((s, d)) - v[d]
        if len(u) != m or len(v) != n:
            raise ValueError('Disconnected MODI basis')
        return u, v

    def tree_path(s, d):
        adj = {}
        for k in basis:
            a, b = ('r', k[0]), ('c', k[1])
            adj.setdefault(a, []).append((b, k))
            adj.setdefault(b, []).append((a, k))
        start, goal = ('r', s), ('c', d)
        queue = [(start, [])]
        seen = {start}
        for node, path in queue:
            if node == goal:
                return path
            for nxt, k in adj.get(node, []):
                if nxt not in seen:
                    seen.add(nxt)
                    queue.append((nxt, path + [k]))
        raise ValueError('No path in MODI basis')

    log = []
    for it in range(1, max_iter + 1):
        u, v = potentials()
        dl = {k: c(k) - u[k[0]] - v[k[1]] for k in cells if k not in basis}
        candidates = []
        for k, delta in dl.items():
            at_cap = upper(k) < INF and x[k] >= upper(k) - TOL
            viol = delta if at_cap else -delta
            if viol > TOL:
                candidates.append((-viol, k, at_cap))
        z = total_cost()
        if not candidates:
            log.append({'iteration': it, 'Z': round(z, 6),
                        'entering': 'none (optimal)', 'delta_entering': None})
            break
        _, enter, decreasing = min(candidates)
        path = tree_path(*enter)
        # Path runs from entering row to entering column; alternate signs.
        flip = -1 if decreasing else 1
        change = {enter: flip}
        for idx, k in enumerate(path):
            change[k] = (-flip if idx % 2 == 0 else flip)
        limits = {k: (upper(k) - x[k] if sg > 0 else x[k])
                  for k, sg in change.items()}
        theta = min(limits.values())
        if theta == INF:
            raise ValueError('Unbounded transportation cycle')
        ties = [k for k in change if abs(limits[k] - theta) <= TOL]
        # Prefer leaving a basic arc; if entering itself is limiting,
        # move it from lower to upper (or vice versa) without basis swap.
        basic_ties = sorted(k for k in ties if k != enter)
        leave = basic_ties[0] if basic_ties else enter
        for k, sg in change.items():
            x[k] += sg * theta
            if abs(x[k]) < TOL: x[k] = 0.0
            if upper(k) < INF and abs(x[k] - upper(k)) < TOL: x[k] = upper(k)
        if leave != enter:
            basis.remove(leave)
            basis.add(enter)
        log.append({'iteration': it, 'Z': round(z, 6),
                    'entering': f'{enter[0]}->{enter[1]}',
                    'delta_entering': round(dl[enter], 6),
                    'theta': round(theta, 6),
                    'leaving': f'{leave[0]}->{leave[1]}',
                    'loop': ' | '.join(f'{k[0]}->{k[1]}({"+" if sg > 0 else "-"})'
                                       for k, sg in change.items())})
        if verbose:
            print(f'Iteration {it}: Z={z:g}, entering={enter}, theta={theta:g}, leaving={leave}')
    else:
        raise RuntimeError('MODI reached maximum iterations')

    final = pd.DataFrame([[x.get((s, d), 0.0) for d in dests]
                          for s in sources], index=sources, columns=dests)
    delta_table = pd.DataFrame([
        [dl.get((s, d), 'basic' if (s, d) in basis else 'prohibited')
         for d in dests] for s in sources], index=sources, columns=dests)
    return final, total_cost(), pd.DataFrame(log), delta_table, u, v


if __name__ == '__main__':
    initial, z0, _ = vam(config.SOURCES, config.DESTS, config.COST,
                         config.SUPPLY, config.DEMAND,
                         config.PROHIBITED, config.CAPACITY, verbose=False)
    final, z, log, dtab, u, v = modi(
        config.SOURCES, config.DESTS, config.COST,
        config.SUPPLY, config.DEMAND, config.PROHIBITED,
        config.CAPACITY, initial)
    print('VAM initial cost:', z0)
    print('MODI optimal cost:', z)
    print(final)
    print(log.to_string(index=False))

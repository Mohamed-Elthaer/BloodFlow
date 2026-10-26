# verify.py
# تحقق مستقل: حل بـ linprog + فحص القيود على أي جدول توزيع
import numpy as np
import pandas as pd
from scipy.optimize import linprog

import config
from vam import vam
from modi import modi


def solve_lp(sources, dests, cost, supply, demand, prohibited, capacity):
    """نحل نفس المسألة بـ linprog. ترجع (جدول, تكلفة, حالة)."""
    prohibited = set(prohibited)
    cells = [(s, d) for s in sources for d in dests if (s, d) not in prohibited]
    idx = {cell: n for n, cell in enumerate(cells)}

    c_vec = [cost[s][dests.index(d)] for (s, d) in cells]

    A_eq, b_eq = [], []
    for s in sources:                     # قيد العرض: مجموع الصف = العرض
        row = np.zeros(len(cells))
        for d in dests:
            if (s, d) in idx:
                row[idx[(s, d)]] = 1
        A_eq.append(row); b_eq.append(supply[s])
    for d in dests:                       # قيد الطلب: مجموع العمود = الطلب
        row = np.zeros(len(cells))
        for s in sources:
            if (s, d) in idx:
                row[idx[(s, d)]] = 1
        A_eq.append(row); b_eq.append(demand[d])

    bounds = [(0, capacity.get(cell)) for cell in cells]   # (0, None) = بلا حد أقصى

    res = linprog(c_vec, A_eq=np.array(A_eq), b_eq=b_eq, bounds=bounds, method="highs")
    if not res.success:
        return None, None, res.message

    table = pd.DataFrame(0.0, index=sources, columns=dests)
    for cell, n in idx.items():
        table.loc[cell[0], cell[1]] = round(res.x[n], 6)
    return table, res.fun, "optimal"


def check_solution(table, sources, dests, cost, supply, demand, prohibited, capacity):
    """فحص مستقل للقيود. ترجع (قايمة نتايج, كله تمام؟, التكلفة المعاد حسابها)."""
    results = []

    def add(name, ok, detail=""):
        results.append((name, bool(ok), detail))

    add("no negative values", (table.values >= -1e-9).all())

    for s in sources:
        add(f"supply {s}", abs(table.loc[s].sum() - supply[s]) < 1e-6,
            f"shipped {table.loc[s].sum():g} of {supply[s]}")
    for d in dests:
        add(f"demand {d}", abs(table[d].sum() - demand[d]) < 1e-6,
            f"received {table[d].sum():g} of {demand[d]}")
    for (s, d) in prohibited:
        add(f"prohibited {s}->{d} = 0", abs(table.loc[s, d]) < 1e-9,
            f"x = {table.loc[s, d]:g}")
    for (s, d), cap in capacity.items():
        add(f"capacity {s}->{d} <= {cap}", table.loc[s, d] <= cap + 1e-9,
            f"x = {table.loc[s, d]:g}")

    # إعادة حساب التكلفة من الصفر
    total = 0.0
    for s in sources:
        for d in dests:
            if table.loc[s, d] > 0:
                total += table.loc[s, d] * cost[s][dests.index(d)]
    return results, all(r[1] for r in results), total


def print_checks(results):
    for name, ok, detail in results:
        print(("PASS" if ok else "FAIL"), "-", name, "|", detail)


if __name__ == "__main__":
    args = (config.SOURCES, config.DESTS, config.COST, config.SUPPLY,
            config.DEMAND, config.PROHIBITED, config.CAPACITY)

    init, z0, _ = vam(*args, verbose=False)
    final, z_modi, log, dtab, u, v = modi(*args, init, verbose=False)
    lp_table, z_lp, status = solve_lp(*args)

    print("MODI cost    :", z_modi)
    print("linprog cost :", z_lp, f"({status})")
    print("Costs match  :", abs(z_modi - z_lp) < 1e-6)
    print()

    results, ok, recomputed = check_solution(final, *args)
    print_checks(results)
    print()
    print("Recomputed cost from allocation:", recomputed)
    print("ALL CHECKS PASSED" if ok and abs(recomputed - z_modi) < 1e-6 else "SOMETHING FAILED")
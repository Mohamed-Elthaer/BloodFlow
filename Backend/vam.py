

# vam.py
import pandas as pd
from scipy.optimize import linprog

TOL = 1e-8


def vam(sources, dests, cost, supply, demand,
        prohibited, capacity, verbose=True):

    supply = {s: float(supply[s]) for s in sources}
    demand = {d: float(demand[d]) for d in dests}
    prohibited = set(prohibited)
    cap_left = {k: float(v) for k, v in capacity.items()}

    alloc = {(s, d): 0.0 for s in sources for d in dests}
    steps = []

    cells = [
        (s, d)
        for s in sources
        for d in dests
        if (s, d) not in prohibited
        and cap_left.get((s, d), float("inf")) > TOL
    ]

    def cost_of(s, d):
        return float(cost[s][dests.index(d)])

    def penalty(values):
        values = sorted(values)
        if not values:
            return None
        if len(values) == 1:
            return values[0]
        return values[1] - values[0]

    def feasible_max(target=None):
        """
        Find a feasible completion.
        If target is given, maximize allocation on that route.
        """
        if abs(sum(supply.values()) - sum(demand.values())) > TOL:
            return None

        if not cells:
            return 0.0 if all(v <= TOL for v in supply.values()) else None

        A_eq = []
        b_eq = []

        for s in sources:
            A_eq.append([
                1.0 if cell[0] == s else 0.0
                for cell in cells
            ])
            b_eq.append(max(0.0, supply[s]))

        for d in dests:
            A_eq.append([
                1.0 if cell[1] == d else 0.0
                for cell in cells
            ])
            b_eq.append(max(0.0, demand[d]))

        bounds = [
            (0.0, max(0.0, cap_left[cell]))
            if cell in cap_left
            else (0.0, None)
            for cell in cells
        ]

        objective = [
            -1.0 if cell == target else 0.0
            for cell in cells
        ]

        result = linprog(
            c=objective,
            A_eq=A_eq,
            b_eq=b_eq,
            bounds=bounds,
            method="highs",
        )

        if not result.success:
            return None

        if target is None:
            return 0.0

        return max(0.0, float(result.x[cells.index(target)]))

    if feasible_max() is None:
        raise ValueError(
            "المسألة infeasible: قيود العرض والطلب والطرق والسعات "
            "لا تسمح بتوزيع كامل"
        )

    step = 0

    while any(supply[s] > TOL for s in sources):

        # Candidate routes that allow a feasible completion
        available = {}

        for s, d in cells:
            if supply[s] <= TOL or demand[d] <= TOL:
                continue

            if cap_left.get((s, d), float("inf")) <= TOL:
                continue

            max_qty = feasible_max((s, d))

            if max_qty is not None and max_qty > TOL:
                available[(s, d)] = max_qty

        if not available:
            raise ValueError(
                "تعذر إكمال التوزيع رغم فحص القيود؛ "
                "راجع دقة الأرقام أو حدود السعات"
            )

        row_pen = {}
        col_pen = {}

        for s in sources:
            values = [
                cost_of(s, d)
                for d in dests
                if (s, d) in available
            ]
            p = penalty(values)
            if p is not None:
                row_pen[s] = p

        for d in dests:
            values = [
                cost_of(s, d)
                for s in sources
                if (s, d) in available
            ]
            p = penalty(values)
            if p is not None:
                col_pen[d] = p

        choices = []

        for s, p in row_pen.items():
            candidates = [
                (s, d) for d in dests
                if (s, d) in available
            ]
            cell = min(candidates, key=lambda k: cost_of(*k))
            choices.append((-p, cost_of(*cell), "row", s, cell))

        for d, p in col_pen.items():
            candidates = [
                (s, d) for s in sources
                if (s, d) in available
            ]
            cell = min(candidates, key=lambda k: cost_of(*k))
            choices.append((-p, cost_of(*cell), "col", d, cell))

        _, _, kind, name, (s, d) = min(
            choices,
            key=lambda item: (
                item[0], item[1], item[2], item[3]
            )
        )

        qty = min(
            available[(s, d)],
            supply[s],
            demand[d],
            cap_left.get((s, d), float("inf")),
        )

        alloc[(s, d)] += qty
        supply[s] -= qty
        demand[d] -= qty

        if abs(supply[s]) <= TOL:
            supply[s] = 0.0

        if abs(demand[d]) <= TOL:
            demand[d] = 0.0

        if (s, d) in cap_left:
            cap_left[(s, d)] = max(0.0, cap_left[(s, d)] - qty)

        capped = (
            (s, d) in cap_left
            and cap_left[(s, d)] <= TOL
        )

        step += 1

        chosen_penalty = (
            row_pen[name] if kind == "row"
            else col_pen[name]
        )

        steps.append({
            "step": step,
            "chosen_line": f"{kind} {name}",
            "max_penalty": chosen_penalty,
            "cell": f"{s}->{d}",
            "unit_cost": cost_of(s, d),
            "allocated": qty,
            "cap_reached": capped,
        })

        if verbose:
            print(
                f"Step {step}: {s}->{d}, "
                f"allocate {qty:g}, cost {cost_of(s, d):g}"
            )

    if any(demand[d] > TOL for d in dests):
        raise ValueError("لم يتم تغطية الطلب بالكامل")

    z0 = sum(
    alloc[(s, d)] * cost_of(s, d)
    for s in sources
    for d in dests
    if (s, d) not in prohibited
    and alloc[(s, d)] > TOL
)

    table = pd.DataFrame(
        [
            [alloc[(s, d)] for d in dests]
            for s in sources
        ],
        index=sources,
        columns=dests,
    )

    return table, z0, pd.DataFrame(steps)
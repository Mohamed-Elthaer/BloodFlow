
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, model_validator
from vam import vam
from modi import modi
from scipy.optimize import linprog
import numpy as np
import math

app = FastAPI(title="Transportation Optimization API")

from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# app.add_middleware(
#     CORSMiddleware,
#     allow_origins=["http://localhost:5173"],
#     allow_methods=["*"],
#     allow_headers=["*"],
# )

class CapacityRule(BaseModel):
    source: str
    destination: str
    max_units: float = Field(ge=0)

class TransportationInput(BaseModel):
    sources: list[str]
    destinations: list[str]
    costs: list[list[float | None]]
    supply: list[float]
    demand: list[float]
    capacities: list[CapacityRule] = []

    @model_validator(mode="after")
    def validate_input(self):
        m = len(self.sources)
        n = len(self.destinations)

        if not m or not n:
            raise ValueError("At least one source and destination required")

        if len(set(self.sources)) != m or len(set(self.destinations)) != n:
            raise ValueError("Source and destination names must be unique")

        if (len(self.costs) != m or
            any(len(row) != n for row in self.costs)):
            raise ValueError("Cost matrix dimensions are invalid")

        if len(self.supply) != m or len(self.demand) != n:
            raise ValueError("Supply or demand dimensions are invalid")

        values = self.supply + self.demand + [
            c for row in self.costs for c in row if c is not None
        ]

        if any(not math.isfinite(v) or v < 0 for v in values):
            raise ValueError("Values must be finite and non-negative")

        for rule in self.capacities:
            if rule.source not in self.sources or rule.destination not in self.destinations:
                raise ValueError("Capacity references an unknown route")
            if not math.isfinite(rule.max_units):
                raise ValueError("Capacity must be finite")
            i = self.sources.index(rule.source)
            j = self.destinations.index(rule.destination)
            if self.costs[i][j] is None:
                raise ValueError("Cannot set capacity on a prohibited route")

        if abs(sum(self.supply) - sum(self.demand)) > 1e-7:
            raise ValueError("Total supply must equal total demand")

        return self


@app.get("/")
def home():
    return {"message": "Transportation API Running"}


@app.post("/api/optimize")
def optimize(data: TransportationInput):
    m = len(data.sources)
    n = len(data.destinations)

    cells = []
    costs = []
    bounds = []

    cap_map = {
        (r.source, r.destination): r.max_units
        for r in data.capacities
    }

    for i, source in enumerate(data.sources):
        for j, destination in enumerate(data.destinations):
            cost = data.costs[i][j]

            if cost is None:
                continue

            cells.append((i, j))
            costs.append(cost)
            bounds.append((0, cap_map.get((source, destination))))

    if not cells:
        raise HTTPException(422, "No available transportation routes")

    A_eq = []
    b_eq = []

    for i in range(m):
        A_eq.append([int(row == i) for row, col in cells])
        b_eq.append(data.supply[i])

    for j in range(n):
        A_eq.append([int(col == j) for row, col in cells])
        b_eq.append(data.demand[j])

    result = linprog(
        c=costs,
        A_eq=np.array(A_eq),
        b_eq=np.array(b_eq),
        bounds=bounds,
        method="highs"
    )

    if not result.success:
        raise HTTPException(
            status_code=422,
            detail=f"Optimization failed: {result.message}"
        )

    allocation = [
        [0.0 for _ in range(n)]
        for _ in range(m)
    ]

    for k, (i, j) in enumerate(cells):
        allocation[i][j] = round(float(result.x[k]), 6)

    return {
        "status": "optimal",
        "method": "linprog",
        "total_cost": round(float(result.fun), 6),
        "sources": data.sources,
        "destinations": data.destinations,
        "allocation": allocation,
        "total_supply": sum(data.supply),
        "total_demand": sum(data.demand)
    }



@app.post("/api/solve")
def solve_transportation(data: TransportationInput):
    sources = data.sources
    dests = data.destinations

    cost = {
        s: data.costs[i]
        for i, s in enumerate(sources)
    }

    supply = dict(zip(sources, data.supply))
    demand = dict(zip(dests, data.demand))

    prohibited = [
        (s, d)
        for i, s in enumerate(sources)
        for j, d in enumerate(dests)
        if data.costs[i][j] is None
    ]

    capacity = {
        (r.source, r.destination): r.max_units
        for r in data.capacities
    }

    try:
        # 1. Initial solution using VAM
        initial, z0, vam_steps = vam(
            sources, dests, cost,
            supply, demand,
            prohibited, capacity,
            verbose=False
        )

        # 2. Optimization using MODI
        final, z, modi_log, deltas, u, v = modi(
            sources, dests, cost,
            supply, demand,
            prohibited, capacity,
            initial,
            verbose=False
        )

        # 3. Independent verification
        from verify import solve_lp, check_solution

        _, lp_cost, status = solve_lp(
            sources, dests, cost,
            supply, demand,
            prohibited, capacity
        )

        checks, checks_ok, recomputed = check_solution(
            final, sources, dests, cost,
            supply, demand,
            prohibited, capacity
        )

        matches_lp = (
            lp_cost is not None
            and abs(z - lp_cost) < 1e-6
        )

        if not checks_ok or not matches_lp:
            raise HTTPException(
                status_code=422,
                detail="MODI result failed independent verification"
            )

        def records(df):
            return df.astype(object).where(
                df.notna(), None
            ).to_dict(orient="records")

        return {
            "status": "optimal",
            "initial_cost": round(z0, 6),
            "optimal_cost": round(z, 6),
            "saved_cost": round(z0 - z, 6),
            "improvement_percent": (
                round((z0 - z) / z0 * 100, 2)
                if z0 > 0 else 0
            ),
            "sources": sources,
            "destinations": dests,
            "initial_allocation": initial.to_dict(
                orient="index"
            ),
            "final_allocation": final.to_dict(
                orient="index"
            ),
            "vam_steps": records(vam_steps),
            "modi_iterations": records(modi_log),
            "delta_table": deltas.astype(object).where(
                deltas.notna(), None
            ).to_dict(orient="index"),
            "matches_linprog": matches_lp,
            "checks_passed": checks_ok
        }

    except HTTPException:
        raise
    except (ValueError, RuntimeError) as e:
        raise HTTPException(
            status_code=422,
            detail=str(e)
        )

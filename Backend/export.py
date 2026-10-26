# export.py
# بيشغّل كل السيناريوهات وبيطلّع ملفات للتيم جوه فولدر outputs/
import os
import pandas as pd
import Backend.config as config
from Backend.scenarios import run_all

OUT = "outputs"
DUMMY_PREFIX = "D6_dummy"      # اسم الوجهة الوهمية في Scenario B

SCENARIO_NOTES = {
    "Base": "Balanced problem: supply = demand = 600.",
    "Scenario A": "All D4 costs x1.2 (rounded to 1 decimal).",
    "Scenario B": ("Demands D2=35, D5=15 -> hospital demand 450 vs supply 600. "
                   "A zero-cost dummy destination absorbs the 150 unused units. "
                   "Cost is NOT comparable to Base (fewer units delivered)."),
}


def short_name(name):
    return "Scenario B" if name.startswith("Scenario B") else name


def to_num(x):
    x = float(x)
    return int(x) if x == int(x) else round(x, 6)


def build_tables(results):
    alloc_rows, route_rows, summary_rows = [], [], []
    shadow_rows, vam_rows, modi_rows, unused_rows = [], [], [], []

    for r in results:
        scen = short_name(r["name"])
        sources, dests, cost, supply, demand, prohibited, capacity = r["args"]
        real_dests = [d for d in dests if not d.startswith(DUMMY_PREFIX)]
        final, dtab = r["final"], r["delta_table"]

        delivered = 0
        for s in sources:
            for d in real_dests:
                units = to_num(final.loc[s, d])
                unit_cost = cost[s][dests.index(d)]
                is_prohibited = (s, d) in set(prohibited)
                cap = capacity.get((s, d))
                if units > 0:
                    alloc_rows.append({
                        "scenario": scen, "blood_bank": s, "hospital": d,
                        "units": units, "unit_cost": unit_cost,
                        "total_cost": round(units * unit_cost, 6),
                    })
                    delivered += units

                delta = dtab.loc[s, d]
                if is_prohibited:
                    rc = None
                elif delta in ("basic",):
                    rc = 0
                else:
                    rc = round(float(delta), 6)
                route_rows.append({
                    "scenario": scen, "blood_bank": s, "hospital": d,
                    "units": units, "unit_cost": unit_cost,
                    "capacity": cap,
                    "is_prohibited": is_prohibited,
                    "is_binding": bool(cap is not None and units >= cap),
                    "reduced_cost": rc,
                })

        # الوحدات غير الموزعة (الـ dummy)
        for s in sources:
            for d in dests:
                if d.startswith(DUMMY_PREFIX) and final.loc[s, d] > 0:
                    unused_rows.append({"scenario": scen, "blood_bank": s,
                                        "unused_units": to_num(final.loc[s, d])})
        unused = sum(u["unused_units"] for u in unused_rows if u["scenario"] == scen)

        hospital_demand = sum(demand[d] for d in real_dests)
        summary_rows.append({
            "scenario": scen,
            "status": "optimal" if r["lp_status"] == "optimal" else r["lp_status"],
            "total_cost": to_num(r["z"]),
            "initial_vam_cost": to_num(r["z0"]),
            "units_delivered": delivered,
            "hospital_demand": hospital_demand,
            "unmet_demand": hospital_demand - delivered,
            "unused_supply": unused,
            "matches_linprog": r["matches_lp"],
            "all_checks_passed": r["checks_ok"],
            "note": SCENARIO_NOTES[scen],
        })

        for k, val in r["u"].items():
            shadow_rows.append({"scenario": scen, "type": "u (bank)", "name": k, "value": round(val, 6)})
        for k, val in r["v"].items():
            shadow_rows.append({"scenario": scen, "type": "v (hospital)", "name": k, "value": round(val, 6)})

        v = r["vam_steps"].copy(); v.insert(0, "scenario", scen); vam_rows.append(v)
        m = r["modi_log"].copy(); m.insert(0, "scenario", scen); modi_rows.append(m)

    return {
        "allocation_all": pd.DataFrame(alloc_rows),
        "route_status": pd.DataFrame(route_rows),
        "summary": pd.DataFrame(summary_rows),
        "unused_supply": pd.DataFrame(unused_rows, columns=["scenario", "blood_bank", "unused_units"]),
        "shadow_prices": pd.DataFrame(shadow_rows),
        "vam_steps": pd.concat(vam_rows, ignore_index=True),
        "modi_iterations": pd.concat(modi_rows, ignore_index=True),
    }


def build_comparison(summary):
    base = summary[summary.scenario == "Base"].iloc[0]
    rows = []
    for _, r in summary.iterrows():
        diff = r.total_cost - base.total_cost
        rows.append({
            "scenario": r.scenario,
            "total_cost": r.total_cost,
            "units_delivered": r.units_delivered,
            "cost_diff_vs_base": round(diff, 6),
            "cost_diff_pct_vs_base": round(100 * diff / base.total_cost, 2),
            "cost_per_unit_delivered": round(r.total_cost / r.units_delivered, 4),
            "comparable_with_base": r.units_delivered == base.units_delivered,
        })
    return pd.DataFrame(rows)


def build_validation_report(results):
    lines = ["VALIDATION REPORT", "=" * 60]
    for r in results:
        lines += ["", r["name"],
                  f"  MODI cost      : {r['z']:g}",
                  f"  linprog cost   : {r['z_lp']:g}  (match: {r['matches_lp']})",
                  f"  recomputed cost: {r['recomputed']:g}"]
        for name, ok, detail in r["checks"]:
            lines.append(f"  {'PASS' if ok else 'FAIL'} - {name} | {detail}")
    all_ok = all(r["checks_ok"] and r["matches_lp"] for r in results)
    lines += ["", "=" * 60, "OVERALL: ALL CHECKS PASSED" if all_ok else "OVERALL: SOMETHING FAILED"]
    return "\n".join(lines)


README = """OUTPUT FILES - Blood Bank Distribution Optimization
=====================================================
Column names are fixed. Please do not rename them.

allocation_all.csv        one row per used route, all scenarios
                          scenario, blood_bank, hospital, units, unit_cost, total_cost
allocation_base.csv / allocation_scenarioA.csv / allocation_scenarioB.csv
                          same columns, one scenario each
summary.csv               one row per scenario: status, total_cost, units_delivered,
                          unmet_demand, unused_supply, checks, note
scenario_comparison.csv   cost difference vs Base (see comparable_with_base!)
route_status.csv          ALL 20 routes per scenario: units, capacity, is_binding,
                          is_prohibited, reduced_cost
unused_supply.csv         supply not sent to any hospital (Scenario B dummy)
shadow_prices.csv         u (banks) and v (hospitals) from MODI
vam_steps.csv             every VAM step (penalty, chosen cell, quantity)
modi_iterations.csv       every MODI iteration (entering cell, delta, theta, loop)
input_data.xlsx           the input data used (costs, supply, demand, constraints)
validation_report.txt     all constraint checks + comparison with linprog

NOTES
- Prohibited lane S3->D2 is never used. Capacity S3->D4 <= 50.
- Scenario B uses a zero-cost dummy destination for 150 unused units.
  Its lower cost is NOT an efficiency gain: only 450 units are delivered.
- reduced_cost: 0 for used (basic) routes. For the capped route it is
  negative (-75.76 in Base): each extra unit of capacity would save about that much.
"""


def main():
    os.makedirs(OUT, exist_ok=True)
    results = run_all()
    t = build_tables(results)
    comp = build_comparison(t["summary"])

    def save(df, name):
        df.to_csv(os.path.join(OUT, name), index=False, encoding="utf-8-sig")

    save(t["allocation_all"], "allocation_all.csv")
    for scen, fname in [("Base", "allocation_base.csv"),
                        ("Scenario A", "allocation_scenarioA.csv"),
                        ("Scenario B", "allocation_scenarioB.csv")]:
        save(t["allocation_all"][t["allocation_all"].scenario == scen], fname)
    save(t["summary"], "summary.csv")
    save(comp, "scenario_comparison.csv")
    save(t["route_status"], "route_status.csv")
    save(t["unused_supply"], "unused_supply.csv")
    save(t["shadow_prices"], "shadow_prices.csv")
    save(t["vam_steps"], "vam_steps.csv")
    save(t["modi_iterations"], "modi_iterations.csv")

    # input_data.xlsx
    with pd.ExcelWriter(os.path.join(OUT, "input_data.xlsx")) as xw:
        pd.DataFrame(config.COST, index=config.DESTS).T.to_excel(xw, sheet_name="costs")
        pd.DataFrame({"supply": config.SUPPLY}).to_excel(xw, sheet_name="supply")
        pd.DataFrame({"demand": config.DEMAND}).to_excel(xw, sheet_name="demand")
        cons = ([{"type": "prohibited", "blood_bank": s, "hospital": d, "value": 0}
                 for s, d in config.PROHIBITED] +
                [{"type": "capacity_max", "blood_bank": s, "hospital": d, "value": c}
                 for (s, d), c in config.CAPACITY.items()])
        pd.DataFrame(cons).to_excel(xw, sheet_name="constraints", index=False)

    with open(os.path.join(OUT, "validation_report.txt"), "w", encoding="utf-8") as f:
        f.write(build_validation_report(results))
    with open(os.path.join(OUT, "README.txt"), "w", encoding="utf-8") as f:
        f.write(README)

    print("Files written to:", os.path.abspath(OUT))
    for f in sorted(os.listdir(OUT)):
        print("  -", f)
    print()
    print(t["summary"][["scenario", "status", "total_cost", "units_delivered",
                        "unused_supply", "all_checks_passed"]].to_string(index=False))
    print()
    print(comp.to_string(index=False))


if __name__ == "__main__":
    main()
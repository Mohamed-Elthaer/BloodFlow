# scenarios.py
# تشغيل الـ Base وScenario A وScenario B بنفس الدالة
import copy
import pandas as pd
import Backend.config as config
from Backend.vam import vam
from Backend.modi import modi
from verify import solve_lp, check_solution


def run_scenario(name, sources, dests, cost, supply, demand, prohibited, capacity):
    """بتشغّل VAM ثم MODI ثم linprog وفحص القيود، وترجّع كل النتايج في dict."""
    args = (sources, dests, cost, supply, demand, prohibited, capacity)

    if sum(supply.values()) != sum(demand.values()):
        raise ValueError(f"{name}: المسألة مش متوازنة "
                         f"(عرض {sum(supply.values())} / طلب {sum(demand.values())})")

    init, z0, vam_steps = vam(*args, verbose=False)
    final, z, modi_log, delta_table, u, v = modi(*args, init, verbose=False)
    lp_table, z_lp, status = solve_lp(*args)
    checks, ok, recomputed = check_solution(final, *args)

    return {
        "name": name, "args": args,
        "init": init, "z0": z0, "vam_steps": vam_steps,
        "final": final, "z": z, "modi_log": modi_log,
        "delta_table": delta_table, "u": u, "v": v,
        "z_lp": z_lp, "lp_status": status,
        "checks": checks, "checks_ok": ok, "recomputed": recomputed,
        "matches_lp": abs(z - z_lp) < 1e-6,
    }


def build_scenario_a(factor=1.20, column="D4"):
    """Scenario A: كل تكاليف عمود D4 × 1.2 وتقريب لرقم عشري واحد (زي المحاضرة)."""
    cost = copy.deepcopy(config.COST)
    j = config.DESTS.index(column)
    for s in config.SOURCES:
        if cost[s][j] is not None:
            cost[s][j] = round(cost[s][j] * factor, 1)
    return cost


def build_scenario_b_with_dummy():
    """
    Scenario B: D2=35 و D5=15.
    تحذير: ده بيعتمد على افتراض (dummy بتكلفة صفر) لازم الدكتورة توافق عليه.
    """
    demand = dict(config.DEMAND)
    demand["D2"], demand["D5"] = 35, 15

    gap = sum(config.SUPPLY.values()) - sum(demand.values())   # 150
    dests = config.DESTS + ["D6_dummy"]
    cost = {s: row + [0] for s, row in config.COST.items()}
    demand["D6_dummy"] = gap
    return dests, cost, demand


def run_all():
    base = run_scenario("Base", config.SOURCES, config.DESTS, config.COST,
                        config.SUPPLY, config.DEMAND, config.PROHIBITED, config.CAPACITY)

    cost_a = build_scenario_a()
    scen_a = run_scenario("Scenario A", config.SOURCES, config.DESTS, cost_a,
                          config.SUPPLY, config.DEMAND, config.PROHIBITED, config.CAPACITY)

    dests_b, cost_b, demand_b = build_scenario_b_with_dummy()
    scen_b = run_scenario("Scenario B (dummy)", config.SOURCES, dests_b, cost_b,
                          config.SUPPLY, demand_b, config.PROHIBITED, config.CAPACITY)
    return [base, scen_a, scen_b]


if __name__ == "__main__":
    for r in run_all():
        print("=" * 60)
        print(r["name"])
        print("Z0 (VAM)      :", r["z0"])
        print("Z  (MODI)     :", r["z"])
        print("Z  (linprog)  :", r["z_lp"], "| match:", r["matches_lp"])
        print("Checks passed :", r["checks_ok"])
        print(r["final"])
        if r["name"] == "Scenario A":
            print("\nScenario A costs:")
            print(pd.DataFrame(r["args"][2], index=r["args"][1]).T)
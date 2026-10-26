export const demo = () => ({
  name: "Demo: fictional Nile Valley network (illustrative only)",
  banks: ["Bank A", "Bank B", "Bank C", "Bank D"],
  hospitals: ["Hosp 1", "Hosp 2", "Hosp 3", "Hosp 4", "Hosp 5"],
  supply: [40, 30, 50, 30],
  demand: [25, 35, 30, 35, 25],
  cost: [
    [8, 6, 10, 9, 12],
    [9, 12, 13, 7, 10],
    [14, 9, 16, 5, 8],
    [7, 11, 6, 12, 9],
  ],
  mode: [
    ["ok", "ok", "ok", "ban", "ok"],
    ["ok", "cap", "ok", "ok", "ok"],
    ["ok", "ok", "ok", "ok", "ok"],
    ["ok", "ok", "ok", "ok", "ok"],
  ],
  cap: [
    [0, 0, 0, 0, 0],
    [0, 15, 0, 0, 0],
    [0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0],
  ],
});
export const empty = () => ({
  name: "Empty dataset",
  banks: ["Bank 1"],
  hospitals: ["Hospital 1"],
  supply: [0],
  demand: [0],
  cost: [[0]],
  mode: [["ok"]],
  cap: [[0]],
});
export const sum = (a) => a.reduce((x, y) => x + (+y || 0), 0);
export function validate(d) {
  const errors = [],
    warnings = [];
  d.supply.forEach((v, i) => {
    if (v === "" || isNaN(v)) errors.push(`Supply of ${d.banks[i]} is missing`);
    else if (v < 0) errors.push(`Supply of ${d.banks[i]} is negative`);
  });
  d.demand.forEach((v, j) => {
    if (v === "" || isNaN(v))
      errors.push(`Demand of ${d.hospitals[j]} is missing`);
    else if (v < 0) errors.push(`Demand of ${d.hospitals[j]} is negative`);
  });
  d.cost.forEach((r, i) =>
    r.forEach((c, j) => {
      const n = `${d.banks[i]} → ${d.hospitals[j]}`;
      if (d.mode[i][j] !== "ban" && (c === "" || isNaN(c) || c < 0))
        errors.push(`Invalid cost on ${n}`);
      if (
        d.mode[i][j] === "cap" &&
        (d.cap[i][j] === "" || isNaN(d.cap[i][j]) || d.cap[i][j] < 0)
      )
        errors.push(`Invalid capacity on ${n}`);
    }),
  );
  const S = sum(d.supply),
    D = sum(d.demand);
  if (S !== D)
    errors.push(
      `Total supply (${S}) must equal total demand (${D}). Data is not changed automatically.`,
    );
  if (
    new Set(d.banks).size < d.banks.length ||
    new Set(d.hospitals).size < d.hospitals.length
  )
    warnings.push("Duplicate names found");
  return { errors, warnings };
}

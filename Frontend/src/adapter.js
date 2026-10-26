const toMatrix = (allocation, d) =>
  d.banks.map((bank) =>
    d.hospitals.map(
      (hospital) => Number(allocation[bank]?.[hospital] ?? 0)
    )
  );

export const adaptResult = (response, d) => {
  const initial = toMatrix(response.initial_allocation, d);
  const final = toMatrix(response.final_allocation, d);

  return {
    vam: {
      alloc: initial,
      cost: response.initial_cost,
      complete: true,
      steps: response.vam_steps,
    },

    sol: {
      alloc: final,
      cost: response.optimal_cost,
      feasible: response.checks_passed && response.matches_linprog,
      status: response.status,
      flow: d.supply.reduce((total, x) => total + Number(x), 0),
      engine: "Python VAM + MODI (verified by SciPy)",
    },

    raw: response,
  };
};
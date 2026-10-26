import axios from "axios";

const api = axios.create({
  baseURL: "http://127.0.0.1:8001",
  timeout: 30000,
});

export const preparePayload = (d) => ({
  sources: d.banks,
  destinations: d.hospitals,

  costs: d.cost.map((row, i) =>
    row.map((value, j) =>
      d.mode[i][j] === "ban" ? null : Number(value)
    )
  ),

  supply: d.supply.map(Number),
  demand: d.demand.map(Number),

  capacities: d.mode.flatMap((row, i) =>
    row.flatMap((mode, j) =>
      mode === "cap"
        ? [{
            source: d.banks[i],
            destination: d.hospitals[j],
            max_units: Number(d.cap[i][j]),
          }]
        : []
    )
  ),
});

export const optimizeApi = async (d) => {
  const response = await api.post(
    "/api/solve",
    preparePayload(d)
  );

  return response.data;
};
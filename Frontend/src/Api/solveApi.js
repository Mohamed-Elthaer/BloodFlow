import axios from "axios";

const api = axios.create({
  baseURL:
    import.meta.env.VITE_API_URL || "http://127.0.0.1:8001",
});

export const solveTransportation = async (data) => {
  const response = await api.post("/api/solve", data);
  return response.data;
};
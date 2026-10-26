import { createContext, useContext, useState } from "react";
import { solveTransportation } from "../Api/solveApi";

const TransportationContext = createContext(null);

export const TransportationProvider = ({ children }) => {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const solve = async (data) => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await solveTransportation(data);
      setResult(response);
      return response;
    } catch (err) {
      const message =
        err.response?.data?.detail ||
        "حدث خطأ أثناء حل المسألة";

      setError(
        typeof message === "string"
          ? message
          : JSON.stringify(message)
      );

      return null;
    } finally {
      setLoading(false);
    }
  };

  return (
    <TransportationContext.Provider
      value={{ result, loading, error, solve }}
    >
      {children}
    </TransportationContext.Provider>
  );
};

export const useTransportation = () => {
  const context = useContext(TransportationContext);

  if (!context) {
    throw new Error(
      "useTransportation must be used inside TransportationProvider"
    );
  }

  return context;
};
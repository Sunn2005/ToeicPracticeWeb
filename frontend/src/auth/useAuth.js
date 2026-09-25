import { createContext, useContext } from "react";

export const AuthStateContext = createContext(null);

export function useAuth() {
  const context = useContext(AuthStateContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return context;
}

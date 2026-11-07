import { useLocation } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import { LanguageProvider } from "./LanguageContext";

export default function AppLanguageProvider({ children }) {
  const { pathname } = useLocation();
  const { role } = useAuth();
  const isConsole = pathname === "/console" || pathname.startsWith("/console/");
  const isStaff = role === "ADMIN" || role === "EMPLOYEE";

  return (
    <LanguageProvider fixedLanguage={isConsole || isStaff ? "vi" : null}>
      {children}
    </LanguageProvider>
  );
}

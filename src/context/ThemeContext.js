import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

import { themes } from "../theme/themes";

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const [themeName, setThemeName] = useState("light");
  const theme = themes[themeName] || themes.light;

  const changeTheme = useCallback((nextThemeName) => {
    if (!themes[nextThemeName]) {
      return;
    }

    setThemeName(nextThemeName);
  }, []);

  const value = useMemo(
    () => ({
      theme,
      themeName,
      themes,
      changeTheme,
    }),
    [changeTheme, theme, themeName]
  );

  return (
    <ThemeContext.Provider
      value={value}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }

  return context;
};

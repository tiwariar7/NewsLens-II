// components/shared/ModeToggle.tsx
"use client"

import * as React from "react"
import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"

export function ModeToggle() {
  const { theme, setTheme } = useTheme()

  // Function to toggle between light and dark
  const toggleTheme = () => {
    setTheme(theme === "light" ? "dark" : "light");
  };

  // We need to wait for the theme to be mounted to avoid hydration mismatch
  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    // Render a placeholder or null on the server/before hydration
    return <Button variant="ghost" size="icon" disabled><Sun className="h-[1.2rem] w-[1.2rem]" /></Button>;
  }

  return (
    <Button variant="ghost" size="icon" onClick={toggleTheme}>
      {/* Conditionally render Sun or Moon based on the current theme */}
      {theme === "dark" ? (
        <Sun className="h-[1.2rem] w-[1.2rem] transition-all" />
      ) : (
        <Moon className="h-[1.2rem] w-[1.2rem] transition-all" />
      )}
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
}
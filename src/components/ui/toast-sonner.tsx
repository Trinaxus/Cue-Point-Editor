"use client"

import { Toaster as SonnerToaster } from "sonner"
import { useTheme } from "next-themes"

export function Toaster() {
  const { theme } = useTheme()

  return (
    <SonnerToaster
      position="top-right"
      richColors={false}
      expand={false}
      theme={theme as "light" | "dark" | "system"}
      className="toaster group"
      toastOptions={{
        duration: 4000,
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background/95 group-[.toaster]:text-foreground group-[.toaster]:border group-[.toaster]:backdrop-blur-xl group-[.toaster]:rounded-xl",
          description: "group-[.toast]:text-muted-foreground",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
          success:
            "group-[.toaster]:border-emerald-500/30 group-[.toaster]:bg-gradient-to-br group-[.toaster]:from-emerald-50/80 group-[.toaster]:to-emerald-100/90 group-[.toaster]:text-emerald-800 dark:group-[.toaster]:border-emerald-500/30 dark:group-[.toaster]:from-emerald-950/90 dark:group-[.toaster]:to-emerald-900/95 dark:group-[.toaster]:text-emerald-100",
          error:
            "group-[.toaster]:border-red-500/30 group-[.toaster]:bg-gradient-to-br group-[.toaster]:from-red-50/80 group-[.toaster]:to-red-100/90 group-[.toaster]:text-red-800 dark:group-[.toaster]:border-red-500/30 dark:group-[.toaster]:from-red-950/90 dark:group-[.toaster]:to-red-900/95 dark:group-[.toaster]:text-red-100",
        },
      }}
    />
  )
}
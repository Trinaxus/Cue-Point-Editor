"use client"

import { Toaster as SonnerToaster } from "sonner"

export function Toaster() {
  return (
    <SonnerToaster
      position="top-right"
      richColors
      expand={false}
      className="toaster group"
      toastOptions={{
        duration: 4000,
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background/95 group-[.toaster]:text-foreground group-[.toaster]:border group-[.toaster]:shadow-2xl group-[.toaster]:backdrop-blur-xl group-[.toaster]:rounded-xl",
          description: "group-[.toast]:text-muted-foreground",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
          success:
            "group-[.toaster]:border-emerald-400/20 group-[.toaster]:bg-gradient-to-br group-[.toaster]:from-emerald-500/15 group-[.toaster]:to-emerald-600/10 group-[.toaster]:text-emerald-700 group-[.toaster]:shadow-2xl group-[.toaster]:shadow-emerald-500/25 dark:group-[.toaster]:border-emerald-400/30 dark:group-[.toaster]:from-emerald-900/90 dark:group-[.toaster]:to-emerald-800/95 dark:group-[.toaster]:text-emerald-100 dark:group-[.toaster]:shadow-emerald-500/40",
          error:
            "group-[.toaster]:border-red-400/20 group-[.toaster]:bg-gradient-to-br group-[.toaster]:from-red-500/15 group-[.toaster]:to-red-600/10 group-[.toaster]:text-red-700 group-[.toaster]:shadow-2xl group-[.toaster]:shadow-red-500/25 dark:group-[.toaster]:border-red-400/30 dark:group-[.toaster]:from-red-900/90 dark:group-[.toaster]:to-red-800/95 dark:group-[.toaster]:text-red-100 dark:group-[.toaster]:shadow-red-500/40",
        },
      }}
    />
  )
}
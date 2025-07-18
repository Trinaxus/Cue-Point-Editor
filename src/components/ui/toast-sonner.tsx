"use client"

import { Toaster as SonnerToaster } from "sonner"

export function Toaster() {
  return (
    <SonnerToaster
      position="top-right"
      richColors={false}
      expand={false}
      theme="dark"
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
            "group-[.toaster]:border-emerald-500/30 group-[.toaster]:bg-gradient-to-br group-[.toaster]:from-emerald-950/90 group-[.toaster]:to-emerald-900/95 group-[.toaster]:text-emerald-100 group-[.toaster]:shadow-2xl group-[.toaster]:shadow-emerald-500/40 group-[.toaster]:backdrop-blur-xl",
          error:
            "group-[.toaster]:border-red-500/30 group-[.toaster]:bg-gradient-to-br group-[.toaster]:from-red-950/90 group-[.toaster]:to-red-900/95 group-[.toaster]:text-red-100 group-[.toaster]:shadow-2xl group-[.toaster]:shadow-red-500/40 group-[.toaster]:backdrop-blur-xl",
        },
      }}
    />
  )
}
import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow hover:bg-primary/90 hover:scale-[1.02] active:scale-[0.98]",
        destructive:
          "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90 hover:text-destructive-foreground hover:scale-[1.02] active:scale-[0.98]",
        outline:
          "border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground hover:scale-[1.02] active:scale-[0.98]",
        secondary:
          "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80 hover:scale-[1.02] active:scale-[0.98]",
        ghost: "hover:bg-accent hover:text-accent-foreground hover:scale-[1.02] active:scale-[0.98]",
        link: "text-primary underline-offset-4 hover:underline",
        // Custom semantic variants
        cue: "bg-cue/10 border border-cue/30 text-cue shadow-sm hover:bg-cue/25 hover:border-cue/50 hover:scale-[1.02] active:scale-[0.98]",
        tracklist: "bg-green-500/10 border border-green-500/30 text-green-600 shadow-sm hover:bg-green-500/15 hover:border-green-500/40 hover:scale-[1.02] active:scale-[0.98]",
        preview: "bg-accent/10 border border-accent/30 text-accent shadow-sm hover:bg-accent/15 hover:border-accent/40 hover:scale-[1.02] active:scale-[0.98]",
        import: "bg-accent/10 border border-accent/30 text-accent shadow-sm hover:bg-accent/20 hover:border-accent/40 hover:text-accent hover:scale-[1.02] active:scale-[0.98]",
        export: "bg-secondary/50 border border-neon-green/30 text-neon-green shadow-sm hover:bg-neon-green/20 hover:border-neon-green/40 hover:text-neon-green hover:scale-[1.02] active:scale-[0.98]"
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }

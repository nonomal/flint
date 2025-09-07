/**
 * Consistent Button Component for Flint
 * Ensures reliable behavior in static site
 */

import { forwardRef } from "react"
import { Button, buttonVariants } from "@/components/ui/button"
import { type VariantProps } from "class-variance-authority"
import { TRANSITIONS, EFFECTS } from "@/lib/ui-constants"
import { cn } from "@/lib/utils"

interface ConsistentButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  loading?: boolean
  icon?: React.ReactNode
  staticSafe?: boolean // Ensures button works in static context
  asChild?: boolean
}

export const ConsistentButton = forwardRef<HTMLButtonElement, ConsistentButtonProps>(
  ({ className, loading, icon, children, staticSafe = true, disabled, onClick, ...props }, ref) => {
    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      if (loading || disabled) {
        e.preventDefault()
        return
      }
      
      // Ensure static-safe behavior
      if (staticSafe) {
        e.stopPropagation()
      }
      
      onClick?.(e)
    }

    return (
      <Button
        ref={ref}
        className={cn(
          TRANSITIONS.fast,
          EFFECTS.shadow.sm,
          "relative overflow-hidden",
          loading && "pointer-events-none",
          className
        )}
        disabled={disabled || loading}
        onClick={handleClick}
        {...props}
      >
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        )}
        {icon && <span className="mr-2">{icon}</span>}
        {children}
      </Button>
    )
  }
)

ConsistentButton.displayName = "ConsistentButton"
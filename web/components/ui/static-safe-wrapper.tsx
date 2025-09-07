/**
 * Static-Safe Wrapper Component
 * Ensures components work reliably in embedded static context
 */

import { useEffect, useState, ReactNode } from "react"
import { LOADING, TRANSITIONS } from "@/lib/ui-constants"
import { cn } from "@/lib/utils"

interface StaticSafeWrapperProps {
  children: ReactNode
  fallback?: ReactNode
  errorFallback?: ReactNode
  className?: string
  enableTransitions?: boolean
}

export function StaticSafeWrapper({ 
  children, 
  fallback, 
  errorFallback,
  className,
  enableTransitions = true 
}: StaticSafeWrapperProps) {
  const [isClient, setIsClient] = useState(false)
  const [hasError, setHasError] = useState(false)

  useEffect(() => {
    setIsClient(true)
  }, [])

  useEffect(() => {
    const handleError = (error: ErrorEvent) => {
      console.error('Static wrapper caught error:', error)
      setHasError(true)
    }

    window.addEventListener('error', handleError)
    return () => window.removeEventListener('error', handleError)
  }, [])

  if (hasError && errorFallback) {
    return <div className={className}>{errorFallback}</div>
  }

  if (!isClient) {
    return (
      <div className={cn(
        "min-h-[200px] flex items-center justify-center",
        className
      )}>
        {fallback || (
          <div className="flex items-center gap-2 text-muted-foreground">
            <div className={cn("h-4 w-4 rounded-full border-2 border-primary border-t-transparent", LOADING.spinner)} />
            <span>Loading...</span>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className={cn(
      enableTransitions && TRANSITIONS.fadeIn,
      className
    )}>
      {children}
    </div>
  )
}
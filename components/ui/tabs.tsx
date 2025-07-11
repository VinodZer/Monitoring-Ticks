"use client"

import * as React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"
import { ChevronRight, ChevronLeft } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * Tabs component (Radix primitive re-export)
 */
const Tabs = TabsPrimitive.Root

/**
 * Custom TabsList
 *
 * • Mobile (< 640 px)
 *   – First row shows the three *primary* tabs (Kite, Upstox, Compare)
 *   – Second row (if needed) is horizontally scrollable for the remaining tabs
 *
 * • Desktop (≥ 640 px)
 *   – Traditional single-row layout
 *
 * This keeps the most-used options visible while ensuring everything
 * remains reachable on small screens.
 */
const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, children, ...props }, ref) => {
  // Split primary and secondary tabs
  const childrenArray = React.Children.toArray(children) as React.ReactElement[]
  const primaryTabs = childrenArray.filter(
    (child) => child.props.value === "kite" || child.props.value === "upstox" || child.props.value === "compare",
  )
  const secondaryTabs = childrenArray.filter(
    (child) => child.props.value !== "kite" && child.props.value !== "upstox" && child.props.value !== "compare",
  )

  const [scrollPosition, setScrollPosition] = React.useState(0)
  const [maxScroll, setMaxScroll] = React.useState(0)
  const scrollContainerRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    const container = scrollContainerRef.current
    if (container) {
      const updateScrollInfo = () => {
        setScrollPosition(container.scrollLeft)
        setMaxScroll(container.scrollWidth - container.clientWidth)
      }

      container.addEventListener("scroll", updateScrollInfo)
      updateScrollInfo() // Initial calculation

      return () => container.removeEventListener("scroll", updateScrollInfo)
    }
  }, [secondaryTabs])

  return (
    <div className="h-auto w-full">
      {/* ---------- Mobile (< sm) ---------- */}
      <div className="space-y-2 sm:hidden">
        {/* Primary row */}

        {/* Secondary (scrollable) row */}
        {secondaryTabs.length > 0 && (
          <div className="relative flex items-center">
            {/* Left Arrow - only show if scrolled right */}
            {scrollPosition > 0 && (
              <button
                onClick={() => {
                  const container = scrollContainerRef.current
                  if (container) {
                    container.scrollLeft = Math.max(0, container.scrollLeft - 120)
                  }
                }}
                className="mr-2 p-1 rounded-md hover:bg-gray-100 transition-colors flex-shrink-0 z-10 px-0 py-0"
                aria-label="Scroll tabs left"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            )}

            <TabsPrimitive.List
              ref={scrollContainerRef}
              className="flex items-center gap-1 overflow-x-auto rounded-md p-1 scroll-smooth bg-white flex-1 scrollbar-hide shadow-sm px-2 py-2"
              style={{
                touchAction: "pan-x",
                WebkitOverflowScrolling: "touch",
              }}
            >
              {secondaryTabs}
            </TabsPrimitive.List>

            {/* Right Arrow - only show if can scroll more */}
            {scrollPosition < maxScroll && (
              <button
                onClick={() => {
                  const container = scrollContainerRef.current
                  if (container) {
                    container.scrollLeft = Math.min(maxScroll, container.scrollLeft + 120)
                  }
                }}
                className="ml-2 p-1 rounded-md hover:bg-gray-100 transition-colors flex-shrink-0 z-10 px-0 py-0"
                aria-label="Scroll tabs right"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* ---------- Desktop (sm +) ---------- */}
      <TabsPrimitive.List
        ref={ref}
        className={cn(
          "hidden items-center justify-center gap-1 rounded-md p-1 text-muted-foreground sm:flex bg-transparent px-[fit-content] py-[fit-content] py-[fit-content] py-0.5 opacity-100 px-0.5 w-fit h-fit",
          className,
        )}
        {...props}
      >
        {children}
      </TabsPrimitive.List>
    </div>
  )
})
TabsList.displayName = TabsPrimitive.List.displayName

/**
 * TabsTrigger - unchanged styles except brand colours
 */
const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, value, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:shadow-sm font-mono font-medium",
      value === "kite" && "data-[state=active]:bg-[#f33d2c] data-[state=active]:text-white",
      value === "upstox" && "data-[state=active]:bg-[#5b298c] data-[state=active]:text-white",
      (value === "compare" || value === "alert-settings" || value === "inactivity-log" || value === "debug") &&
        "data-[state=active]:bg-black data-[state=active]:text-white",
      className,
    )}
    value={value}
    {...props}
  />
))
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName

/**
 * TabsContent - passthrough
 */
const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      className,
    )}
    {...props}
  />
))
TabsContent.displayName = TabsPrimitive.Content.displayName

export { Tabs, TabsList, TabsTrigger, TabsContent }

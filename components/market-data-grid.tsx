"use client"

import { useMemo, useEffect, useState, memo, useRef } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronDown,
  Clock,
  Settings,
  Activity,
  Filter,
  SortAsc,
  SortDesc,
  X,
} from "lucide-react"
import type { TickData } from "@/hooks/use-tick-data"
import { getCurrentMarketStatus, getMarketTypeForInstrument } from "@/utils/market-timings"
import { calculatePriceTrend, calculateDayTrend } from "@/utils/price-trends"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { MiniPriceChart } from "./mini-price-chart"
import { SymbolAlertSettingsDialog } from "./symbol-alert-settings-dialog"
import type { InactivityAlertConfig } from "@/hooks/use-inactivity-alerts"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

// --- Helper functions ---
export const getInstrumentName = (tick: TickData) => {
  if (tick.tradingsymbol) return tick.tradingsymbol
  const tokenMap: Record<number, string> = {
    256265: "NIFTY",
    265: "SENSEX",
    128083204: "RELIANCE",
    281836549: "BHEL",
    408065: "USDINR",
    134657: "CRUDEOIL",
  }
  return tokenMap[tick.instrument_token] || `TOKEN_${tick.instrument_token}`
}

export const getExchange = (tick: TickData) => {
  const name = getInstrumentName(tick)
  const marketType = getMarketTypeForInstrument(name)
  switch (marketType) {
    case "currency":
      return "CDS"
    case "commodity":
      return "MCX"
    default:
      if (name.includes("NIFTY")) return "NFO"
      if (name.includes("SENSEX")) return "BFO"
      return "NSE"
  }
}

const formatDelay = (delay: number) => {
  if (delay === 0) return "N/A"
  if (delay < 1000) return `${delay}ms`
  if (delay < 60000) return `${(delay / 1000).toFixed(1)}s`
  return `${(delay / 60000).toFixed(1)}m`
}

interface MarketDataGridProps {
  ticks: TickData[]
  inactiveSymbols: Set<number>
  alertConfigurations: Map<number, InactivityAlertConfig>
  onConfigurationChange: (token: number, config: InactivityAlertConfig) => void
}

interface InstrumentData extends TickData {
  marketStatus: { isOpen: boolean; session: string; reason: string }
  trend: { change: number; changePercent: number; direction: "up" | "down" | "neutral" }
  dayTrend: { change: number; changePercent: number; direction: "up" | "down" | "neutral" }
}

type SortField = "time" | "price" | "quantity" | "volume" | "change"
type SortDirection = "asc" | "desc"

// Memoized Price animation component
const AnimatedPrice = memo(function AnimatedPrice({
  price,
  previousPrice,
  direction,
}: {
  price: number
  previousPrice: number | null
  direction: "up" | "down" | "neutral"
}) {
  const [animationClass, setAnimationClass] = useState("")
  const [textColorClass, setTextColorClass] = useState("")

  useEffect(() => {
    if (previousPrice !== null && price !== previousPrice) {
      const changeDirection = price > previousPrice ? "up" : "down"
      setAnimationClass(`price-bg-flash-${changeDirection}`)
      setTextColorClass(`price-text-flash-${changeDirection}`)
      const timer = setTimeout(() => {
        setAnimationClass("")
        setTextColorClass("")
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [price, previousPrice])

  const formatPrice = (p: number) =>
    new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(p)

  const getBackgroundColor = () => {
    if (animationClass.includes("up")) return "rgba(34, 197, 94, 0.2)"
    if (animationClass.includes("down")) return "rgba(239, 68, 68, 0.2)"
    if (direction === "up") return "rgba(34, 197, 94, 0.1)"
    if (direction === "down") return "rgba(239, 68, 68, 0.1)"
    return "rgba(156, 163, 175, 0.1)"
  }

  return (
    <div
      className={`inline-block px-4 py-2 rounded-lg text-2xl font-bold transition-colors duration-500 ease-out ${textColorClass}`}
      style={{ backgroundColor: getBackgroundColor() }}
    >
      {formatPrice(price)}
      <style jsx>{`
    .price-bg-flash-up {
      background-color: rgba(34, 197, 94, 0.3) !important;
    }
    .price-bg-flash-down {
      background-color: rgba(239, 68, 68, 0.3) !important;
    }
    .price-text-flash-up {
      color: #22c55e !important;
    }
    .price-text-flash-down {
      color: #ef4444 !important;
    }
  `}</style>
    </div>
  )
})

// Memoized instrument card component
const InstrumentCard = memo(function InstrumentCard({
  instrument,
  instrumentTickCount,
  previousPrice,
  onShowTrades,
  allTicks,
  isInactive,
  alertConfig,
  onAlertConfigChange,
}: {
  instrument: InstrumentData
  instrumentTickCount: number
  previousPrice: number | null
  onShowTrades: () => void
  allTicks: TickData[]
  isInactive: boolean
  alertConfig?: InactivityAlertConfig
  onAlertConfigChange: (config: InactivityAlertConfig) => void
}) {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const name = getInstrumentName(instrument)
  const exchange = getExchange(instrument)
  const { trend, dayTrend, marketStatus } = instrument
  const displayTrend = dayTrend.change !== 0 ? dayTrend : trend

  const formatVolume = (volume: number) => {
    if (volume >= 10000000) return `${(volume / 10000000).toFixed(1)}Cr`
    if (volume >= 100000) return `${(volume / 100000).toFixed(1)}L`
    if (volume >= 1000) return `${(volume / 1000).toFixed(1)}K`
    return volume.toString()
  }

  const formatPrice = (price: number) =>
    new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(price)

  const cardClassName = `bg-white border transition-all duration-500 hover:shadow-lg ${
    isInactive
      ? "border-orange-500 bg-orange-50 shadow-orange-200 shadow-lg ring-2 ring-orange-400 animate-pulse"
      : "border-gray-200"
  }`

  return (
    <>
      <Card className={cardClassName}>
        <CardContent className="p-4 space-y-4">
          {isInactive && (
            <div className="flex items-center gap-2 p-2 bg-orange-100 border border-orange-200 rounded-lg">
              <Clock className="w-4 h-4 text-orange-600" />
              <span className="text-sm font-medium text-orange-800">Price Inactivity Alert!</span>
            </div>
          )}

          {/* Header with Settings Icon */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h3 className="text-lg font-bold text-gray-900 font-mono">{name}</h3>
              <Badge variant="secondary" className="text-xs font-medium bg-gray-100 text-gray-700">
                {exchange}
              </Badge>
              <Badge
                variant={marketStatus.session === "Open" ? "default" : "secondary"}
                className={`text-xs font-medium ${
                  marketStatus.session === "Open"
                    ? "bg-black text-white hover:bg-gray-800"
                    : "bg-gray-100 text-gray-700"
                }`}
              >
                {marketStatus.session}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              {!marketStatus.isOpen && (
                <Button variant="outline" size="icon" onClick={() => setIsSettingsOpen(true)} className="title">
                  <Settings className="w-4 h-4 text-gray-600 bg-slate-50" />
                </Button>
              )}
            </div>
          </div>

          {/* Price and Change */}
          <div className="flex items-center justify-between">
            <AnimatedPrice
              price={instrument.last_price}
              previousPrice={previousPrice}
              direction={displayTrend.direction}
            />
            <div className="text-right">
              <div
                className={`text-lg font-medium ${
                  displayTrend.direction === "up"
                    ? "text-green-600"
                    : displayTrend.direction === "down"
                      ? "text-red-600"
                      : "text-gray-500"
                }`}
              >
                {displayTrend.change > 0 ? "+" : ""}
                {displayTrend.change.toFixed(2)}
              </div>
              
            </div>
          </div>

          {/* Full Width Mini Chart */}
          <div className="-mx-4 px-0.5 pr-0 w-full my-0 mx-px pl-0">
            <MiniPriceChart
              ticks={allTicks}
              instrumentToken={instrument.instrument_token}
              height={80}
              className="mb-2"
            />
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-3 gap-x-4 gap-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500 font-mono">Vol</span>
              <span className="font-medium">{formatVolume(instrument.volume)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500 font-mono">Avg</span>
              <span className="font-medium">{formatPrice(instrument.average_price)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500 font-mono">LTQ</span>
              <span className="font-medium">{instrument.last_quantity}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500 font-mono">Ticks</span>
              <span className="font-medium">{instrumentTickCount}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500 font-mono">Delay</span>
              <span
                className={`font-medium ${
                  instrument.delay > 1000
                    ? "text-red-600"
                    : instrument.delay > 500
                      ? "text-yellow-600"
                      : "text-green-600"
                }`}
              >
                {formatDelay(instrument.delay)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500 font-mono">Alerts</span>
              <span className={`font-medium ${alertConfig?.enabled ? "text-green-600" : "text-gray-400"}`}>
                {alertConfig?.enabled ? "ON" : "OFF"}
              </span>
            </div>
          </div>

          {/* Show More Button */}
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-blue-500 hover:text-blue-600 hover:bg-blue-50"
            onClick={onShowTrades}
          >
            <span className="font-mono">Show last 10 trades</span>
            <ChevronDown className="w-4 h-4 ml-1" />
          </Button>
        </CardContent>
      </Card>
      <SymbolAlertSettingsDialog
        isOpen={isSettingsOpen}
        onOpenChange={setIsSettingsOpen}
        config={alertConfig}
        onSave={onAlertConfigChange}
        symbolName={name}
      />
    </>
  )
})

export function MarketDataGrid({
  ticks,
  inactiveSymbols,
  alertConfigurations,
  onConfigurationChange,
}: MarketDataGridProps) {
  const [currentTime, setCurrentTime] = useState(new Date())
  const [previousPrices, setPreviousPrices] = useState<Record<number, number>>({})
  const [selectedInstrument, setSelectedInstrument] = useState<InstrumentData | null>(null)
  const [sortField, setSortField] = useState<SortField>("time")
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc")
  const [filterDelay, setFilterDelay] = useState<string>("all")
  const [filterChange, setFilterChange] = useState<string>("all")
  const stableInstrumentOrder = useRef<number[]>([])

  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 60000)
    return () => clearInterval(interval)
  }, [])

  const instrumentData = useMemo(() => {
    const grouped = new Map<number, TickData>()
    const recentTicks = ticks.slice(0, 100)
    for (const tick of recentTicks) {
      const key = tick.instrument_token
      if (!grouped.has(key) || tick.receivedAt > grouped.get(key)!.receivedAt) {
        grouped.set(key, tick)
      }
    }
    const validInstruments = Array.from(grouped.values()).filter((tick) => tick.last_price > 0)
    const currentTokens = validInstruments.map((tick) => tick.instrument_token)
    if (stableInstrumentOrder.current.length === 0) {
      stableInstrumentOrder.current = currentTokens.sort((a, b) => a - b).slice(0, 6)
    } else {
      const newTokens = currentTokens.filter((token) => !stableInstrumentOrder.current.includes(token))
      if (stableInstrumentOrder.current.length < 6) {
        const availableSlots = 6 - stableInstrumentOrder.current.length
        stableInstrumentOrder.current.push(...newTokens.slice(0, availableSlots))
      }
    }
    const orderedInstruments: InstrumentData[] = []
    for (const token of stableInstrumentOrder.current) {
      const tick = grouped.get(token)
      if (tick && tick.last_price > 0) {
        const instrumentName = getInstrumentName(tick)
        const marketType = getMarketTypeForInstrument(instrumentName)
        const marketStatus = getCurrentMarketStatus(marketType)
        const trend = calculatePriceTrend(tick, ticks)
        const dayTrend = calculateDayTrend(tick, ticks)
        orderedInstruments.push({ ...tick, marketStatus, trend, dayTrend })
      }
    }
    return orderedInstruments
  }, [ticks, currentTime])

  useEffect(() => {
    const newPreviousPrices: Record<number, number> = {}
    instrumentData.forEach((instrument) => {
      newPreviousPrices[instrument.instrument_token] = instrument.last_price
    })
    setPreviousPrices(newPreviousPrices)
  }, [instrumentData])

  const getLastTrades = (instrumentToken: number) => {
    const instrumentTicks = ticks
      .filter((tick) => tick.instrument_token === instrumentToken)
      .sort((a, b) => b.timestamp - a.timestamp) // Sort from most recent to oldest

    const uniquePriceTrades: TickData[] = []
    if (instrumentTicks.length > 0) {
      uniquePriceTrades.push(instrumentTicks[0]) // Always add the most recent tick

      for (let i = 1; i < instrumentTicks.length; i++) {
        // Compare current tick's price with the previous tick's price
        if (instrumentTicks[i].last_price !== instrumentTicks[i - 1].last_price) {
          uniquePriceTrades.push(instrumentTicks[i])
        }
        // Limit to 10 unique trades
        if (uniquePriceTrades.length >= 10) {
          break
        }
      }
    }
    return uniquePriceTrades
  }

  const getSortedAndFilteredTrades = (instrumentToken: number) => {
    let trades = getLastTrades(instrumentToken)

    // Apply filters
    if (filterDelay !== "all") {
      trades = trades.filter((trade) => {
        if (filterDelay === "low") return trade.delay <= 500
        if (filterDelay === "medium") return trade.delay > 500 && trade.delay <= 1000
        if (filterDelay === "high") return trade.delay > 1000
        return true
      })
    }

    if (filterChange !== "all") {
      trades = trades.filter((trade, index) => {
        const prevTrade = getLastTrades(instrumentToken)[index + 1]
        const priceChange = prevTrade ? trade.last_price - prevTrade.last_price : 0
        if (filterChange === "up") return priceChange > 0
        if (filterChange === "down") return priceChange < 0
        if (filterChange === "neutral") return priceChange === 0
        return true
      })
    }

    // Apply sorting
    trades.sort((a, b) => {
      let aValue: number, bValue: number

      switch (sortField) {
        case "time":
          aValue = a.timestamp
          bValue = b.timestamp
          break
        case "price":
          aValue = a.last_price
          bValue = b.last_price
          break
        case "quantity":
          aValue = a.last_quantity
          bValue = b.last_quantity
          break
        case "volume":
          aValue = a.volume
          bValue = b.volume
          break
        case "change":
          const aIndex = getLastTrades(instrumentToken).findIndex((t) => t.id === a.id)
          const bIndex = getLastTrades(instrumentToken).findIndex((t) => t.id === b.id)
          const aPrevTrade = getLastTrades(instrumentToken)[aIndex + 1]
          const bPrevTrade = getLastTrades(instrumentToken)[bIndex + 1]
          aValue = aPrevTrade ? a.last_price - aPrevTrade.last_price : 0
          bValue = bPrevTrade ? b.last_price - bPrevTrade.last_price : 0
          break
        default:
          return 0
      }

      return sortDirection === "asc" ? aValue - bValue : bValue - aValue
    })

    return trades
  }

  const formatVolume = (volume: number) => {
    if (volume >= 10000000) return `${(volume / 10000000).toFixed(1)}Cr`
    if (volume >= 100000) return `${(volume / 100000).toFixed(1)}L`
    if (volume >= 1000) return `${(volume / 1000).toFixed(1)}K`
    return volume.toString()
  }

  const formatPrice = (price: number) =>
    new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(price)

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc")
    } else {
      setSortField(field)
      setSortDirection("desc")
    }
  }

  const clearFilters = () => {
    setFilterDelay("all")
    setFilterChange("all")
    setSortField("time")
    setSortDirection("desc")
  }

  if (instrumentData.length === 0) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Card key={i}>
            <CardContent className="p-4 animate-pulse">
              <div className="space-y-3">
                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                <div className="h-8 bg-gray-200 rounded w-3/4"></div>
                <div className="h-20 bg-gray-200 rounded"></div>
                <div className="space-y-2">
                  <div className="h-3 bg-gray-200 rounded"></div>
                  <div className="h-3 bg-gray-200 rounded w-2/3"></div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {instrumentData.map((instrument) => {
          const instrumentTickCount = ticks.filter((t) => t.instrument_token === instrument.instrument_token).length
          return (
            <InstrumentCard
              key={instrument.instrument_token}
              instrument={instrument}
              instrumentTickCount={instrumentTickCount}
              previousPrice={previousPrices[instrument.instrument_token] || null}
              onShowTrades={() => setSelectedInstrument(instrument)}
              allTicks={ticks}
              isInactive={inactiveSymbols.has(instrument.instrument_token)}
              alertConfig={alertConfigurations.get(instrument.instrument_token)}
              onAlertConfigChange={(config) => onConfigurationChange(instrument.instrument_token, config)}
            />
          )
        })}
      </div>

      {/* Enhanced Mobile-First Trades Dialog */}
      <Dialog open={!!selectedInstrument} onOpenChange={() => setSelectedInstrument(null)}>
        <DialogContent className="w-[95vw] max-w-6xl h-[95vh] max-h-[95vh] p-0 gap-0">
          {/* Mobile-Optimized Header */}
          <DialogHeader className="px-4 sm:px-6 py-3 sm:py-4 border-b bg-gradient-to-r from-blue-50 to-indigo-50 flex-shrink-0">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <DialogTitle className="text-lg sm:text-xl font-bold text-gray-900 truncate">
                    {selectedInstrument ? getInstrumentName(selectedInstrument) : ""}
                  </DialogTitle>
                  <DialogDescription className="text-xs sm:text-sm text-gray-600 mt-0.5">
                    Recent trading activity
                  </DialogDescription>
                </div>
              </div>
              {selectedInstrument && (
                <div className="flex items-center gap-3 sm:gap-4 flex-shrink-0">
                  <div className="text-right">
                    <div className="text-xs text-gray-500">Current</div>
                    <div className="text-sm sm:text-lg font-bold text-gray-900">
                      ₹{formatPrice(selectedInstrument.last_price)}
                    </div>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {getExchange(selectedInstrument)}
                  </Badge>
                </div>
              )}
            </div>
          </DialogHeader>

          <div className="flex flex-col h-full min-h-0">
            {/* Mobile-First Controls */}
            <div className="px-4 sm:px-6 py-3 border-b bg-gray-50 flex-shrink-0">
              <Tabs defaultValue="trades" className="w-full">
                <TabsList className="grid w-full grid-cols-2 h-9">
                  <TabsTrigger value="trades" className="text-xs sm:text-sm">
                    Trades
                  </TabsTrigger>
                  <TabsTrigger value="summary" className="text-xs sm:text-sm">
                    Summary
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="trades" className="mt-3 space-y-3">
                  {/* Touch-Friendly Sort & Filter Controls */}
                  <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                    <div className="flex gap-2 flex-1">
                      <Select value={sortField} onValueChange={(value) => setSortField(value as SortField)}>
                        <SelectTrigger className="h-9 text-xs sm:text-sm">
                          <div className="flex items-center gap-1">
                            {sortDirection === "asc" ? (
                              <SortAsc className="w-3 h-3" />
                            ) : (
                              <SortDesc className="w-3 h-3" />
                            )}
                            <SelectValue placeholder="Sort by" />
                          </div>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="time">Time</SelectItem>
                          <SelectItem value="price">Price</SelectItem>
                          <SelectItem value="quantity">Quantity</SelectItem>
                          <SelectItem value="volume">Volume</SelectItem>
                          <SelectItem value="change">Change</SelectItem>
                        </SelectContent>
                      </Select>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSortDirection(sortDirection === "asc" ? "desc" : "asc")}
                        className="h-9 px-2"
                      >
                        {sortDirection === "asc" ? <SortAsc className="w-3 h-3" /> : <SortDesc className="w-3 h-3" />}
                      </Button>
                    </div>

                    <div className="flex gap-2">
                      <Select value={filterDelay} onValueChange={setFilterDelay}>
                        <SelectTrigger className="h-9 text-xs sm:text-sm w-24 sm:w-28">
                          <div className="flex items-center gap-1">
                            <Filter className="w-3 h-3" />
                            <SelectValue />
                          </div>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Delays</SelectItem>
                          <SelectItem value="low">Low (&lt;500ms)</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High (&gt;1s)</SelectItem>
                        </SelectContent>
                      </Select>

                      <Select value={filterChange} onValueChange={setFilterChange}>
                        <SelectTrigger className="h-9 text-xs sm:text-sm w-20 sm:w-24">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All</SelectItem>
                          <SelectItem value="up">Up</SelectItem>
                          <SelectItem value="down">Down</SelectItem>
                          <SelectItem value="neutral">Neutral</SelectItem>
                        </SelectContent>
                      </Select>

                      {(filterDelay !== "all" ||
                        filterChange !== "all" ||
                        sortField !== "time" ||
                        sortDirection !== "desc") && (
                        <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9 px-2">
                          <X className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="summary" className="mt-3">
                  {selectedInstrument && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="bg-white p-3 rounded-lg border text-center">
                        <div className="text-xs text-gray-500 mb-1">Total</div>
                        <div className="text-sm font-bold text-gray-900">
                          {getLastTrades(selectedInstrument.instrument_token).length}
                        </div>
                      </div>
                      <div className="bg-white p-3 rounded-lg border text-center">
                        <div className="text-xs text-gray-500 mb-1">Avg Vol</div>
                        <div className="text-sm font-bold text-gray-900">
                          {formatVolume(
                            getLastTrades(selectedInstrument.instrument_token).reduce(
                              (sum, trade) => sum + trade.volume,
                              0,
                            ) / Math.max(getLastTrades(selectedInstrument.instrument_token).length, 1),
                          )}
                        </div>
                      </div>
                      <div className="bg-white p-3 rounded-lg border text-center">
                        <div className="text-xs text-gray-500 mb-1">High</div>
                        <div className="text-sm font-bold text-green-600">
                          ₹
                          {formatPrice(
                            Math.max(...getLastTrades(selectedInstrument.instrument_token).map((t) => t.last_price)),
                          )}
                        </div>
                      </div>
                      <div className="bg-white p-3 rounded-lg border text-center">
                        <div className="text-xs text-gray-500 mb-1">Low</div>
                        <div className="text-sm font-bold text-red-600">
                          ₹
                          {formatPrice(
                            Math.min(...getLastTrades(selectedInstrument.instrument_token).map((t) => t.last_price)),
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </div>

            {/* Mobile-Optimized Content */}
            <div className="flex-1 min-h-0">
              {/* Mobile Card View - Always Visible */}
              <div className="block lg:hidden h-full">
                <ScrollArea className="h-full px-4 py-2">
                  <div className="space-y-3 pb-4">
                    {selectedInstrument &&
                      getSortedAndFilteredTrades(selectedInstrument.instrument_token).map((trade, index) => {
                        const allTrades = getLastTrades(selectedInstrument.instrument_token)
                        const originalIndex = allTrades.findIndex((t) => t.id === trade.id)
                        const prevTrade = allTrades[originalIndex + 1]
                        const priceChange = prevTrade ? trade.last_price - prevTrade.last_price : 0
                        const changePercent =
                          prevTrade && prevTrade.last_price > 0 ? (priceChange / prevTrade.last_price) * 100 : 0

                        return (
                          <Card
                            key={trade.id}
                            className="overflow-hidden hover:shadow-md transition-shadow active:scale-[0.98]"
                          >
                            <CardContent className="p-4">
                              {/* Header Row */}
                              <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                  <div
                                    className={`w-3 h-3 rounded-full ${
                                      priceChange > 0 ? "bg-green-500" : priceChange < 0 ? "bg-red-500" : "bg-gray-400"
                                    }`}
                                  />
                                  <span className="text-xs text-gray-500 font-mono">
                                    #{String(originalIndex + 1).padStart(2, "0")}
                                  </span>
                                </div>
                                <div className="text-xs text-gray-500 font-medium">
                                  {new Date(trade.timestamp).toLocaleTimeString("en-IN", {
                                    timeZone: "Asia/Kolkata",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                    hour12: true,
                                  })}
                                </div>
                              </div>

                              {/* Price and Change Row */}
                              <div className="flex items-center justify-between mb-3">
                                <div>
                                  <div className="text-xs text-gray-500 mb-1">Trade Price</div>
                                  <div className="text-xl font-bold text-gray-900">
                                    ₹{formatPrice(trade.last_price)}
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="text-xs text-gray-500 mb-1">Change</div>
                                  <div
                                    className={`flex items-center justify-end gap-1 ${
                                      priceChange > 0
                                        ? "text-green-600"
                                        : priceChange < 0
                                          ? "text-red-600"
                                          : "text-gray-500"
                                    }`}
                                  >
                                    {priceChange > 0 && <TrendingUp className="w-3 h-3" />}
                                    {priceChange < 0 && <TrendingDown className="w-3 h-3" />}
                                    {priceChange === 0 && <Minus className="w-3 h-3" />}
                                    <div className="text-right">
                                      <div className="text-sm font-medium">
                                        {priceChange > 0 ? "+" : ""}
                                        {priceChange.toFixed(2)}
                                      </div>
                                      {changePercent !== 0 && (
                                        <div className="text-xs">
                                          {changePercent > 0 ? "+" : ""}
                                          {changePercent.toFixed(2)}%
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* Stats Grid */}
                              <div className="grid grid-cols-3 gap-3 text-sm border-t pt-3">
                                <div className="text-center">
                                  <div className="text-xs text-gray-500 mb-1">Quantity</div>
                                  <div className="font-semibold text-gray-900">
                                    {trade.last_quantity.toLocaleString()}
                                  </div>
                                </div>
                                <div className="text-center">
                                  <div className="text-xs text-gray-500 mb-1">Volume</div>
                                  <div className="font-medium text-gray-700">{formatVolume(trade.volume)}</div>
                                </div>
                                <div className="text-center">
                                  <div className="text-xs text-gray-500 mb-1">Delay</div>
                                  <div
                                    className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                      trade.delay > 1000
                                        ? "bg-red-100 text-red-700"
                                        : trade.delay > 500
                                          ? "bg-yellow-100 text-yellow-700"
                                          : "bg-green-100 text-green-700"
                                    }`}
                                  >
                                    {formatDelay(trade.delay)}
                                  </div>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        )
                      })}
                  </div>
                </ScrollArea>
              </div>

              {/* Desktop Table View */}
              <div className="hidden lg:block h-full p-6">
                <ScrollArea className="h-full">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50 hover:bg-gray-50">
                        <TableHead className="w-12">#</TableHead>
                        <TableHead className="w-24 cursor-pointer" onClick={() => handleSort("time")}>
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4" />
                            Time
                            {sortField === "time" &&
                              (sortDirection === "asc" ? (
                                <SortAsc className="w-3 h-3" />
                              ) : (
                                <SortDesc className="w-3 h-3" />
                              ))}
                          </div>
                        </TableHead>
                        <TableHead className="cursor-pointer" onClick={() => handleSort("price")}>
                          <div className="flex items-center gap-2">
                            <TrendingUp className="w-4 h-4" />
                            Price
                            {sortField === "price" &&
                              (sortDirection === "asc" ? (
                                <SortAsc className="w-3 h-3" />
                              ) : (
                                <SortDesc className="w-3 h-3" />
                              ))}
                          </div>
                        </TableHead>
                        <TableHead className="cursor-pointer" onClick={() => handleSort("quantity")}>
                          <div className="flex items-center gap-2">
                            <Activity className="w-4 h-4" />
                            Quantity
                            {sortField === "quantity" &&
                              (sortDirection === "asc" ? (
                                <SortAsc className="w-3 h-3" />
                              ) : (
                                <SortDesc className="w-3 h-3" />
                              ))}
                          </div>
                        </TableHead>
                        <TableHead className="cursor-pointer" onClick={() => handleSort("volume")}>
                          Volume
                          {sortField === "volume" &&
                            (sortDirection === "asc" ? (
                              <SortAsc className="w-3 h-3 ml-1" />
                            ) : (
                              <SortDesc className="w-3 h-3 ml-1" />
                            ))}
                        </TableHead>
                        <TableHead className="cursor-pointer" onClick={() => handleSort("change")}>
                          Change
                          {sortField === "change" &&
                            (sortDirection === "asc" ? (
                              <SortAsc className="w-3 h-3 ml-1" />
                            ) : (
                              <SortDesc className="w-3 h-3 ml-1" />
                            ))}
                        </TableHead>
                        <TableHead>
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4" />
                            Delay
                          </div>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedInstrument &&
                        getSortedAndFilteredTrades(selectedInstrument.instrument_token).map((trade, index) => {
                          const allTrades = getLastTrades(selectedInstrument.instrument_token)
                          const originalIndex = allTrades.findIndex((t) => t.id === trade.id)
                          const prevTrade = allTrades[originalIndex + 1]
                          const priceChange = prevTrade ? trade.last_price - prevTrade.last_price : 0
                          const changePercent =
                            prevTrade && prevTrade.last_price > 0 ? (priceChange / prevTrade.last_price) * 100 : 0

                          return (
                            <TableRow key={trade.id} className="hover:bg-blue-50/50 transition-colors">
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <div
                                    className={`w-2 h-2 rounded-full ${
                                      priceChange > 0 ? "bg-green-500" : priceChange < 0 ? "bg-red-500" : "bg-gray-400"
                                    }`}
                                  />
                                  <span className="text-xs font-mono text-gray-500">
                                    {String(originalIndex + 1).padStart(2, "0")}
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="text-sm">
                                  <div className="font-medium">
                                    {new Date(trade.timestamp).toLocaleTimeString("en-IN", {
                                      timeZone: "Asia/Kolkata",
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })}
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    {new Date(trade.timestamp).toLocaleDateString("en-IN", {
                                      month: "short",
                                      day: "numeric",
                                    })}
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="text-right">
                                  <div className="text-lg font-bold text-gray-900">
                                    ₹{formatPrice(trade.last_price)}
                                  </div>
                                  {changePercent !== 0 && (
                                    <div className={`text-xs ${changePercent > 0 ? "text-green-600" : "text-red-600"}`}>
                                      {changePercent > 0 ? "+" : ""}
                                      {changePercent.toFixed(2)}%
                                    </div>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="text-right">
                                  <div className="font-semibold text-gray-900">
                                    {trade.last_quantity.toLocaleString()}
                                  </div>
                                  <div className="text-xs text-gray-500">shares</div>
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="text-right">
                                  <div className="font-medium text-gray-700">{formatVolume(trade.volume)}</div>
                                </div>
                              </TableCell>
                              <TableCell>
                                <div
                                  className={`flex items-center justify-center gap-2 ${
                                    priceChange > 0
                                      ? "text-green-600"
                                      : priceChange < 0
                                        ? "text-red-600"
                                        : "text-gray-500"
                                  }`}
                                >
                                  {priceChange > 0 && <TrendingUp className="w-4 h-4" />}
                                  {priceChange < 0 && <TrendingDown className="w-4 h-4" />}
                                  {priceChange === 0 && <Minus className="w-4 h-4" />}
                                  <div className="text-right">
                                    <div className="font-medium">
                                      {priceChange > 0 ? "+" : ""}
                                      {priceChange.toFixed(2)}
                                    </div>
                                    <div className="text-xs">₹{Math.abs(priceChange).toFixed(2)}</div>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="text-center">
                                  <div
                                    className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                      trade.delay > 1000
                                        ? "bg-red-100 text-red-700"
                                        : trade.delay > 500
                                          ? "bg-yellow-100 text-yellow-700"
                                          : "bg-green-100 text-green-700"
                                    }`}
                                  >
                                    {formatDelay(trade.delay)}
                                  </div>
                                </div>
                              </TableCell>
                            </TableRow>
                          )
                        })}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

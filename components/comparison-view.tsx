"use client"

import { useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Wifi,
  WifiOff,
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle,
  GitCompare,
} from "lucide-react"
import type { TickData } from "@/hooks/use-tick-data"
import type { UpstoxTickData } from "@/hooks/use-upstox-tick-data"

interface ComparisonViewProps {
  kiteTicks: TickData[]
  upstoxTicks: UpstoxTickData[]
  kiteConnected: boolean
  upstoxConnected: boolean
}

interface InstrumentMapping {
  segment: string
  kiteName: string
  upstoxPattern: string
  displayName: string
  description: string
}

// Instrument mappings as specified in requirements
const INSTRUMENT_MAPPINGS: InstrumentMapping[] = [
  {
    segment: "NSE",
    kiteName: "BHEL",
    upstoxPattern: "NSE_EQ",
    displayName: "BHEL",
    description: "NSE Equity - BHEL",
  },
  {
    segment: "BSE",
    kiteName: "RELIANCE",
    upstoxPattern: "BSE_EQ",
    displayName: "RELIANCE",
    description: "BSE Equity - RELIANCE",
  },
  {
    segment: "CDS",
    kiteName: "USDINR",
    upstoxPattern: "NCD_FO",
    displayName: "USDINR",
    description: "Currency Derivatives - USDINR",
  },
  {
    segment: "MCX",
    kiteName: "CRUDEOIL",
    upstoxPattern: "MCX_FO",
    displayName: "CRUDEOIL",
    description: "MCX Futures - CRUDEOIL",
  },
  {
    segment: "NFO",
    kiteName: "NIFTY",
    upstoxPattern: "NSE_FO",
    displayName: "NIFTY",
    description: "NSE Futures - NIFTY",
  },
  {
    segment: "BFO",
    kiteName: "SENSEX",
    upstoxPattern: "BSE_FO",
    displayName: "SENSEX",
    description: "BSE Futures - SENSEX",
  },
]

interface ComparisonData {
  mapping: InstrumentMapping
  kiteData: TickData | null
  upstoxData: UpstoxTickData | null
  priceDifference: number
  percentageDifference: number
  delayDifference: number
  lastUpdated: {
    kite: number | null
    upstox: number | null
  }
  status: "both" | "kite-only" | "upstox-only" | "none"
}

export function ComparisonView({ kiteTicks, upstoxTicks, kiteConnected, upstoxConnected }: ComparisonViewProps) {
  // Helper function to find Kite instrument by name
  const findKiteInstrument = (kiteName: string): TickData | null => {
    // First try to find by tradingsymbol
    let matchingTick = kiteTicks
      .filter((tick) => tick.tradingsymbol && tick.tradingsymbol.toUpperCase().includes(kiteName.toUpperCase()))
      .sort((a, b) => b.timestamp - a.timestamp)[0]

    // If not found by tradingsymbol, try to find by known token mappings
    if (!matchingTick) {
      const tokenMap: Record<string, number> = {
        BHEL: 281836549,
        RELIANCE: 128083204,
        USDINR: 408065,
        CRUDEOIL: 134657,
        NIFTY: 256265,
        SENSEX: 265,
      }

      const expectedToken = tokenMap[kiteName.toUpperCase()]
      if (expectedToken) {
        matchingTick = kiteTicks
          .filter((tick) => tick.instrument_token === expectedToken)
          .sort((a, b) => b.timestamp - a.timestamp)[0]
      }
    }

    return matchingTick || null
  }

  // Helper function to find Upstox instrument by pattern
  const findUpstoxInstrument = (upstoxPattern: string): UpstoxTickData | null => {
    return (
      upstoxTicks
        .filter((tick) => tick.instrument_token.toUpperCase().includes(upstoxPattern.toUpperCase()))
        .sort((a, b) => b.timestamp - a.timestamp)[0] || null
    )
  }

  const comparisonData = useMemo(() => {
    const data: ComparisonData[] = []

    for (const mapping of INSTRUMENT_MAPPINGS) {
      // Find matching instruments
      const kiteData = findKiteInstrument(mapping.kiteName)
      const upstoxData = findUpstoxInstrument(mapping.upstoxPattern)

      // Determine status
      let status: ComparisonData["status"] = "none"
      if (kiteData && upstoxData) status = "both"
      else if (kiteData) status = "kite-only"
      else if (upstoxData) status = "upstox-only"

      // Calculate differences
      let priceDifference = 0
      let percentageDifference = 0
      let delayDifference = 0

      if (kiteData && upstoxData && kiteData.last_price > 0 && upstoxData.last_price > 0) {
        priceDifference = kiteData.last_price - upstoxData.last_price
        percentageDifference = (priceDifference / upstoxData.last_price) * 100
        delayDifference = kiteData.delay - upstoxData.delay
      }

      data.push({
        mapping,
        kiteData,
        upstoxData,
        priceDifference,
        percentageDifference,
        delayDifference,
        lastUpdated: {
          kite: kiteData?.timestamp || null,
          upstox: upstoxData?.timestamp || null,
        },
        status,
      })
    }

    return data
  }, [kiteTicks, upstoxTicks])

  // Summary statistics
  const stats = useMemo(() => {
    const bothFeeds = comparisonData.filter((item) => item.status === "both").length
    const kiteOnly = comparisonData.filter((item) => item.status === "kite-only").length
    const upstoxOnly = comparisonData.filter((item) => item.status === "upstox-only").length
    const totalMatched = bothFeeds

    const avgPriceDiff =
      totalMatched > 0
        ? comparisonData
            .filter((item) => item.status === "both")
            .reduce((sum, item) => sum + Math.abs(item.priceDifference), 0) / totalMatched
        : 0

    const avgDelayDiff =
      totalMatched > 0
        ? comparisonData
            .filter((item) => item.status === "both")
            .reduce((sum, item) => sum + Math.abs(item.delayDifference), 0) / totalMatched
        : 0

    return { bothFeeds, kiteOnly, upstoxOnly, totalMatched, avgPriceDiff, avgDelayDiff }
  }, [comparisonData])

  const formatPrice = (price: number) =>
    new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(price)

  const formatTime = (timestamp: number | null) => {
    if (!timestamp) return "N/A"
    return new Date(timestamp).toLocaleTimeString("en-IN", {
      timeZone: "Asia/Kolkata",
      hour12: false,
    })
  }

  const formatDelay = (delay: number) => {
    if (delay === 0) return "N/A"
    if (delay < 1000) return `${delay}ms`
    if (delay < 60000) return `${(delay / 1000).toFixed(1)}s`
    return `${(delay / 60000).toFixed(1)}m`
  }

  const getDifferenceColor = (difference: number) => {
    if (Math.abs(difference) < 0.01) return "text-gray-500"
    return difference > 0 ? "text-green-600" : "text-red-600"
  }

  const getDifferenceIcon = (difference: number) => {
    if (Math.abs(difference) < 0.01) return <Minus className="w-4 h-4" />
    return difference > 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />
  }

  const getStatusIcon = (status: ComparisonData["status"]) => {
    switch (status) {
      case "both":
        return <CheckCircle className="w-4 h-4 text-green-600" />
      case "kite-only":
        return <AlertTriangle className="w-4 h-4 text-orange-600" />
      case "upstox-only":
        return <AlertTriangle className="w-4 h-4 text-blue-600" />
      default:
        return <XCircle className="w-4 h-4 text-red-600" />
    }
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <GitCompare className="w-5 h-5 sm:w-6 sm:h-6 text-purple-600" />
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 font-mono">Feed Comparison</h2>
            <p className="text-xs sm:text-sm text-gray-500 font-mono">
              Real-time comparison between Kite and Upstox market data feeds
            </p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
          <div className="flex items-center gap-2">
            {kiteConnected ? (
              <Wifi className="w-3 h-3 sm:w-4 sm:h-4 text-green-600" />
            ) : (
              <WifiOff className="w-3 h-3 sm:w-4 sm:h-4 text-red-600" />
            )}
            <span className={`text-xs sm:text-sm font-medium ${kiteConnected ? "text-green-600" : "text-red-600"}`}>
              Kite {kiteConnected ? "Connected" : "Disconnected"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {upstoxConnected ? (
              <Wifi className="w-3 h-3 sm:w-4 sm:h-4 text-green-600" />
            ) : (
              <WifiOff className="w-3 h-3 sm:w-4 sm:h-4 text-red-600" />
            )}
            <span className={`text-xs sm:text-sm font-medium ${upstoxConnected ? "text-green-600" : "text-red-600"}`}>
              Upstox {upstoxConnected ? "Connected" : "Disconnected"}
            </span>
          </div>
        </div>
      </div>

      {/* Connection Status Alert */}
      {(!kiteConnected || !upstoxConnected) && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="text-sm">
            {!kiteConnected && !upstoxConnected
              ? "Both feeds are disconnected. Comparison data may be stale."
              : !kiteConnected
                ? "Kite feed is disconnected. Only Upstox data is live."
                : "Upstox feed is disconnected. Only Kite data is live."}
          </AlertDescription>
        </Alert>
      )}

      {/* Summary Statistics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card className="bg-green-50 border-green-200">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <CheckCircle className="w-6 h-6 sm:w-8 sm:h-8 text-green-600 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-gray-600 truncate">Both Feeds</p>
                <p className="text-lg sm:text-2xl font-bold text-gray-900 font-mono">{stats.bothFeeds}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-orange-50 border-orange-200">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <AlertTriangle className="w-6 h-6 sm:w-8 sm:h-8 text-orange-600 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-gray-600 truncate">Kite Only</p>
                <p className="text-lg sm:text-2xl font-bold text-gray-900 font-mono">{stats.kiteOnly}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <AlertTriangle className="w-6 h-6 sm:w-8 sm:h-8 text-blue-600 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-gray-600 truncate">Upstox Only</p>
                <p className="text-lg sm:text-2xl font-bold text-gray-900 font-mono">{stats.upstoxOnly}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-purple-50 border-purple-200">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <GitCompare className="w-6 h-6 sm:w-8 sm:h-8 text-purple-600 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-gray-600 truncate">Total Instruments</p>
                <p className="text-lg sm:text-2xl font-bold text-gray-900 font-mono">{INSTRUMENT_MAPPINGS.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Average Differences */}
      {stats.totalMatched > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Average Price Difference</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 px-2.5">
                <TrendingUp className="w-4 h-4 text-gray-500" />
                <span className="text-base sm:text-lg font-semibold">₹{formatPrice(stats.avgPriceDiff)}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Average Delay Difference</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 px-2.5">
                <Clock className="w-4 h-4 text-gray-500" />
                <span className="text-base sm:text-lg font-semibold">{formatDelay(stats.avgDelayDiff)}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Mobile Card View */}
      <div className="block lg:hidden space-y-3">
        <h3 className="text-lg font-semibold text-gray-900">Instrument Comparison</h3>
        {comparisonData.map((item, index) => (
          <Card key={index} className="overflow-hidden">
            <CardContent className="p-4">
              {/* Card Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  {getStatusIcon(item.status)}
                  <div>
                    <div className="font-semibold text-gray-900">{item.mapping.displayName}</div>
                    <div className="text-xs text-gray-500">{item.mapping.description}</div>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Badge variant="outline" className="text-xs">
                    {item.mapping.segment}
                  </Badge>
                  <Badge
                    variant={
                      item.status === "both"
                        ? "default"
                        : item.status === "kite-only"
                          ? "secondary"
                          : item.status === "upstox-only"
                            ? "outline"
                            : "destructive"
                    }
                    className={`text-xs ${
                      item.status === "both"
                        ? "bg-green-100 text-green-800"
                        : item.status === "kite-only"
                          ? "bg-orange-100 text-orange-800"
                          : item.status === "upstox-only"
                            ? "bg-blue-100 text-blue-800"
                            : ""
                    }`}
                  >
                    {item.status === "both"
                      ? "Both"
                      : item.status === "kite-only"
                        ? "Kite"
                        : item.status === "upstox-only"
                          ? "Upstox"
                          : "None"}
                  </Badge>
                </div>
              </div>

              {/* Price Comparison */}
              <div className="grid grid-cols-2 gap-4 mb-3">
                <div>
                  <div className="text-xs text-gray-500 mb-1">Kite Price</div>
                  {item.kiteData ? (
                    <div>
                      <div className="font-mono text-sm">₹{formatPrice(item.kiteData.last_price)}</div>
                      <div className="text-xs text-gray-500">Vol: {item.kiteData.volume.toLocaleString()}</div>
                    </div>
                  ) : (
                    <span className="text-gray-400 text-sm">-</span>
                  )}
                </div>
                <div>
                  <div className="text-xs text-gray-500 mb-1">Upstox Price</div>
                  {item.upstoxData ? (
                    <div>
                      <div className="font-mono text-sm">₹{formatPrice(item.upstoxData.last_price)}</div>
                      <div className="text-xs text-gray-500">Vol: {item.upstoxData.volume.toLocaleString()}</div>
                    </div>
                  ) : (
                    <span className="text-gray-400 text-sm">-</span>
                  )}
                </div>
              </div>

              {/* Price Difference */}
              {item.kiteData && item.upstoxData && (
                <div className="mb-3">
                  <div className="text-xs text-gray-500 mb-1">Price Difference</div>
                  <div className={`flex items-center gap-2 ${getDifferenceColor(item.priceDifference)}`}>
                    {getDifferenceIcon(item.priceDifference)}
                    <div>
                      <div className="font-mono text-sm">
                        {item.priceDifference > 0 ? "+" : ""}₹{Math.abs(item.priceDifference).toFixed(2)}
                      </div>
                      <div className="text-xs">
                        {item.percentageDifference > 0 ? "+" : ""}
                        {item.percentageDifference.toFixed(3)}%
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Delays and Timestamps */}
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <div className="text-gray-500 mb-1">Kite Delay</div>
                  {item.kiteData ? (
                    <span
                      className={`font-mono ${
                        item.kiteData.delay > 1000
                          ? "text-red-600"
                          : item.kiteData.delay > 500
                            ? "text-yellow-600"
                            : "text-green-600"
                      }`}
                    >
                      {formatDelay(item.kiteData.delay)}
                    </span>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                  <div className="text-gray-500 mt-1">{formatTime(item.lastUpdated.kite)}</div>
                </div>
                <div>
                  <div className="text-gray-500 mb-1">Upstox Delay</div>
                  {item.upstoxData ? (
                    <span
                      className={`font-mono ${
                        item.upstoxData.delay > 1000
                          ? "text-red-600"
                          : item.upstoxData.delay > 500
                            ? "text-yellow-600"
                            : "text-green-600"
                      }`}
                    >
                      {formatDelay(item.upstoxData.delay)}
                    </span>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                  <div className="text-gray-500 mt-1">{formatTime(item.lastUpdated.upstox)}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Desktop Table View */}
      <Card className="hidden lg:block">
        <CardHeader>
          <CardTitle>Instrument Comparison</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[600px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Instrument</TableHead>
                  <TableHead>Segment</TableHead>
                  <TableHead>Kite Price</TableHead>
                  <TableHead>Upstox Price</TableHead>
                  <TableHead>Price Difference</TableHead>
                  <TableHead>Kite Delay</TableHead>
                  <TableHead>Upstox Delay</TableHead>
                  <TableHead>Last Updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {comparisonData.map((item, index) => (
                  <TableRow key={index}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(item.status)}
                        <Badge
                          variant={
                            item.status === "both"
                              ? "default"
                              : item.status === "kite-only"
                                ? "secondary"
                                : item.status === "upstox-only"
                                  ? "outline"
                                  : "destructive"
                          }
                          className={`text-xs ${
                            item.status === "both"
                              ? "bg-green-100 text-green-800"
                              : item.status === "kite-only"
                                ? "bg-orange-100 text-orange-800"
                                : item.status === "upstox-only"
                                  ? "bg-blue-100 text-blue-800"
                                  : ""
                          }`}
                        >
                          {item.status === "both"
                            ? "Both"
                            : item.status === "kite-only"
                              ? "Kite"
                              : item.status === "upstox-only"
                                ? "Upstox"
                                : "None"}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">
                      <div>
                        <div className="font-semibold">{item.mapping.displayName}</div>
                        <div className="text-xs text-gray-500">{item.mapping.description}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {item.mapping.segment}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {item.kiteData ? (
                        <div className="text-right">
                          <div className="font-mono text-center">₹{formatPrice(item.kiteData.last_price)}</div>
                          <div className="text-xs text-gray-500 text-center">
                            Vol: {item.kiteData.volume.toLocaleString()}
                          </div>
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {item.upstoxData ? (
                        <div className="text-right">
                          <div className="font-mono text-center">₹{formatPrice(item.upstoxData.last_price)}</div>
                          <div className="text-xs text-gray-500 text-center">
                            Vol: {item.upstoxData.volume.toLocaleString()}
                          </div>
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {item.kiteData && item.upstoxData ? (
                        <div className={`flex items-center gap-2 ${getDifferenceColor(item.priceDifference)}`}>
                          {getDifferenceIcon(item.priceDifference)}
                          <div className="text-right">
                            <div className="font-mono">
                              {item.priceDifference > 0 ? "+" : ""}₹{Math.abs(item.priceDifference).toFixed(2)}
                            </div>
                            <div className="text-xs">
                              {item.percentageDifference > 0 ? "+" : ""}
                              {item.percentageDifference.toFixed(3)}%
                            </div>
                          </div>
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {item.kiteData ? (
                        <span
                          className={`font-mono text-xs ${
                            item.kiteData.delay > 1000
                              ? "text-red-600"
                              : item.kiteData.delay > 500
                                ? "text-yellow-600"
                                : "text-green-600"
                          }`}
                        >
                          {formatDelay(item.kiteData.delay)}
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {item.upstoxData ? (
                        <span
                          className={`font-mono text-xs ${
                            item.upstoxData.delay > 1000
                              ? "text-red-600"
                              : item.upstoxData.delay > 500
                                ? "text-yellow-600"
                                : "text-green-600"
                          }`}
                        >
                          {formatDelay(item.upstoxData.delay)}
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="text-xs text-gray-500">
                        <div>Kite: {formatTime(item.lastUpdated.kite)}</div>
                        <div>Upstox: {formatTime(item.lastUpdated.upstox)}</div>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Matching Strategy Info */}
      <Card className="bg-blue-50 border-blue-200">
        <CardHeader>
          <CardTitle className="text-base sm:text-lg font-bold text-blue-800">Matching Strategy</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-blue-700 space-y-3">
            <p>
              <strong>Instrument Matching Logic:</strong> This comparison uses segment-based matching with predefined
              instrument mappings.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <strong>Kite Matching:</strong>
                <ul className="list-disc list-inside ml-2 text-xs space-y-1 mt-1">
                  <li>Matches by trading symbol (tradingsymbol field)</li>
                  <li>Falls back to known token mappings</li>
                  <li>Case-insensitive partial matching</li>
                </ul>
              </div>
              <div>
                <strong>Upstox Matching:</strong>
                <ul className="list-disc list-inside ml-2 text-xs space-y-1 mt-1">
                  <li>Matches by instrument token containing segment pattern</li>
                  <li>Example: NSE_EQ matches tokens like "NSE_EQ|INE123A01012"</li>
                  <li>Segment-specific pattern matching</li>
                </ul>
              </div>
            </div>
            <div>
              <strong>Supported Segments:</strong>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 mt-2 text-xs">
                {INSTRUMENT_MAPPINGS.map((mapping) => (
                  <div key={mapping.segment} className="bg-blue-100 p-2 rounded">
                    <div className="font-medium">{mapping.segment}</div>
                    <div>Kite: {mapping.kiteName}</div>
                    <div>Upstox: {mapping.upstoxPattern}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

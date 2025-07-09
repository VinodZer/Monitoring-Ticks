"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  History,
  X,
  TrendingUp,
  TrendingDown,
  Minus,
  Filter,
  Search,
  SortAsc,
  SortDesc,
  Clock,
  AlertTriangle,
  Target,
  Activity,
  ChevronDown,
  ChevronUp,
} from "lucide-react"
import type { InactivityAlert } from "@/hooks/use-inactivity-alerts"

interface InactivityAlertsLogProps {
  alerts: InactivityAlert[]
  onClearAlerts: () => void
}

type SortField = "timestamp" | "symbol" | "severity" | "duration" | "priceChange"
type SortDirection = "asc" | "desc"
type SeverityFilter = "all" | "high" | "medium" | "low"

export function InactivityAlertsLog({ alerts, onClearAlerts }: InactivityAlertsLogProps) {
  const [sortField, setSortField] = useState<SortField>("timestamp")
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc")
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("all")
  const [searchTerm, setSearchTerm] = useState("")
  const [expandedCard, setExpandedCard] = useState<string | null>(null)

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(price)
  }

  const formatPriceRange = (min: number, max: number) => {
    if (min === max) {
      return `₹${formatPrice(min)}`
    }
    return `₹${formatPrice(min)} - ₹${formatPrice(max)}`
  }

  const getPriceMovementIcon = (baseline: number, current: number) => {
    if (current > baseline) return <TrendingUp className="w-4 h-4 text-green-600" />
    if (current < baseline) return <TrendingDown className="w-4 h-4 text-red-600" />
    return <Minus className="w-4 h-4 text-gray-500" />
  }

  const getAlertSeverity = (alert: InactivityAlert) => {
    const priceRange = alert.priceRange.max - alert.priceRange.min
    if (priceRange < alert.deviation * 0.5) return "high"
    if (priceRange < alert.deviation * 0.8) return "medium"
    return "low"
  }

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case "high":
        return (
          <Badge variant="destructive" className="text-xs font-medium">
            <AlertTriangle className="w-3 h-3 mr-1" />
            High
          </Badge>
        )
      case "medium":
        return (
          <Badge variant="outline" className="text-xs font-medium border-orange-300 text-orange-600 bg-orange-50">
            <Target className="w-3 h-3 mr-1" />
            Medium
          </Badge>
        )
      case "low":
        return (
          <Badge variant="outline" className="text-xs font-medium border-blue-300 text-blue-600 bg-blue-50">
            <Activity className="w-3 h-3 mr-1" />
            Low
          </Badge>
        )
      default:
        return (
          <Badge variant="outline" className="text-xs font-medium">
            Unknown
          </Badge>
        )
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "high":
        return "border-l-red-500 bg-red-50"
      case "medium":
        return "border-l-orange-500 bg-orange-50"
      case "low":
        return "border-l-blue-500 bg-blue-50"
      default:
        return "border-l-gray-500 bg-gray-50"
    }
  }

  const filteredAndSortedAlerts = useMemo(() => {
    const filtered = alerts.filter((alert) => {
      const severity = getAlertSeverity(alert)
      const matchesSeverity = severityFilter === "all" || severity === severityFilter
      const matchesSearch = searchTerm === "" || alert.instrumentName.toLowerCase().includes(searchTerm.toLowerCase())

      return matchesSeverity && matchesSearch
    })

    return filtered.sort((a, b) => {
      let aValue: any, bValue: any

      switch (sortField) {
        case "timestamp":
          aValue = new Date(a.timestamp).getTime()
          bValue = new Date(b.timestamp).getTime()
          break
        case "symbol":
          aValue = a.instrumentName
          bValue = b.instrumentName
          break
        case "severity":
          aValue = getAlertSeverity(a)
          bValue = getAlertSeverity(b)
          const severityOrder = { high: 3, medium: 2, low: 1 }
          aValue = severityOrder[aValue as keyof typeof severityOrder] || 0
          bValue = severityOrder[bValue as keyof typeof severityOrder] || 0
          break
        case "duration":
          aValue = a.duration
          bValue = b.duration
          break
        case "priceChange":
          aValue = Math.abs(a.currentPrice - a.baselinePrice)
          bValue = Math.abs(b.currentPrice - b.baselinePrice)
          break
        default:
          return 0
      }

      if (sortDirection === "asc") {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0
      }
    })
  }, [alerts, sortField, sortDirection, severityFilter, searchTerm])

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc")
    } else {
      setSortField(field)
      setSortDirection("desc")
    }
  }

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return null
    return sortDirection === "asc" ? <SortAsc className="w-4 h-4 ml-1" /> : <SortDesc className="w-4 h-4 ml-1" />
  }

  const clearFilters = () => {
    setSeverityFilter("all")
    setSearchTerm("")
    setSortField("timestamp")
    setSortDirection("desc")
  }

  const toggleCardExpansion = (alertId: string) => {
    setExpandedCard(expandedCard === alertId ? null : alertId)
  }

  const AlertCard = ({ alert }: { alert: InactivityAlert }) => {
    const severity = getAlertSeverity(alert)
    const priceChange = alert.currentPrice - alert.baselinePrice
    const changePercent = alert.baselinePrice > 0 ? (priceChange / alert.baselinePrice) * 100 : 0
    const isExpanded = expandedCard === alert.id

    return (
      <Card
        className={`mb-3 border-l-4 ${getSeverityColor(severity)} transition-all duration-200 hover:shadow-md active:scale-[0.98]`}
        onClick={() => toggleCardExpansion(alert.id)}
      >
        <CardContent className="p-4">
          {/* Header Row */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-lg text-gray-900">{alert.instrumentName}</span>
              {getSeverityBadge(severity)}
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                <Clock className="w-3 h-3 mr-1" />
                {alert.duration}s
              </Badge>
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </div>
          </div>

          {/* Price Information */}
          <div className="grid grid-cols-2 gap-4 mb-3">
            <div>
              <p className="text-xs text-gray-500 mb-1">Current Price</p>
              <div className="flex items-center gap-1">
                {getPriceMovementIcon(alert.baselinePrice, alert.currentPrice)}
                <span className="font-mono text-sm font-medium">₹{formatPrice(alert.currentPrice)}</span>
              </div>
              {priceChange !== 0 && (
                <span className={`text-xs font-medium ${priceChange > 0 ? "text-green-600" : "text-red-600"}`}>
                  ({priceChange > 0 ? "+" : ""}
                  {priceChange.toFixed(2)})
                </span>
              )}
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Baseline Price</p>
              <span className="font-mono text-sm">₹{formatPrice(alert.baselinePrice)}</span>
            </div>
          </div>

          {/* Timestamp */}
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>
              {new Date(alert.timestamp).toLocaleString("en-IN", {
                timeZone: "Asia/Kolkata",
                hour12: true,
                month: "short",
                day: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
            <span>Threshold: ±{alert.deviation.toFixed(2)}</span>
          </div>

          {/* Expanded Details */}
          {isExpanded && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="grid grid-cols-1 gap-3">
                <div>
                  <p className="text-xs font-medium text-gray-700 mb-1">Price Range During Alert</p>
                  <p className="font-mono text-sm">{formatPriceRange(alert.priceRange.min, alert.priceRange.max)}</p>
                  <p className="text-xs text-gray-500">
                    Range: ₹{formatPrice(alert.priceRange.max - alert.priceRange.min)}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-700 mb-1">Alert Details</p>
                  <p className="text-xs text-gray-600">
                    Price remained within ±{alert.deviation.toFixed(2)} threshold for {alert.duration} seconds
                  </p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  const SummaryStats = () => {
    const stats = useMemo(() => {
      const severityCounts = { high: 0, medium: 0, low: 0 }
      const totalAlerts = filteredAndSortedAlerts.length

      filteredAndSortedAlerts.forEach((alert) => {
        const severity = getAlertSeverity(alert)
        severityCounts[severity as keyof typeof severityCounts]++
      })

      const avgDuration =
        totalAlerts > 0 ? filteredAndSortedAlerts.reduce((sum, alert) => sum + alert.duration, 0) / totalAlerts : 0

      return { severityCounts, totalAlerts, avgDuration }
    }, [filteredAndSortedAlerts])

    return (
      <div className="grid grid-cols-2 gap-4 mb-6">
        <Card className="p-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">{stats.totalAlerts}</div>
            <div className="text-xs text-gray-500">Total Alerts</div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{stats.avgDuration.toFixed(0)}s</div>
            <div className="text-xs text-gray-500">Avg Duration</div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-center">
            <div className="text-lg font-bold text-red-600">{stats.severityCounts.high}</div>
            <div className="text-xs text-gray-500">High Severity</div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-center">
            <div className="text-lg font-bold text-orange-600">{stats.severityCounts.medium}</div>
            <div className="text-xs text-gray-500">Medium Severity</div>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <Card className="w-full max-w-full">
      <CardHeader className="pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
              <History className="w-5 h-5" />
              Alert Log
            </CardTitle>
            <CardDescription className="text-sm">Monitor and analyze price inactivity alerts</CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={onClearAlerts}
            disabled={alerts.length === 0}
            className="w-full sm:w-auto bg-transparent"
          >
            <X className="w-4 h-4 mr-2" />
            Clear Log ({alerts.length})
          </Button>
        </div>

        {/* Mobile-First Controls */}
        <div className="space-y-4 pt-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search by symbol..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 h-12"
            />
          </div>

          {/* Filters Row */}
          <div className="flex flex-col sm:flex-row gap-3">
            <Select value={severityFilter} onValueChange={(value: SeverityFilter) => setSeverityFilter(value)}>
              <SelectTrigger className="h-12">
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4" />
                  <SelectValue placeholder="Filter by severity" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Severities</SelectItem>
                <SelectItem value="high">High Severity</SelectItem>
                <SelectItem value="medium">Medium Severity</SelectItem>
                <SelectItem value="low">Low Severity</SelectItem>
              </SelectContent>
            </Select>

            <Select value={sortField} onValueChange={(value: SortField) => setSortField(value)}>
              <SelectTrigger className="h-12">
                <div className="flex items-center gap-2">
                  {getSortIcon(sortField) || <SortDesc className="w-4 h-4" />}
                  <SelectValue placeholder="Sort by" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="timestamp">Sort by Time</SelectItem>
                <SelectItem value="symbol">Sort by Symbol</SelectItem>
                <SelectItem value="severity">Sort by Severity</SelectItem>
                <SelectItem value="duration">Sort by Duration</SelectItem>
                <SelectItem value="priceChange">Sort by Price Change</SelectItem>
              </SelectContent>
            </Select>

            {(severityFilter !== "all" || searchTerm !== "" || sortField !== "timestamp") && (
              <Button variant="outline" onClick={clearFilters} className="h-12 px-6 bg-transparent">
                Clear Filters
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {alerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <History className="w-16 h-16 text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No alerts yet</h3>
            <p className="text-gray-500 max-w-sm">
              Configure alert settings to start monitoring price inactivity patterns
            </p>
          </div>
        ) : (
          <Tabs defaultValue="alerts" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mx-4 mb-4">
              <TabsTrigger value="alerts" className="text-sm">
                Alerts ({filteredAndSortedAlerts.length})
              </TabsTrigger>
              <TabsTrigger value="summary" className="text-sm">
                Summary
              </TabsTrigger>
            </TabsList>

            <TabsContent value="alerts" className="px-4 pb-4">
              {/* Desktop Table View */}
              <div className="hidden lg:block">
                <ScrollArea className="h-[60vh]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="cursor-pointer hover:bg-gray-50" onClick={() => handleSort("timestamp")}>
                          <div className="flex items-center">Timestamp {getSortIcon("timestamp")}</div>
                        </TableHead>
                        <TableHead className="cursor-pointer hover:bg-gray-50" onClick={() => handleSort("symbol")}>
                          <div className="flex items-center">Symbol {getSortIcon("symbol")}</div>
                        </TableHead>
                        <TableHead>Baseline Price</TableHead>
                        <TableHead>Price Range</TableHead>
                        <TableHead>Current Price</TableHead>
                        <TableHead className="cursor-pointer hover:bg-gray-50" onClick={() => handleSort("duration")}>
                          <div className="flex items-center">Duration {getSortIcon("duration")}</div>
                        </TableHead>
                        <TableHead>Threshold</TableHead>
                        <TableHead className="cursor-pointer hover:bg-gray-50" onClick={() => handleSort("severity")}>
                          <div className="flex items-center">Severity {getSortIcon("severity")}</div>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredAndSortedAlerts.map((alert) => {
                        const severity = getAlertSeverity(alert)
                        const priceChange = alert.currentPrice - alert.baselinePrice

                        return (
                          <TableRow key={alert.id} className="hover:bg-gray-50">
                            <TableCell className="font-mono text-sm">
                              {new Date(alert.timestamp).toLocaleString("en-IN", {
                                timeZone: "Asia/Kolkata",
                                hour12: false,
                                month: "short",
                                day: "2-digit",
                                hour: "2-digit",
                                minute: "2-digit",
                                second: "2-digit",
                              })}
                            </TableCell>
                            <TableCell className="font-medium">{alert.instrumentName}</TableCell>
                            <TableCell className="font-mono">₹{formatPrice(alert.baselinePrice)}</TableCell>
                            <TableCell className="font-mono text-sm">
                              <div className="flex flex-col">
                                <span>{formatPriceRange(alert.priceRange.min, alert.priceRange.max)}</span>
                                <span className="text-xs text-gray-500">
                                  Range: ₹{formatPrice(alert.priceRange.max - alert.priceRange.min)}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="font-mono">
                              <div className="flex items-center gap-1">
                                {getPriceMovementIcon(alert.baselinePrice, alert.currentPrice)}
                                <span>₹{formatPrice(alert.currentPrice)}</span>
                                {priceChange !== 0 && (
                                  <span className={`text-xs ${priceChange > 0 ? "text-green-600" : "text-red-600"}`}>
                                    ({priceChange > 0 ? "+" : ""}
                                    {priceChange.toFixed(2)})
                                  </span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">
                                {alert.duration}s
                              </Badge>
                            </TableCell>
                            <TableCell className="font-mono text-sm">±{alert.deviation.toFixed(2)}</TableCell>
                            <TableCell>{getSeverityBadge(severity)}</TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </div>

              {/* Mobile Card View */}
              <div className="lg:hidden">
                <ScrollArea className="h-[60vh]">
                  {filteredAndSortedAlerts.length > 0 ? (
                    <div className="space-y-1">
                      {filteredAndSortedAlerts.map((alert) => (
                        <AlertCard key={alert.id} alert={alert} />
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                      <Filter className="w-12 h-12 text-gray-300 mb-4" />
                      <p className="text-gray-500">No alerts match your current filters</p>
                      <Button variant="outline" onClick={clearFilters} className="mt-4 bg-transparent">
                        Clear Filters
                      </Button>
                    </div>
                  )}
                </ScrollArea>
              </div>
            </TabsContent>

            <TabsContent value="summary" className="px-4 pb-4">
              <SummaryStats />

              <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h4 className="text-sm font-medium text-blue-900 mb-3">Alert Severity Guide:</h4>
                <div className="space-y-2 text-sm text-blue-800">
                  <div className="flex items-center gap-2">
                    <Badge variant="destructive" className="text-xs">
                      <AlertTriangle className="w-3 h-3 mr-1" />
                      High
                    </Badge>
                    <span>Very minimal price movement (&lt;50% of threshold)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs border-orange-300 text-orange-600 bg-orange-50">
                      <Target className="w-3 h-3 mr-1" />
                      Medium
                    </Badge>
                    <span>Limited movement (50-80% of threshold)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs border-blue-300 text-blue-600 bg-blue-50">
                      <Activity className="w-3 h-3 mr-1" />
                      Low
                    </Badge>
                    <span>Movement close to threshold (&gt;80%)</span>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        )}
      </CardContent>
    </Card>
  )
}

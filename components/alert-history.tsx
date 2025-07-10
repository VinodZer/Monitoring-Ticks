"use client"

import { useState, useEffect, useMemo } from "react"
import { format } from "date-fns"
import { AlertTriangle, Bell, Check, Clock, Search, TrendingUp, Eye, Download, RefreshCw } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { AlertService, type UserAlertLog } from "@/lib/alert-service"
import { useAuth } from "@/contexts/auth-context"
import { useToast } from "@/hooks/use-toast"

interface AlertHistoryProps {
  className?: string
}

export function AlertHistory({ className }: AlertHistoryProps) {
  const { user } = useAuth()
  const { toast } = useToast()
  const [alerts, setAlerts] = useState<UserAlertLog[]>([])
  const [loading, setLoading] = useState(true)
  const [totalCount, setTotalCount] = useState(0)
  const [currentPage, setCurrentPage] = useState(0)
  const [pageSize] = useState(25)
  const [searchTerm, setSearchTerm] = useState("")
  const [filterType, setFilterType] = useState<string>("all")
  const [filterStatus, setFilterStatus] = useState<string>("all")
  const [selectedAlert, setSelectedAlert] = useState<UserAlertLog | null>(null)
  const [statistics, setStatistics] = useState({
    totalAlerts: 0,
    unacknowledgedAlerts: 0,
    alertsToday: 0,
    alertsThisWeek: 0,
    topAlertingInstruments: [] as Array<{ instrument_name: string; count: number }>,
  })

  useEffect(() => {
    if (user) {
      loadAlerts()
      loadStatistics()
    }
  }, [user, currentPage, filterType, filterStatus, searchTerm])

  const loadAlerts = async () => {
    if (!user) return

    setLoading(true)
    try {
      const options = {
        limit: pageSize,
        offset: currentPage * pageSize,
        alertType: filterType !== "all" ? filterType : undefined,
        acknowledged: filterStatus === "acknowledged" ? true : filterStatus === "unacknowledged" ? false : undefined,
      }

      const { logs, total } = await AlertService.getUserAlertLogs(user.id, options)

      // Filter by search term if provided
      let filteredLogs = logs
      if (searchTerm) {
        filteredLogs = logs.filter(
          (log) =>
            log.instrument_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            log.exchange.toLowerCase().includes(searchTerm.toLowerCase()),
        )
      }

      setAlerts(filteredLogs)
      setTotalCount(total)
    } catch (error) {
      console.error("Error loading alerts:", error)
      toast({
        title: "Error",
        description: "Failed to load alert history",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const loadStatistics = async () => {
    if (!user) return

    try {
      const stats = await AlertService.getAlertStatistics(user.id)
      setStatistics(stats)
    } catch (error) {
      console.error("Error loading statistics:", error)
    }
  }

  const handleAcknowledge = async (alertId: string) => {
    if (!user) return

    const success = await AlertService.acknowledgeAlert(user.id, alertId)
    if (success) {
      setAlerts((prev) =>
        prev.map((alert) =>
          alert.id === alertId ? { ...alert, acknowledged: true, acknowledged_at: new Date().toISOString() } : alert,
        ),
      )
      loadStatistics() // Refresh stats
      toast({
        title: "Alert acknowledged",
        description: "The alert has been marked as acknowledged.",
      })
    } else {
      toast({
        title: "Error",
        description: "Failed to acknowledge alert",
        variant: "destructive",
      })
    }
  }

  const handleAcknowledgeAll = async () => {
    if (!user) return

    const success = await AlertService.acknowledgeAllAlerts(user.id)
    if (success) {
      setAlerts((prev) =>
        prev.map((alert) => ({
          ...alert,
          acknowledged: true,
          acknowledged_at: new Date().toISOString(),
        })),
      )
      loadStatistics()
      toast({
        title: "All alerts acknowledged",
        description: "All unacknowledged alerts have been marked as acknowledged.",
      })
    } else {
      toast({
        title: "Error",
        description: "Failed to acknowledge all alerts",
        variant: "destructive",
      })
    }
  }

  const exportAlerts = () => {
    const csvContent = [
      [
        "Date",
        "Time",
        "Instrument",
        "Exchange",
        "Type",
        "Baseline Price",
        "Current Price",
        "Deviation",
        "Duration",
        "Status",
      ],
      ...alerts.map((alert) => [
        format(new Date(alert.created_at!), "yyyy-MM-dd"),
        format(new Date(alert.created_at!), "HH:mm:ss"),
        alert.instrument_name,
        alert.exchange,
        alert.alert_type,
        alert.baseline_price?.toString() || "",
        alert.current_price?.toString() || "",
        alert.deviation?.toString() || "",
        alert.duration?.toString() || "",
        alert.acknowledged ? "Acknowledged" : "Unacknowledged",
      ]),
    ]
      .map((row) => row.join(","))
      .join("\n")

    const blob = new Blob([csvContent], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `alert-history-${format(new Date(), "yyyy-MM-dd")}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const filteredAlerts = useMemo(() => {
    return alerts.filter((alert) => {
      const matchesSearch =
        !searchTerm ||
        alert.instrument_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        alert.exchange.toLowerCase().includes(searchTerm.toLowerCase())

      const matchesType = filterType === "all" || alert.alert_type === filterType

      const matchesStatus =
        filterStatus === "all" ||
        (filterStatus === "acknowledged" && alert.acknowledged) ||
        (filterStatus === "unacknowledged" && !alert.acknowledged)

      return matchesSearch && matchesType && matchesStatus
    })
  }, [alerts, searchTerm, filterType, filterStatus])

  const totalPages = Math.ceil(totalCount / pageSize)

  if (!user) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Please sign in to view alert history</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded">
                <Bell className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Alerts</p>
                <p className="text-2xl font-bold">{statistics.totalAlerts}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Unacknowledged</p>
                <p className="text-2xl font-bold">{statistics.unacknowledgedAlerts}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded">
                <Clock className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Today</p>
                <p className="text-2xl font-bold">{statistics.alertsToday}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded">
                <TrendingUp className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">This Week</p>
                <p className="text-2xl font-bold">{statistics.alertsThisWeek}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Alert History Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Alert History</CardTitle>
              <CardDescription>View and manage your trading alert history</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={loadAlerts} disabled={loading}>
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
              <Button variant="outline" size="sm" onClick={exportAlerts}>
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
              {statistics.unacknowledgedAlerts > 0 && (
                <Button size="sm" onClick={handleAcknowledgeAll}>
                  <Check className="w-4 h-4 mr-2" />
                  Acknowledge All
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search instruments..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Alert Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="inactivity">Inactivity</SelectItem>
                <SelectItem value="price_change">Price Change</SelectItem>
                <SelectItem value="volume_spike">Volume Spike</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="acknowledged">Acknowledged</SelectItem>
                <SelectItem value="unacknowledged">Unacknowledged</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Alert Table */}
          <div className="border rounded-lg">
            <ScrollArea className="h-[500px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date & Time</TableHead>
                    <TableHead>Instrument</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Price Info</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8">
                        <div className="flex items-center justify-center">
                          <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                          Loading alerts...
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : filteredAlerts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8">
                        <div className="text-muted-foreground">
                          {searchTerm || filterType !== "all" || filterStatus !== "all"
                            ? "No alerts match your filters"
                            : "No alerts found"}
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredAlerts.map((alert) => (
                      <TableRow key={alert.id}>
                        <TableCell>
                          <div className="text-sm">
                            <div>{format(new Date(alert.created_at!), "MMM dd, yyyy")}</div>
                            <div className="text-muted-foreground">
                              {format(new Date(alert.created_at!), "HH:mm:ss")}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{alert.instrument_name}</div>
                            <div className="text-sm text-muted-foreground">{alert.exchange}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {alert.alert_type.replace("_", " ")}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <div>Baseline: ₹{alert.baseline_price?.toFixed(2)}</div>
                            <div>Current: ₹{alert.current_price?.toFixed(2)}</div>
                            {alert.deviation && <div>±{alert.deviation}</div>}
                          </div>
                        </TableCell>
                        <TableCell>{alert.duration && <Badge variant="secondary">{alert.duration}s</Badge>}</TableCell>
                        <TableCell>
                          {alert.acknowledged ? (
                            <Badge variant="default" className="bg-green-100 text-green-800">
                              <Check className="w-3 h-3 mr-1" />
                              Acknowledged
                            </Badge>
                          ) : (
                            <Badge variant="destructive">
                              <AlertTriangle className="w-3 h-3 mr-1" />
                              Unacknowledged
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button variant="ghost" size="sm" onClick={() => setSelectedAlert(alert)}>
                                  <Eye className="w-4 h-4" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-2xl">
                                <DialogHeader>
                                  <DialogTitle>Alert Details</DialogTitle>
                                  <DialogDescription>Detailed information about this alert</DialogDescription>
                                </DialogHeader>
                                {selectedAlert && (
                                  <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                      <div>
                                        <Label className="text-sm font-medium">Instrument</Label>
                                        <p className="text-sm">{selectedAlert.instrument_name}</p>
                                      </div>
                                      <div>
                                        <Label className="text-sm font-medium">Exchange</Label>
                                        <p className="text-sm">{selectedAlert.exchange}</p>
                                      </div>
                                      <div>
                                        <Label className="text-sm font-medium">Alert Type</Label>
                                        <p className="text-sm capitalize">
                                          {selectedAlert.alert_type.replace("_", " ")}
                                        </p>
                                      </div>
                                      <div>
                                        <Label className="text-sm font-medium">Market Session</Label>
                                        <p className="text-sm">{selectedAlert.market_session}</p>
                                      </div>
                                      <div>
                                        <Label className="text-sm font-medium">Baseline Price</Label>
                                        <p className="text-sm">₹{selectedAlert.baseline_price?.toFixed(2)}</p>
                                      </div>
                                      <div>
                                        <Label className="text-sm font-medium">Current Price</Label>
                                        <p className="text-sm">₹{selectedAlert.current_price?.toFixed(2)}</p>
                                      </div>
                                      {selectedAlert.price_range && (
                                        <>
                                          <div>
                                            <Label className="text-sm font-medium">Price Range Min</Label>
                                            <p className="text-sm">₹{selectedAlert.price_range.min?.toFixed(2)}</p>
                                          </div>
                                          <div>
                                            <Label className="text-sm font-medium">Price Range Max</Label>
                                            <p className="text-sm">₹{selectedAlert.price_range.max?.toFixed(2)}</p>
                                          </div>
                                        </>
                                      )}
                                    </div>
                                    <Separator />
                                    <div>
                                      <Label className="text-sm font-medium">Alert Data</Label>
                                      <ScrollArea className="h-32 mt-2">
                                        <pre className="text-xs bg-gray-50 p-2 rounded">
                                          {JSON.stringify(selectedAlert.alert_data, null, 2)}
                                        </pre>
                                      </ScrollArea>
                                    </div>
                                  </div>
                                )}
                              </DialogContent>
                            </Dialog>
                            {!alert.acknowledged && (
                              <Button variant="ghost" size="sm" onClick={() => handleAcknowledge(alert.id!)}>
                                <Check className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Showing {currentPage * pageSize + 1} to {Math.min((currentPage + 1) * pageSize, totalCount)} of{" "}
                {totalCount} alerts
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
                  disabled={currentPage === 0}
                >
                  Previous
                </Button>
                <span className="text-sm">
                  Page {currentPage + 1} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(Math.min(totalPages - 1, currentPage + 1))}
                  disabled={currentPage === totalPages - 1}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Top Alerting Instruments */}
      {statistics.topAlertingInstruments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Top Alerting Instruments (This Week)</CardTitle>
            <CardDescription>Instruments that triggered the most alerts</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {statistics.topAlertingInstruments.map((instrument, index) => (
                <div
                  key={instrument.instrument_name}
                  className="flex items-center justify-between p-2 bg-gray-50 rounded"
                >
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{index + 1}</Badge>
                    <span className="font-medium">{instrument.instrument_name}</span>
                  </div>
                  <Badge>{instrument.count} alerts</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

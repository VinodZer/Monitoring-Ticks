"use client"

import { useState } from "react"
import {
  ActivityIcon,
  Activity,
  TrendingUp,
  Wifi,
  Clock,
  Settings,
  Bell,
  History,
  Sliders,
  GitCompare,
  Menu,
  X,
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { MarketDataGrid } from "@/components/market-data-grid"
import { UpstoxMarketDataGrid } from "@/components/upstox-market-data-grid"
import { DebugDashboard } from "@/components/debug-dashboard"
import { AlertSettingsTab } from "@/components/alert-settings-tab"
import { ComparisonView } from "@/components/comparison-view"
import { useTickData } from "@/hooks/use-tick-data"
import { InactivityAlertsLog } from "@/components/inactivity-alerts-log"
import { useUpstoxTickData } from "@/hooks/use-upstox-tick-data"
import { useInactivityAlerts } from "@/hooks/use-inactivity-alerts"

export default function MarketDashboard() {
  const {
    ticks,
    isConnected,
    isFrozen,
    lastTickTime,
    averageDelay,
    totalTicks,
    freezingIncidents,
    alerts: systemAlerts, // Renamed to avoid conflict
    connectionStatus,
    clearAlerts,
    rawMessages,
    debugInfo,
    addTestTick,
  } = useTickData()

  const {
    ticks: upstoxTicks,
    isConnected: upstoxIsConnected,
    isFrozen: upstoxIsFrozen,
    lastTickTime: upstoxLastTickTime,
    averageDelay: upstoxAverageDelay,
    totalTicks: upstoxTotalTicks,
    freezingIncidents: upstoxFreezingIncidents,
    alerts: upstoxSystemAlerts,
    connectionStatus: upstoxConnectionStatus,
    clearAlerts: upstoxClearAlerts,
    rawMessages: upstoxRawMessages,
    debugInfo: upstoxDebugInfo,
    addTestTick: upstoxAddTestTick,
  } = useUpstoxTickData()

  // ORIGINAL feed
  const {
    alerts: inactivityAlerts,
    inactiveSymbols,
    configurations,
    updateConfiguration,
    clearAllAlerts,
  } = useInactivityAlerts(ticks)

  // UPSTOX feed - need to create a compatible adapter for the hook
  const upstoxTicksForAlerts = upstoxTicks.map((tick) => ({
    ...tick,
    instrument_token: Number.parseInt(tick.instrument_token.replace(/[^0-9]/g, "")) || 0, // Convert string to number for compatibility
  }))

  const {
    alerts: upstoxInactivityAlerts,
    inactiveSymbols: upstoxInactiveSymbols,
    configurations: upstoxConfigurations,
    updateConfiguration: upstoxUpdateConfiguration,
    clearAllAlerts: upstoxClearAllAlerts,
  } = useInactivityAlerts(upstoxTicksForAlerts)

  const [selectedTab, setSelectedTab] = useState("kite")
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  // Get unique instruments from both feeds
  const uniqueInstruments = ticks.reduce(
    (acc, tick) => {
      if (!acc.find((t) => t.instrument_token === tick.instrument_token)) {
        acc.push(tick)
      }
      return acc
    },
    [] as typeof ticks,
  )

  const upstoxUniqueInstruments = upstoxTicks.reduce(
    (acc, tick) => {
      if (!acc.find((t) => t.instrument_token === tick.instrument_token)) {
        acc.push(tick)
      }
      return acc
    },
    [] as typeof upstoxTicks,
  )

  const enabledAlertsCount = Array.from(configurations.values()).filter((c) => c.enabled).length
  const upstoxEnabledAlertsCount = Array.from(upstoxConfigurations.values()).filter((c) => c.enabled).length
  const totalEnabledAlerts = enabledAlertsCount + upstoxEnabledAlertsCount

  return (
    <div className="min-h-screen bg-gray-50 p-6 px-2">
      {/* Fixed Navbar with Blur */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-white/70 backdrop-blur-md border-b border-gray-200/50 shadow-sm">
        <div className="px-4 sm:px-6 py-3">
          <div className="flex items-center justify-between">
            {/* Left side - Logo and Title */}
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded bg-[rgba(243,61,44,1)] flex items-center justify-center">
                <Activity className="w-5 h-5 text-white" />
              </div>
              <div className="hidden sm:block">
                <h1 className="text-xl font-semibold text-gray-900 font-mono">Market Ticks Monitor</h1>
                <p className="text-sm text-gray-500 font-mono">Real-Time Inactivity Alert System</p>
              </div>
              <div className="block sm:hidden">
                <h1 className="text-lg font-semibold text-gray-900">Market Monitor</h1>
              </div>
            </div>

            {/* Desktop Navigation - Hidden on mobile */}
            <div className="hidden lg:flex items-center gap-6">
              {/* Inline Metrics */}
              <div className="flex text-sm flex-row gap-x-4 items-center">
                {/* Instruments */}
                <div className="flex items-center gap-1 bg-sky-50 px-2.5 rounded-md py-0.5">
                  <TrendingUp className="w-4 h-4 text-purple-600" />
                  <span className="text-gray-600 font-mono">Instruments:</span>
                  <span className="font-semibold text-gray-900 font-mono">
                    {uniqueInstruments.length + upstoxUniqueInstruments.length}
                  </span>
                </div>

                {/* Connection */}
                <div className="flex items-center gap-1 bg-green-50 px-2.5 rounded-md py-0.5">
                  <Wifi className="w-4 h-4 text-blue-600" />
                  <span className="text-gray-600 font-mono">Connection:</span>
                  <div className="flex items-center gap-x-1.5">
                    <span className="text-xs text-gray-700 font-mono">Kite:</span>
                    <div className={`w-2 h-2 rounded-full ${isConnected ? "bg-green-500" : "bg-red-500"}`} />
                    <span className="text-xs text-gray-700 font-mono">Upstox:</span>
                    <div className={`w-2 h-2 rounded-full ${upstoxIsConnected ? "bg-green-500" : "bg-red-500"}`} />
                  </div>
                </div>

                {/* Alerts */}
                <div className="flex items-center gap-1 bg-slate-100 px-2.5 rounded-md py-0.5">
                  <Bell className="w-4 h-4 text-green-600" />
                  <span className="text-gray-600 font-mono">Alerts:</span>
                  <span className="font-semibold text-gray-900 font-mono">{totalEnabledAlerts}</span>
                </div>

                {/* Alerting */}
                <div className="flex items-center gap-1 bg-indigo-50 px-2.5 rounded-md py-0.5">
                  <Activity className="w-4 h-4 text-yellow-600" />
                  <span className="text-gray-600 font-mono">Alerting:</span>
                  <span className="font-semibold text-gray-900 font-mono">
                    {inactiveSymbols.size + upstoxInactiveSymbols.size}
                  </span>
                </div>
              </div>

              {/* Time */}
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-gray-500" />
                <span className="text-sm font-mono text-gray-900">
                  {new Date().toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour12: false })}
                </span>
                <div className={`w-2 h-2 rounded-full ${isConnected ? "bg-green-500 animate-pulse" : "bg-gray-400"}`} />
              </div>
            </div>

            {/* Mobile Menu Button */}
            <div className="flex items-center gap-2 lg:hidden">
              {/* Connection Status Indicators for Mobile */}
              <div className="flex items-center gap-1">
                <div className={`w-2 h-2 rounded-full ${isConnected ? "bg-green-500" : "bg-red-500"}`} />
                <div className={`w-2 h-2 rounded-full ${upstoxIsConnected ? "bg-green-500" : "bg-red-500"}`} />
              </div>
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
                aria-expanded="false"
              >
                <span className="sr-only">Open main menu</span>
                {isMobileMenuOpen ? (
                  <X className="block h-6 w-6" aria-hidden="true" />
                ) : (
                  <Menu className="block h-6 w-6" aria-hidden="true" />
                )}
              </button>
            </div>
          </div>

          {/* Mobile Menu Panel */}
          {isMobileMenuOpen && (
            <div className="lg:hidden">
              <div className="px-2 pt-2 pb-3 space-y-1 bg-white/90 backdrop-blur-sm rounded-lg mt-2 border border-gray-200/50 shadow-lg">
                {/* Mobile Metrics */}
                <div className="grid grid-cols-2 gap-2 p-2 text-sm">
                  <div className="flex items-center gap-1 bg-sky-50 px-2 rounded py-1">
                    <TrendingUp className="w-3 h-3 text-purple-600" />
                    <span className="text-xs text-gray-600">Instruments:</span>
                    <span className="font-semibold text-gray-900 text-xs">
                      {uniqueInstruments.length + upstoxUniqueInstruments.length}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 bg-slate-100 px-2 rounded py-1">
                    <Bell className="w-3 h-3 text-green-600" />
                    <span className="text-xs text-gray-600">Alerts:</span>
                    <span className="font-semibold text-gray-900 text-xs">{totalEnabledAlerts}</span>
                  </div>
                  <div className="flex items-center gap-1 bg-indigo-50 px-2 rounded py-1">
                    <Activity className="w-3 h-3 text-yellow-600" />
                    <span className="text-xs text-gray-600">Alerting:</span>
                    <span className="font-semibold text-gray-900 text-xs">
                      {inactiveSymbols.size + upstoxInactiveSymbols.size}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 bg-green-50 px-2 rounded py-1">
                    <Clock className="w-3 h-3 text-gray-500" />
                    <span className="text-xs font-mono text-gray-900">
                      {new Date().toLocaleTimeString("en-IN", {
                        timeZone: "Asia/Kolkata",
                        hour12: false,
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                </div>

                {/* Connection Status */}
                <div className="px-2 py-2 border-t border-gray-200">
                  <div className="text-xs font-medium text-gray-700 mb-1">Connection Status</div>
                  <div className="flex justify-between text-xs">
                    <div className="flex items-center gap-1">
                      <span>Kite:</span>
                      <div className={`w-2 h-2 rounded-full ${isConnected ? "bg-green-500" : "bg-red-500"}`} />
                      <span className={isConnected ? "text-green-600" : "text-red-600"}>
                        {isConnected ? "Connected" : "Disconnected"}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span>Upstox:</span>
                      <div className={`w-2 h-2 rounded-full ${upstoxIsConnected ? "bg-green-500" : "bg-red-500"}`} />
                      <span className={upstoxIsConnected ? "text-green-600" : "text-red-600"}>
                        {upstoxIsConnected ? "Connected" : "Disconnected"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Dashboard */}
      <div className="space-y-6 pt-10">
        {/* Dashboard Title and Time */}
        <div className="flex items-center justify-between">
          <div></div>
        </div>

        {/* Connection Status Debug */}
        {(!isConnected || !upstoxIsConnected) && (
          <Card className="bg-yellow-50 border-yellow-200">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Wifi className="w-5 h-5 text-yellow-600" />
                <h3 className="font-medium text-yellow-800">Connection Status</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="font-medium">Kite Feed:</p>
                  <p className={`${isConnected ? "text-green-600" : "text-red-600"}`}>
                    {isConnected ? "✅" : "❌"} {isConnected ? "Connected" : "Disconnected"} ({connectionStatus})
                  </p>
                  <p className="text-gray-600">Endpoint: https://ticks.rvinod.com/ticks</p>
                </div>
                <div>
                  <p className="font-medium">Upstox Feed:</p>
                  <p className={`${upstoxIsConnected ? "text-green-600" : "text-red-600"}`}>
                    {upstoxIsConnected ? "✅" : "❌"} {upstoxIsConnected ? "Connected" : "Disconnected"} (
                    {upstoxConnectionStatus})
                  </p>
                  <p className="text-gray-600">Endpoint: https://ticks.rvinod.com/upstox</p>
                  {upstoxSystemAlerts.length > 0 && (
                    <p className="text-xs text-red-600 mt-1">Latest: {upstoxSystemAlerts[0]?.message}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tabs */}
        <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-4">
          <TabsList className="bg-white border">
            <TabsTrigger value="kite" className="flex items-center gap-2">
              <ActivityIcon className="w-4 h-4" />
              Kite
              {uniqueInstruments.length > 0 && (
                <span className="ml-2 flex items-center justify-center rounded-full text-xs font-medium w-5 h-5 bg-emerald-100 text-green-700">
                  {uniqueInstruments.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="upstox" className="flex items-center gap-2">
              <Activity className="w-4 h-4" />
              Upstox
              {upstoxUniqueInstruments.length > 0 && (
                <span className="ml-2 flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-xs font-medium text-blue-600">
                  {upstoxUniqueInstruments.length}
                </span>
              )}
              {!upstoxIsConnected && (
                <span className="ml-2 flex h-5 w-5 items-center justify-center rounded-full bg-red-100 text-xs font-medium text-red-600">
                  !
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="compare" className="flex items-center gap-2">
              <GitCompare className="w-4 h-4" />
              Compare
              <span className="ml-2 flex h-5 w-5 items-center justify-center rounded-full bg-purple-100 text-xs font-medium text-purple-600">
                6
              </span>
            </TabsTrigger>
            <TabsTrigger value="alert-settings" className="flex items-center gap-2">
              <Sliders className="w-4 h-4" />
              Alert Settings
              {enabledAlertsCount > 0 && (
                <span className="ml-2 flex h-5 w-5 items-center justify-center rounded-full bg-green-100 text-xs font-medium text-green-600">
                  {enabledAlertsCount}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="inactivity-log" className="flex items-center gap-2">
              <History className="w-4 h-4" />
              Alert Log
              {inactivityAlerts.length > 0 && (
                <span className="ml-2 flex h-5 w-5 items-center justify-center rounded-full bg-red-100 text-xs font-medium text-red-600">
                  {inactivityAlerts.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="debug" className="flex items-center gap-2">
              <Settings className="w-4 h-4" />
              Debug
            </TabsTrigger>
          </TabsList>

          <TabsContent value="kite">
            <MarketDataGrid
              ticks={ticks}
              inactiveSymbols={inactiveSymbols}
              alertConfigurations={configurations}
              onConfigurationChange={updateConfiguration}
            />
          </TabsContent>

          <TabsContent value="upstox">
            <UpstoxMarketDataGrid
              ticks={upstoxTicks}
              inactiveSymbols={new Set(Array.from(upstoxInactiveSymbols).map(String))} // Convert to string set
              alertConfigurations={new Map(Array.from(upstoxConfigurations.entries()).map(([k, v]) => [String(k), v]))} // Convert to string keys
              onConfigurationChange={(token, config) =>
                upstoxUpdateConfiguration(Number.parseInt(token.replace(/[^0-9]/g, "")) || 0, config)
              } // Convert back to number
            />
          </TabsContent>

          <TabsContent value="compare">
            <ComparisonView
              kiteTicks={ticks}
              upstoxTicks={upstoxTicks}
              kiteConnected={isConnected}
              upstoxConnected={upstoxIsConnected}
            />
          </TabsContent>

          {/* NSE / MCX alert settings */}
          <TabsContent value="alert-settings">
            <AlertSettingsTab
              ticks={ticks}
              alertConfigurations={configurations}
              onConfigurationChange={updateConfiguration}
              inactiveSymbols={inactiveSymbols}
            />
          </TabsContent>

          {/* Alert Log for BOTH feeds (merge arrays) */}
          <TabsContent value="inactivity-log">
            <InactivityAlertsLog
              alerts={[...inactivityAlerts, ...upstoxInactivityAlerts]}
              onClearAlerts={() => {
                clearAllAlerts()
                upstoxClearAllAlerts()
              }}
            />
          </TabsContent>

          <TabsContent value="debug">
            <DebugDashboard
              ticks={ticks}
              isConnected={isConnected}
              isFrozen={isFrozen}
              lastTickTime={lastTickTime}
              averageDelay={averageDelay}
              totalTicks={totalTicks}
              freezingIncidents={freezingIncidents}
              alerts={systemAlerts}
              connectionStatus={connectionStatus}
              clearAlerts={clearAlerts}
              rawMessages={rawMessages}
              debugInfo={debugInfo}
              addTestTick={addTestTick}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

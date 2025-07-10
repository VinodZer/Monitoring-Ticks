"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { BarChart3 } from "lucide-react"

export function PerformanceMetrics() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          Performance Metrics
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Avg Latency</span>
            <span className="text-sm font-medium">125ms</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Throughput</span>
            <span className="text-sm font-medium">1.2k/sec</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Uptime</span>
            <span className="text-sm font-medium">99.9%</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

"use client"

import { useEffect, useRef, useState } from "react"

/* ───────────────────────── Types ───────────────────────── */

export interface UpstoxTickData {
  id: string
  instrument_token: string
  last_price: number
  last_quantity: number
  average_price: number
  volume: number
  timestamp: number
  receivedAt: number
  delay: number
}

export interface UpstoxAlert {
  id: string
  type: "connection" | "data" | "freeze"
  message: string
  severity: "low" | "medium" | "high"
  timestamp: number
}

/* ─────────────────────── Constants ─────────────────────── */

const FEED_URL = "https://ticks.rvinod.com/upstox"
const MAX_TICKS = 1_000
const MAX_ALERTS = 50
const FREEZE_TIMEOUT = 30_000 // 30 s of silence ⇒ freeze

/* ───────────────────────── Hook ────────────────────────── */

export function useUpstoxTickData() {
  /* ---------- state ---------- */
  const [ticks, setTicks] = useState<UpstoxTickData[]>([])
  const [alerts, setAlerts] = useState<UpstoxAlert[]>([])
  const [connectionStatus, setConnectionStatus] = useState<"disconnected" | "connecting" | "connected" | "error">(
    "disconnected",
  )
  const [isFrozen, setIsFrozen] = useState(false)

  /* ---------- refs ---------- */
  const esRef = useRef<EventSource | null>(null)
  const freezeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const reconnectAttempts = useRef(0)
  const lastTickForInstrument = useRef<Map<string, number>>(new Map())

  /* batching refs */
  const pendingTicks = useRef<UpstoxTickData[]>([])
  const rafId = useRef<number | null>(null)

  /* ---------- helpers ---------- */
  const addAlert = (type: UpstoxAlert["type"], message: string, severity: UpstoxAlert["severity"] = "medium") =>
    setAlerts((prev) => [
      {
        id: crypto.randomUUID(),
        type,
        message,
        severity,
        timestamp: Date.now(),
      },
      ...prev.slice(0, MAX_ALERTS - 1),
    ])

  const scheduleFreezeCheck = () => {
    if (freezeTimer.current) clearTimeout(freezeTimer.current)
    freezeTimer.current = setTimeout(() => {
      setIsFrozen(true)
      addAlert("freeze", "No Upstox data for 30 s", "high")
    }, FREEZE_TIMEOUT)
  }

  const flushPendingTicks = () => {
    rafId.current = null
    if (!pendingTicks.current.length) return
    setTicks((prev) => {
      const combined = [...pendingTicks.current, ...prev]
      pendingTicks.current = []
      return combined.slice(0, MAX_TICKS)
    })
  }

  /* ---------- EventSource ---------- */
  const initEventSource = () => {
    if (esRef.current) esRef.current.close()

    setConnectionStatus("connecting")
    const es = new EventSource(FEED_URL)
    esRef.current = es

    es.onopen = () => {
      setConnectionStatus("connected")
      addAlert("connection", "Upstox connected", "low")
      reconnectAttempts.current = 0
      scheduleFreezeCheck()
    }

    es.onmessage = (e) => {
      if (isFrozen) setIsFrozen(false)
      scheduleFreezeCheck()

      try {
        const payload = JSON.parse(e.data)
        if (payload?.type !== "live_feed" || !payload.feeds) return

        const now = Date.now()
        const newTicks: UpstoxTickData[] = []

        for (const [token, item] of Object.entries<any>(payload.feeds)) {
          const ltpc = item?.ff?.marketFF?.ltpc
          if (!ltpc?.ltp) continue

          const ts = Number(ltpc.ltt ?? now)
          const prev = lastTickForInstrument.current.get(token)
          const delay = prev ? ts - prev : 0
          lastTickForInstrument.current.set(token, ts)

          newTicks.push({
            id: `${token}-${ts}`,
            instrument_token: token,
            last_price: Number(ltpc.ltp),
            last_quantity: Number(ltpc.ltq ?? 0),
            average_price: Number(ltpc.cp ?? ltpc.ltp),
            volume: item?.ff?.marketFF?.marketOHLC?.ohlc?.at(-1)?.volume ?? Number(item.volume ?? 0),
            timestamp: ts,
            receivedAt: now,
            delay,
          })
        }

        if (newTicks.length) {
          pendingTicks.current.unshift(...newTicks)
          if (rafId.current === null) rafId.current = requestAnimationFrame(flushPendingTicks)
        }
      } catch (err) {
        console.error("Upstox parse error:", err)
        addAlert("data", `Parse error: ${err}`, "medium")
      }
    }

    es.onerror = (err) => {
      console.error("Upstox EventSource error:", err)
      setConnectionStatus("error")
      addAlert("connection", "Upstox connection error", "medium")

      if (es.readyState === EventSource.CLOSED) attemptReconnect()
    }
  }

  const attemptReconnect = () => {
    reconnectAttempts.current += 1
    const timeout = Math.min(1000 * 2 ** reconnectAttempts.current, 30_000)
    setTimeout(initEventSource, timeout)
  }

  /* ---------- mount / unmount ---------- */
  useEffect(() => {
    initEventSource()
    return () => {
      if (esRef.current) esRef.current.close()
      if (freezeTimer.current) clearTimeout(freezeTimer.current)
      if (rafId.current !== null) cancelAnimationFrame(rafId.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* ---------- derived ---------- */
  const averageDelay = ticks.length ? ticks.reduce((s, t) => s + t.delay, 0) / ticks.length : 0

  /* ---------- public API ---------- */
  return {
    /* data */
    ticks,
    averageDelay,
    totalTicks: ticks.length,
    lastTickTime: ticks.length ? Math.max(...ticks.map((t) => t.timestamp)) : null,

    /* connection */
    isConnected: connectionStatus === "connected",
    connectionStatus,
    isFrozen,
    freezingIncidents: alerts.filter((a) => a.type === "freeze").length,

    /* alerts */
    alerts,
    clearAlerts: () => setAlerts([]),

    /* debug */
    rawMessages: [],
    debugInfo: {
      connectionStatus,
      ticksCount: ticks.length,
      averageDelay,
      lastUpdate: new Date().toISOString(),
    },

    /* utilities */
    addTestTick: () => {
      const now = Date.now()
      const testTick: UpstoxTickData = {
        id: `DEV-${now}`,
        instrument_token: "DEV_TOKEN",
        last_price: 500 + Math.random() * 200,
        last_quantity: Math.floor(Math.random() * 100),
        average_price: 500,
        volume: Math.floor(Math.random() * 10_000),
        timestamp: now,
        receivedAt: now,
        delay: 0,
      }
      setTicks((prev) => [testTick, ...prev.slice(0, MAX_TICKS - 1)])
      addAlert("data", "Test tick injected", "low")
    },
  }
}

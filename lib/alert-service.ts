import { supabase } from "./supabase"

export interface UserAlertConfig {
  id?: string
  user_id: string
  instrument_token: number
  instrument_name: string
  exchange: string
  enabled: boolean
  deviation: number
  duration: number
  respect_market_hours: boolean
  notification_sound: boolean
  notification_browser: boolean
  notification_email: boolean
  created_at?: string
  updated_at?: string
}

export interface UserAlertLog {
  id?: string
  user_id: string
  instrument_token: number
  instrument_name: string
  exchange: string
  alert_type: string
  alert_data: Record<string, any>
  baseline_price?: number
  current_price?: number
  price_range?: { min: number; max: number }
  deviation?: number
  duration?: number
  market_session?: string
  market_type?: string
  acknowledged: boolean
  acknowledged_at?: string
  created_at?: string
}

export interface UserAlertPreferences {
  id?: string
  user_id: string
  global_sound_enabled: boolean
  global_browser_notifications: boolean
  global_email_notifications: boolean
  sound_volume: number
  alert_frequency_limit: number
  auto_acknowledge_after: number
  dashboard_alert_display: boolean
  alert_history_retention_days: number
  created_at?: string
  updated_at?: string
}

export class AlertService {
  // Alert Configurations
  static async getUserAlertConfigs(userId: string): Promise<UserAlertConfig[]> {
    const { data, error } = await supabase
      .from("user_alert_configs")
      .select("*")
      .eq("user_id", userId)
      .order("instrument_name")

    if (error) {
      console.error("Error fetching user alert configs:", error)
      return []
    }

    return data || []
  }

  static async saveAlertConfig(config: Omit<UserAlertConfig, "id" | "created_at" | "updated_at">): Promise<boolean> {
    const { error } = await supabase.from("user_alert_configs").upsert(config, {
      onConflict: "user_id,instrument_token",
    })

    if (error) {
      console.error("Error saving alert config:", error)
      return false
    }

    return true
  }

  static async deleteAlertConfig(userId: string, instrumentToken: number): Promise<boolean> {
    const { error } = await supabase
      .from("user_alert_configs")
      .delete()
      .eq("user_id", userId)
      .eq("instrument_token", instrumentToken)

    if (error) {
      console.error("Error deleting alert config:", error)
      return false
    }

    return true
  }

  // Alert Logs
  static async logAlert(log: Omit<UserAlertLog, "id" | "created_at">): Promise<boolean> {
    const { error } = await supabase.from("user_alert_logs").insert(log)

    if (error) {
      console.error("Error logging alert:", error)
      return false
    }

    return true
  }

  static async getUserAlertLogs(
    userId: string,
    options: {
      limit?: number
      offset?: number
      instrumentToken?: number
      alertType?: string
      startDate?: string
      endDate?: string
      acknowledged?: boolean
    } = {},
  ): Promise<{ logs: UserAlertLog[]; total: number }> {
    let query = supabase.from("user_alert_logs").select("*", { count: "exact" }).eq("user_id", userId)

    if (options.instrumentToken) {
      query = query.eq("instrument_token", options.instrumentToken)
    }

    if (options.alertType) {
      query = query.eq("alert_type", options.alertType)
    }

    if (options.startDate) {
      query = query.gte("created_at", options.startDate)
    }

    if (options.endDate) {
      query = query.lte("created_at", options.endDate)
    }

    if (options.acknowledged !== undefined) {
      query = query.eq("acknowledged", options.acknowledged)
    }

    query = query
      .order("created_at", { ascending: false })
      .range(options.offset || 0, (options.offset || 0) + (options.limit || 50) - 1)

    const { data, error, count } = await query

    if (error) {
      console.error("Error fetching alert logs:", error)
      return { logs: [], total: 0 }
    }

    return { logs: data || [], total: count || 0 }
  }

  static async acknowledgeAlert(userId: string, alertId: string): Promise<boolean> {
    const { error } = await supabase
      .from("user_alert_logs")
      .update({
        acknowledged: true,
        acknowledged_at: new Date().toISOString(),
      })
      .eq("id", alertId)
      .eq("user_id", userId)

    if (error) {
      console.error("Error acknowledging alert:", error)
      return false
    }

    return true
  }

  static async acknowledgeAllAlerts(userId: string): Promise<boolean> {
    const { error } = await supabase
      .from("user_alert_logs")
      .update({
        acknowledged: true,
        acknowledged_at: new Date().toISOString(),
      })
      .eq("user_id", userId)
      .eq("acknowledged", false)

    if (error) {
      console.error("Error acknowledging all alerts:", error)
      return false
    }

    return true
  }

  // Alert Preferences
  static async getUserAlertPreferences(userId: string): Promise<UserAlertPreferences | null> {
    const { data, error } = await supabase.from("user_alert_preferences").select("*").eq("user_id", userId).single()

    if (error) {
      if (error.code === "PGRST116") {
        // No preferences found, create default
        const defaultPrefs: Omit<UserAlertPreferences, "id" | "created_at" | "updated_at"> = {
          user_id: userId,
          global_sound_enabled: true,
          global_browser_notifications: true,
          global_email_notifications: false,
          sound_volume: 0.5,
          alert_frequency_limit: 5,
          auto_acknowledge_after: 300,
          dashboard_alert_display: true,
          alert_history_retention_days: 30,
        }

        const { data: newData, error: insertError } = await supabase
          .from("user_alert_preferences")
          .insert(defaultPrefs)
          .select()
          .single()

        if (insertError) {
          console.error("Error creating default preferences:", insertError)
          return null
        }

        return newData
      }

      console.error("Error fetching user preferences:", error)
      return null
    }

    return data
  }

  static async saveUserAlertPreferences(preferences: Partial<UserAlertPreferences>): Promise<boolean> {
    const { error } = await supabase.from("user_alert_preferences").upsert(preferences, {
      onConflict: "user_id",
    })

    if (error) {
      console.error("Error saving user preferences:", error)
      return false
    }

    return true
  }

  // Statistics
  static async getAlertStatistics(userId: string): Promise<{
    totalAlerts: number
    unacknowledgedAlerts: number
    alertsToday: number
    alertsThisWeek: number
    topAlertingInstruments: Array<{ instrument_name: string; count: number }>
  }> {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const weekAgo = new Date(today)
    weekAgo.setDate(weekAgo.getDate() - 7)

    // Get total and unacknowledged counts
    const { count: totalAlerts } = await supabase
      .from("user_alert_logs")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)

    const { count: unacknowledgedAlerts } = await supabase
      .from("user_alert_logs")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("acknowledged", false)

    const { count: alertsToday } = await supabase
      .from("user_alert_logs")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", today.toISOString())

    const { count: alertsThisWeek } = await supabase
      .from("user_alert_logs")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", weekAgo.toISOString())

    // Get top alerting instruments
    const { data: topInstruments } = await supabase
      .from("user_alert_logs")
      .select("instrument_name")
      .eq("user_id", userId)
      .gte("created_at", weekAgo.toISOString())

    const instrumentCounts = (topInstruments || []).reduce(
      (acc, log) => {
        acc[log.instrument_name] = (acc[log.instrument_name] || 0) + 1
        return acc
      },
      {} as Record<string, number>,
    )

    const topAlertingInstruments = Object.entries(instrumentCounts)
      .map(([instrument_name, count]) => ({ instrument_name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)

    return {
      totalAlerts: totalAlerts || 0,
      unacknowledgedAlerts: unacknowledgedAlerts || 0,
      alertsToday: alertsToday || 0,
      alertsThisWeek: alertsThisWeek || 0,
      topAlertingInstruments,
    }
  }
}

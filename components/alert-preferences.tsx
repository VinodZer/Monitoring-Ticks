"use client"

import { useState, useEffect } from "react"
import { Bell, Volume2, Save, Clock, Mail, Monitor } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import { Separator } from "@/components/ui/separator"
import { Input } from "@/components/ui/input"
import { useAuth } from "@/contexts/auth-context"
import { useToast } from "@/hooks/use-toast"

interface AlertPreferences {
  global_sound_enabled: boolean
  global_browser_notifications: boolean
  global_email_notifications: boolean
  dashboard_alert_display: boolean
  sound_volume: number
  notification_frequency: number
  quiet_hours_start: string
  quiet_hours_end: string
}

interface AlertPreferencesProps {
  className?: string
}

export function AlertPreferences({ className }: AlertPreferencesProps) {
  const { user } = useAuth()
  const { toast } = useToast()
  const [preferences, setPreferences] = useState<AlertPreferences>({
    global_sound_enabled: true,
    global_browser_notifications: true,
    global_email_notifications: false,
    dashboard_alert_display: true,
    sound_volume: 0.7,
    notification_frequency: 5,
    quiet_hours_start: "22:00",
    quiet_hours_end: "08:00",
  })
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)

  useEffect(() => {
    if (user) {
      loadPreferences()
    }
  }, [user])

  const loadPreferences = async () => {
    setLoading(true)
    try {
      // Simulate loading preferences from API
      await new Promise((resolve) => setTimeout(resolve, 1000))
      // In a real app, you would load from your backend
      setLoading(false)
    } catch (error) {
      console.error("Error loading preferences:", error)
      toast({
        title: "Error",
        description: "Failed to load alert preferences",
        variant: "destructive",
      })
      setLoading(false)
    }
  }

  const updatePreference = <K extends keyof AlertPreferences>(key: K, value: AlertPreferences[K]) => {
    setPreferences((prev) => ({
      ...prev,
      [key]: value,
    }))
    setHasChanges(true)
  }

  const savePreferences = async () => {
    setSaving(true)
    try {
      // Simulate saving preferences to API
      await new Promise((resolve) => setTimeout(resolve, 1000))
      setHasChanges(false)
      toast({
        title: "Preferences saved",
        description: "Your alert preferences have been updated successfully.",
      })
    } catch (error) {
      console.error("Error saving preferences:", error)
      toast({
        title: "Error",
        description: "Failed to save preferences",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const testNotification = () => {
    if (preferences.global_browser_notifications) {
      if (Notification.permission === "granted") {
        new Notification("Test Alert", {
          body: "This is a test notification from your trading dashboard",
          icon: "/placeholder-logo.png",
        })
      } else if (Notification.permission !== "denied") {
        Notification.requestPermission().then((permission) => {
          if (permission === "granted") {
            new Notification("Test Alert", {
              body: "This is a test notification from your trading dashboard",
              icon: "/placeholder-logo.png",
            })
          }
        })
      }
    }

    if (preferences.global_sound_enabled) {
      // Play test sound
      const audio = new Audio(
        "data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIG2m98OScTgwOUarm7blmGgU7k9n1unEiBC13yO/eizEIHWq+8+OWT",
      )
      audio.volume = preferences.sound_volume
      audio.play().catch(() => {
        // Ignore audio play errors
      })
    }

    toast({
      title: "Test notification sent",
      description: "Check your browser and listen for the sound alert",
    })
  }

  if (!user) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Please sign in to manage alert preferences</p>
        </CardContent>
      </Card>
    )
  }

  if (loading) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading preferences...</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className={`space-y-6 ${className}`}>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Bell className="w-5 h-5" />
                Alert Preferences
              </CardTitle>
              <CardDescription>Configure your global alert settings and notifications</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={testNotification}>
                Test Notification
              </Button>
              {hasChanges && (
                <Button onClick={savePreferences} disabled={saving}>
                  <Save className="w-4 h-4 mr-2" />
                  {saving ? "Saving..." : "Save Changes"}
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Notification Settings */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Monitor className="w-5 h-5" />
              Notification Channels
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <Label className="text-base font-medium">Sound Notifications</Label>
                    <p className="text-sm text-muted-foreground">Play sound when alerts are triggered</p>
                  </div>
                  <Switch
                    checked={preferences.global_sound_enabled}
                    onCheckedChange={(checked) => updatePreference("global_sound_enabled", checked)}
                  />
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <Label className="text-base font-medium">Browser Notifications</Label>
                    <p className="text-sm text-muted-foreground">Show desktop notifications</p>
                  </div>
                  <Switch
                    checked={preferences.global_browser_notifications}
                    onCheckedChange={(checked) => updatePreference("global_browser_notifications", checked)}
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <Label className="text-base font-medium">Email Notifications</Label>
                    <p className="text-sm text-muted-foreground">Send alerts via email</p>
                  </div>
                  <Switch
                    checked={preferences.global_email_notifications}
                    onCheckedChange={(checked) => updatePreference("global_email_notifications", checked)}
                  />
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <Label className="text-base font-medium">Dashboard Display</Label>
                    <p className="text-sm text-muted-foreground">Show alerts on dashboard</p>
                  </div>
                  <Switch
                    checked={preferences.dashboard_alert_display}
                    onCheckedChange={(checked) => updatePreference("dashboard_alert_display", checked)}
                  />
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* Sound Settings */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Volume2 className="w-5 h-5" />
              Sound Settings
            </h3>

            <div className="space-y-4">
              <div className="p-4 border rounded-lg">
                <Label className="text-base font-medium">
                  Sound Volume: {Math.round(preferences.sound_volume * 100)}%
                </Label>
                <p className="text-sm text-muted-foreground mb-3">Adjust the volume of alert sounds</p>
                <Slider
                  value={[preferences.sound_volume]}
                  onValueChange={([value]) => updatePreference("sound_volume", value)}
                  min={0}
                  max={1}
                  step={0.1}
                  disabled={!preferences.global_sound_enabled}
                  className="w-full max-w-md"
                />
              </div>

              <div className="p-4 border rounded-lg">
                <Label className="text-base font-medium">
                  Notification Frequency: {preferences.notification_frequency} minutes
                </Label>
                <p className="text-sm text-muted-foreground mb-3">Minimum time between repeated alerts</p>
                <Slider
                  value={[preferences.notification_frequency]}
                  onValueChange={([value]) => updatePreference("notification_frequency", value)}
                  min={1}
                  max={60}
                  step={1}
                  className="w-full max-w-md"
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Quiet Hours */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Quiet Hours
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 border rounded-lg">
                <Label htmlFor="quiet-start" className="text-base font-medium">
                  Start Time
                </Label>
                <p className="text-sm text-muted-foreground mb-2">When to start quiet hours</p>
                <Input
                  id="quiet-start"
                  type="time"
                  value={preferences.quiet_hours_start}
                  onChange={(e) => updatePreference("quiet_hours_start", e.target.value)}
                />
              </div>

              <div className="p-4 border rounded-lg">
                <Label htmlFor="quiet-end" className="text-base font-medium">
                  End Time
                </Label>
                <p className="text-sm text-muted-foreground mb-2">When to end quiet hours</p>
                <Input
                  id="quiet-end"
                  type="time"
                  value={preferences.quiet_hours_end}
                  onChange={(e) => updatePreference("quiet_hours_end", e.target.value)}
                />
              </div>
            </div>

            <div className="p-4 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground">
                During quiet hours ({preferences.quiet_hours_start} - {preferences.quiet_hours_end}), sound and browser
                notifications will be disabled. Email notifications will still be sent.
              </p>
            </div>
          </div>

          <Separator />

          {/* Email Settings */}
          {preferences.global_email_notifications && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Mail className="w-5 h-5" />
                Email Settings
              </h3>

              <div className="p-4 border rounded-lg">
                <Label className="text-base font-medium">Email Address</Label>
                <p className="text-sm text-muted-foreground mb-2">Alerts will be sent to: {user.email}</p>
                <p className="text-xs text-muted-foreground">
                  To change your email address, please update your profile settings.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

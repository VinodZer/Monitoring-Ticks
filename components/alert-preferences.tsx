"use client"

import { useState, useEffect } from "react"
import { Bell, Volume2, Save } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import { Separator } from "@/components/ui/separator"
import { AlertService, type UserAlertPreferences } from "@/lib/alert-service"
import { useAuth } from "@/contexts/auth-context"
import { useToast } from "@/hooks/use-toast"

interface AlertPreferencesProps {
  className?: string
}

export function AlertPreferences({ className }: AlertPreferencesProps) {
  const { user } = useAuth()
  const { toast } = useToast()
  const [preferences, setPreferences] = useState<UserAlertPreferences | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)

  useEffect(() => {
    if (user) {
      loadPreferences()
    }
  }, [user])

  const loadPreferences = async () => {
    if (!user) return

    setLoading(true)
    try {
      const prefs = await AlertService.getUserAlertPreferences(user.id)
      setPreferences(prefs)
    } catch (error) {
      console.error("Error loading preferences:", error)
      toast({
        title: "Error",
        description: "Failed to load alert preferences",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const updatePreference = <K extends keyof UserAlertPreferences>(
    key: K,
    value: UserAlertPreferences[K]
  ) => {
    if (!preferences) return

    setPreferences((prev) => ({
      ...prev!,
      [key]: value,
    }))
    setHasChanges(true)
  }

  const savePreferences = async () => {
    if (!user || !preferences) return

    setSaving(true)
    try {
      const success = await AlertService.saveUserAlertPreferences(preferences)
      if (success) {
        setHasChanges(false)
        toast({
          title: "Preferences saved",
          description: "Your alert preferences have been updated successfully.",
        })
      } else {
        toast({
          title: "Error",
          description: "Failed to save preferences",
          variant: "destructive",
        })
      }
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

  if (!user) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Please sign in to manage alert preferences</p>
        </CardContent>
      </Card>
    )
  }

  if (loading || !preferences) {
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
              <CardTitle>Alert Preferences</CardTitle>
              <CardDescription>Configure your global alert settings and notifications</CardDescription>
            </div>
            {hasChanges && (
              <Button onClick={savePreferences} disabled={saving}>
                <Save className="w-4 h-4 mr-2" />
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Notification Settings */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Bell className="w-5 h-5" />
              <h3 className="text-lg font-semibold">Notification Settings</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-base font-medium">Sound Notifications</Label>
                    <p className="text-sm text-muted-foreground">Play sound when alerts are triggered</p>
                  </div>
                  <Switch
                    checked={preferences.global_sound_enabled}
                    onCheckedChange={(checked) => updatePreference("global_sound_enabled", checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-base font-medium">Browser Notifications</Label>
                    <p className="text-sm text-muted-foreground">Show desktop notifications</p>
                  </div>
                  <Switch
                    checked={preferences.global_browser_notifications}
                    onCheckedChange={(checked) => updatePreference("global_browser_notifications", checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-base font-medium">Email Notifications</Label>
                    <p className="text-sm text-muted-foreground">Send alerts via email</p>
                  </div>
                  <Switch
                    checked={preferences.global_email_notifications}
                    onCheckedChange={(checked) => updatePreference("global_email_notifications", checked)}
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
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
            <div className="flex items-center gap-2">
              <Volume2 className="w-5 h-5" />
              <h3 className="text-lg font-semibold">Sound Settings</h3>
            </div>
            
            <div className="space-y-4">
              <div>
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
            </div>
          </div>

          <Separator />\

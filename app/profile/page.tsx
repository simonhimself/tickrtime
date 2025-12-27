"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import type { User } from "@/types";
import { getMe, getAlertPreferences, updateAlertPreferences } from "@/lib/api-client";

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [displayName, setDisplayName] = useState("");
  const [defaultPeriod, setDefaultPeriod] = useState("today");
  const [timezone, setTimezone] = useState("America/New_York");
  const [showEstimates, setShowEstimates] = useState(true);
  const [showSurprises, setShowSurprises] = useState(true);
  const [showExchange, setShowExchange] = useState(true);
  
  // Notification preferences
  const [defaultDaysBefore, setDefaultDaysBefore] = useState(2);
  const [defaultDaysAfter, setDefaultDaysAfter] = useState(1);
  const [loadingPreferences, setLoadingPreferences] = useState(false);

  // Password change state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Load user data and preferences
  useEffect(() => {
    const loadUserData = async () => {
      const token = localStorage.getItem("tickrtime-auth-token");
      if (!token) {
        router.push("/");
        return;
      }

      try {
        // Call API endpoint to verify token
        const data = await getMe();
        if (data.user) {
          setUser({
            id: data.user.id,
            email: data.user.email,
            emailVerified: data.user.emailVerified,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        } else {
          localStorage.removeItem("tickrtime-auth-token");
          router.push("/");
          return;
        }

        // Load saved preferences from localStorage
        const savedPrefs = localStorage.getItem("tickrtime-preferences");
        if (savedPrefs) {
          const prefs = JSON.parse(savedPrefs);
          setDisplayName(prefs.displayName || "");
          setDefaultPeriod(prefs.defaultPeriod || "today");
          setTimezone(prefs.timezone || "America/New_York");
          setShowEstimates(prefs.showEstimates !== false);
          setShowSurprises(prefs.showSurprises !== false);
          setShowExchange(prefs.showExchange !== false);
        }

        // Load notification preferences from API
        try {
          const prefsData = await getAlertPreferences();
          if (prefsData.success && prefsData.preferences) {
            setDefaultDaysBefore(prefsData.preferences.defaultDaysBefore ?? 2);
            setDefaultDaysAfter(prefsData.preferences.defaultDaysAfter ?? 1);
          }
        } catch (error) {
          console.error("Error loading notification preferences:", error);
        }
      } catch {
        router.push("/");
      } finally {
        setIsLoading(false);
      }
    };

    loadUserData();
  }, [router]);

  const handleSavePreferences = async () => {
    setIsSaving(true);
    
    try {
      // Save preferences to localStorage
      const preferences = {
        displayName,
        defaultPeriod,
        timezone,
        showEstimates,
        showSurprises,
        showExchange,
      };
      
      localStorage.setItem("tickrtime-preferences", JSON.stringify(preferences));
      
      toast.success("Preferences saved successfully");
    } catch {
      toast.error("Failed to save preferences");
    } finally {
      setIsSaving(false);
    }
  };

  const handlePasswordChange = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error("Please fill in all password fields");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }

    if (newPassword.length < 8) {
      toast.error("Password must be at least 8 characters long");
      return;
    }

    // In a real app, this would call an API endpoint
    toast.info("Password change functionality coming soon");
    
    // Clear password fields
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  };

  const handleDeleteAccount = async () => {
    // In a real app, this would call an API endpoint
    toast.info("Account deletion functionality coming soon");
  };

  const handleSaveNotificationPreferences = async () => {
    setLoadingPreferences(true);
    
    try {
      const token = localStorage.getItem("tickrtime-auth-token");
      if (!token) {
        toast.error("Please log in");
        return;
      }

      const data = await updateAlertPreferences({
        defaultDaysBefore,
        defaultDaysAfter,
      });
      if (data.success) {
        toast.success("Notification preferences saved successfully");
      } else {
        toast.error(data.message || "Failed to save preferences");
      }
    } catch (error) {
      console.error("Error saving notification preferences:", error);
      toast.error("Failed to save notification preferences");
    } finally {
      setLoadingPreferences(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/")}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Button>
        </div>

        <h1 className="text-3xl font-bold mb-8">Profile Settings</h1>

        {/* Account Information */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Account Information</CardTitle>
            <CardDescription>
              Manage your account details and authentication
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input 
                id="email" 
                type="email" 
                value={user.email} 
                disabled 
                className="bg-muted"
              />
              <p className="text-xs text-muted-foreground">
                Email cannot be changed at this time
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="displayName">Display Name</Label>
              <Input
                id="displayName"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Enter your display name"
              />
            </div>

            <Separator />

            <div className="space-y-4">
              <h3 className="text-sm font-medium">Change Password</h3>
              <div className="space-y-2">
                <Label htmlFor="currentPassword">Current Password</Label>
                <Input
                  id="currentPassword"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="newPassword">New Password</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm Password</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </div>
              </div>
              <Button 
                onClick={handlePasswordChange}
                variant="outline"
                className="w-full sm:w-auto"
              >
                Update Password
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Preferences */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Preferences</CardTitle>
            <CardDescription>
              Customize how TickrTime works for you
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="defaultPeriod">Default Time Period</Label>
              <Select value={defaultPeriod} onValueChange={setDefaultPeriod}>
                <SelectTrigger id="defaultPeriod">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="tomorrow">Tomorrow</SelectItem>
                  <SelectItem value="next30">Next 30 Days</SelectItem>
                  <SelectItem value="previous30">Previous 30 Days</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                The default view when you open TickrTime
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="timezone">Timezone</Label>
              <Select value={timezone} onValueChange={setTimezone}>
                <SelectTrigger id="timezone">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="America/New_York">Eastern Time (ET)</SelectItem>
                  <SelectItem value="America/Chicago">Central Time (CT)</SelectItem>
                  <SelectItem value="America/Denver">Mountain Time (MT)</SelectItem>
                  <SelectItem value="America/Los_Angeles">Pacific Time (PT)</SelectItem>
                  <SelectItem value="Europe/London">London (GMT)</SelectItem>
                  <SelectItem value="Europe/Paris">Paris (CET)</SelectItem>
                  <SelectItem value="Asia/Tokyo">Tokyo (JST)</SelectItem>
                  <SelectItem value="Asia/Hong_Kong">Hong Kong (HKT)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Display earnings times in this timezone
              </p>
            </div>

            <Separator />

            <div className="space-y-4">
              <h3 className="text-sm font-medium">Data Display</h3>
              
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="showEstimates">Show Estimates</Label>
                  <p className="text-xs text-muted-foreground">
                    Display analyst estimates in the earnings table
                  </p>
                </div>
                <Switch
                  id="showEstimates"
                  checked={showEstimates}
                  onCheckedChange={setShowEstimates}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="showSurprises">Show Surprises</Label>
                  <p className="text-xs text-muted-foreground">
                    Display earnings surprise percentages
                  </p>
                </div>
                <Switch
                  id="showSurprises"
                  checked={showSurprises}
                  onCheckedChange={setShowSurprises}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="showExchange">Show Exchange</Label>
                  <p className="text-xs text-muted-foreground">
                    Display stock exchange information
                  </p>
                </div>
                <Switch
                  id="showExchange"
                  checked={showExchange}
                  onCheckedChange={setShowExchange}
                />
              </div>
            </div>

            <Separator />

            <Button 
              onClick={handleSavePreferences}
              disabled={isSaving}
              className="w-full sm:w-auto"
            >
              <Save className="h-4 w-4 mr-2" />
              {isSaving ? "Saving..." : "Save Preferences"}
            </Button>
          </CardContent>
        </Card>

        {/* Notification Preferences */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Alert Settings</CardTitle>
            <CardDescription>
              Configure default timing for new earnings alerts
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="defaultDaysBefore">Default Days Before Earnings</Label>
              <Input
                id="defaultDaysBefore"
                type="number"
                min="0"
                max="30"
                value={defaultDaysBefore}
                onChange={(e) => setDefaultDaysBefore(parseInt(e.target.value) || 2)}
                className="max-w-[120px]"
              />
              <p className="text-xs text-muted-foreground">
                New alerts will default to this many days before earnings
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="defaultDaysAfter">Default Days After Earnings</Label>
              <Input
                id="defaultDaysAfter"
                type="number"
                min="0"
                max="30"
                value={defaultDaysAfter}
                onChange={(e) => setDefaultDaysAfter(parseInt(e.target.value) || 1)}
                className="max-w-[120px]"
              />
              <p className="text-xs text-muted-foreground">
                New alerts will default to this many days after earnings
              </p>
            </div>

            <Button
              onClick={handleSaveNotificationPreferences}
              disabled={loadingPreferences}
              size="sm"
            >
              <Save className="h-4 w-4 mr-2" />
              {loadingPreferences ? "Saving..." : "Save"}
            </Button>
          </CardContent>
        </Card>

        {/* Account Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Account Actions</CardTitle>
            <CardDescription>
              Permanent account actions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="w-full sm:w-auto">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Account
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete your
                    account and remove all of your data from our servers.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDeleteAccount}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Delete Account
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
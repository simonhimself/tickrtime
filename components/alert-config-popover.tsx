"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Bell, Repeat } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { createAlert, updateAlert, deleteAlert, getEarningsWatchlist, getAlertPreferences } from "@/lib/api-client";
import type { EarningsData } from "@/types";
import type { KVAlert } from "@/lib/auth";

interface AlertConfigPopoverProps {
  symbol: string;
  earningsData?: EarningsData | null;
  existingAlerts?: KVAlert[];
  children?: React.ReactNode;
  onSuccess?: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function AlertConfigPopover({
  symbol,
  earningsData,
  existingAlerts = [],
  onSuccess,
  open,
  onOpenChange,
}: AlertConfigPopoverProps) {
  // Find existing alerts for this symbol
  const beforeAlert = existingAlerts.find(
    (a) => a.symbol.toUpperCase() === symbol.toUpperCase() && a.alertType === "before" && a.status === "active"
  );
  const afterAlert = existingAlerts.find(
    (a) => a.symbol.toUpperCase() === symbol.toUpperCase() && a.alertType === "after" && a.status === "active"
  );

  // User's default preferences (fetched from profile settings)
  const [userDefaultDaysBefore, setUserDefaultDaysBefore] = useState(2);
  const [userDefaultDaysAfter, setUserDefaultDaysAfter] = useState(1);

  // Form state
  const [beforeEnabled, setBeforeEnabled] = useState(!!beforeAlert);
  const [afterEnabled, setAfterEnabled] = useState(!!afterAlert);
  const [daysBefore, setDaysBefore] = useState(beforeAlert?.daysBefore?.toString() || "2");
  const [daysAfter, setDaysAfter] = useState(afterAlert?.daysAfter?.toString() || "1");
  const [recurring, setRecurring] = useState(beforeAlert?.recurring || afterAlert?.recurring || false);
  const [loading, setLoading] = useState(false);
  const [earningsDate, setEarningsDate] = useState<string>(earningsData?.date || "");

  // Fetch user's default preferences when dialog opens
  useEffect(() => {
    if (open) {
      // Fetch user preferences for default days
      getAlertPreferences()
        .then((data) => {
          if (data.success && data.preferences) {
            if (data.preferences.defaultDaysBefore) {
              setUserDefaultDaysBefore(data.preferences.defaultDaysBefore);
            }
            if (data.preferences.defaultDaysAfter !== undefined) {
              setUserDefaultDaysAfter(data.preferences.defaultDaysAfter);
            }
          }
        })
        .catch(() => {
          // Use fallback defaults if fetch fails
        });
    }
  }, [open]);

  // Reset form when symbol changes or dialog opens
  useEffect(() => {
    if (open) {
      const newBeforeAlert = existingAlerts.find(
        (a) => a.symbol.toUpperCase() === symbol.toUpperCase() && a.alertType === "before" && a.status === "active"
      );
      const newAfterAlert = existingAlerts.find(
        (a) => a.symbol.toUpperCase() === symbol.toUpperCase() && a.alertType === "after" && a.status === "active"
      );

      setBeforeEnabled(!!newBeforeAlert);
      setAfterEnabled(!!newAfterAlert);
      // Use user's preference for new alerts, or existing alert's value
      setDaysBefore(newBeforeAlert?.daysBefore?.toString() || userDefaultDaysBefore.toString());
      setDaysAfter(newAfterAlert?.daysAfter?.toString() || userDefaultDaysAfter.toString());
      setRecurring(newBeforeAlert?.recurring || newAfterAlert?.recurring || false);
      setEarningsDate(earningsData?.date || newBeforeAlert?.earningsDate || newAfterAlert?.earningsDate || "");
    }
  }, [open, symbol, existingAlerts, earningsData?.date, userDefaultDaysBefore, userDefaultDaysAfter]);

  // Fetch earnings date if not available
  useEffect(() => {
    if (symbol && !earningsDate && open) {
      fetchEarningsDate(symbol);
    }
  }, [symbol, earningsDate, open]);

  const fetchEarningsDate = async (ticker: string) => {
    try {
      const data = await getEarningsWatchlist([ticker]);
      // Handle both array and object response formats
      const earningsArray = Array.isArray(data) ? data : (data.earnings || []);
      const firstEarning = earningsArray[0];
      if (firstEarning?.date) {
        setEarningsDate(firstEarning.date);
      }
    } catch (error) {
      console.error("Error fetching earnings date:", error);
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "No date available";
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return dateString;
    }
  };

  const handleSave = async () => {
    const token = localStorage.getItem("tickrtime-auth-token");
    if (!token) {
      toast.error("Please log in to set alerts");
      return;
    }

    if (!beforeEnabled && !afterEnabled) {
      // If both are disabled, remove any existing alerts
      await handleRemoveAll();
      return;
    }

    if (!earningsDate) {
      toast.error("Could not determine earnings date");
      return;
    }

    setLoading(true);

    try {
      // Handle "before" alert
      if (beforeEnabled) {
        const days = parseInt(daysBefore);
        if (isNaN(days) || days < 0) {
          toast.error("Please enter valid days before");
          setLoading(false);
          return;
        }

        if (beforeAlert) {
          // Update existing
          await updateAlert(beforeAlert.id, {
            daysBefore: days,
            recurring,
            earningsDate,
          });
        } else {
          // Create new
          await createAlert({
            symbol: symbol.toUpperCase(),
            alertType: "before",
            daysBefore: days,
            recurring,
            earningsDate,
          });
        }
      } else if (beforeAlert) {
        // Remove disabled alert
        await deleteAlert(beforeAlert.id);
      }

      // Handle "after" alert
      if (afterEnabled) {
        const days = parseInt(daysAfter);
        if (isNaN(days) || days < 0) {
          toast.error("Please enter valid days after");
          setLoading(false);
          return;
        }

        if (afterAlert) {
          // Update existing
          await updateAlert(afterAlert.id, {
            daysAfter: days,
            recurring,
            earningsDate,
          });
        } else {
          // Create new
          await createAlert({
            symbol: symbol.toUpperCase(),
            alertType: "after",
            daysAfter: days,
            recurring,
            earningsDate,
          });
        }
      } else if (afterAlert) {
        // Remove disabled alert
        await deleteAlert(afterAlert.id);
      }

      toast.success(`Alert settings saved for ${symbol}`);
      onOpenChange?.(false);

      // Dispatch event to refresh alerts
      window.dispatchEvent(new CustomEvent("alertsChanged"));
      onSuccess?.();
    } catch (error) {
      console.error("Error saving alerts:", error);
      toast.error("Failed to save alert settings");
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveAll = async () => {
    setLoading(true);
    try {
      if (beforeAlert) {
        await deleteAlert(beforeAlert.id);
      }
      if (afterAlert) {
        await deleteAlert(afterAlert.id);
      }
      toast.info(`Alerts removed for ${symbol}`);
      onOpenChange?.(false);
      window.dispatchEvent(new CustomEvent("alertsChanged"));
      onSuccess?.();
    } catch (error) {
      console.error("Error removing alerts:", error);
      toast.error("Failed to remove alerts");
    } finally {
      setLoading(false);
    }
  };

  const hasExistingAlerts = !!beforeAlert || !!afterAlert;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-yellow-500" />
            Alert for {symbol}
          </DialogTitle>
        </DialogHeader>

        {/* Earnings date info */}
        {earningsDate && (
          <div className="text-sm text-muted-foreground">
            Earnings: {formatDate(earningsDate)}
          </div>
        )}

        {/* Alert options */}
        <div className="space-y-4 py-4">
          {/* Before earnings */}
          <div className="flex items-center gap-3">
            <Checkbox
              id="before"
              checked={beforeEnabled}
              onCheckedChange={(checked) => setBeforeEnabled(checked === true)}
            />
            <Label htmlFor="before" className="text-sm flex-1 cursor-pointer">
              Alert me before earnings
            </Label>
            <div className="flex items-center gap-1">
              <Input
                type="number"
                min="0"
                max="30"
                value={daysBefore}
                onChange={(e) => setDaysBefore(e.target.value)}
                className="w-14 h-8 text-center text-sm"
                disabled={!beforeEnabled}
              />
              <span className="text-sm text-muted-foreground">days</span>
            </div>
          </div>

          {/* After earnings */}
          <div className="flex items-center gap-3">
            <Checkbox
              id="after"
              checked={afterEnabled}
              onCheckedChange={(checked) => setAfterEnabled(checked === true)}
            />
            <Label htmlFor="after" className="text-sm flex-1 cursor-pointer">
              Also alert after earnings
            </Label>
            <div className="flex items-center gap-1">
              <Input
                type="number"
                min="0"
                max="30"
                value={daysAfter}
                onChange={(e) => setDaysAfter(e.target.value)}
                className="w-14 h-8 text-center text-sm"
                disabled={!afterEnabled}
              />
              <span className="text-sm text-muted-foreground">days</span>
            </div>
          </div>

          {/* Recurring toggle */}
          <div className="flex items-center justify-between pt-2 border-t">
            <div className="flex items-center gap-2">
              <Repeat className="h-3.5 w-3.5 text-muted-foreground" />
              <Label htmlFor="recurring" className="text-sm cursor-pointer">
                Make recurring
              </Label>
            </div>
            <Switch
              id="recurring"
              checked={recurring}
              onCheckedChange={setRecurring}
              disabled={!beforeEnabled && !afterEnabled}
            />
          </div>
          <p className="text-xs text-muted-foreground -mt-2">
            Automatically alert for future earnings
          </p>
        </div>

        {/* Actions */}
        <DialogFooter className="flex-row justify-between sm:justify-between">
          {hasExistingAlerts ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRemoveAll}
              disabled={loading}
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              Remove All
            </Button>
          ) : (
            <div />
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange?.(false)} disabled={loading}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={loading}>
              {loading ? "Saving..." : "Save"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

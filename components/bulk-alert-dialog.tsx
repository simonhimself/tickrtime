"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Bell, Repeat } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { createAlert } from "@/lib/api-client";
import type { EarningsData } from "@/types";
import type { KVAlert } from "@/lib/auth";

interface BulkAlertDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  earnings: EarningsData[];
  existingAlerts: KVAlert[];
  onSuccess?: () => void;
}

export function BulkAlertDialog({
  open,
  onOpenChange,
  earnings,
  existingAlerts,
  onSuccess,
}: BulkAlertDialogProps) {
  // Get stocks without active alerts
  const alertedSymbols = new Set(
    existingAlerts
      .filter((a) => a.status === "active")
      .map((a) => a.symbol.toUpperCase())
  );

  const stocksWithoutAlerts = earnings.filter(
    (e) => e.date && !alertedSymbols.has(e.symbol.toUpperCase())
  );

  // Form state
  const [beforeEnabled, setBeforeEnabled] = useState(true);
  const [daysBefore, setDaysBefore] = useState("2");
  const [afterEnabled, setAfterEnabled] = useState(false);
  const [daysAfter, setDaysAfter] = useState("1");
  const [recurring, setRecurring] = useState(true);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!beforeEnabled && !afterEnabled) {
      toast.error("Please enable at least one alert type");
      return;
    }

    const token = localStorage.getItem("tickrtime-auth-token");
    if (!token) {
      toast.error("Please log in to set alerts");
      return;
    }

    setLoading(true);
    let successCount = 0;
    let errorCount = 0;

    try {
      for (const earning of stocksWithoutAlerts) {
        if (!earning.date) continue;

        try {
          // Create "before" alert
          if (beforeEnabled) {
            await createAlert({
              symbol: earning.symbol.toUpperCase(),
              alertType: "before",
              daysBefore: parseInt(daysBefore),
              recurring,
              earningsDate: earning.date,
            });
          }

          // Create "after" alert
          if (afterEnabled) {
            await createAlert({
              symbol: earning.symbol.toUpperCase(),
              alertType: "after",
              daysAfter: parseInt(daysAfter),
              recurring,
              earningsDate: earning.date,
            });
          }

          successCount++;
        } catch {
          errorCount++;
        }
      }

      if (successCount > 0) {
        toast.success(`Created alerts for ${successCount} stock${successCount > 1 ? "s" : ""}`);
        window.dispatchEvent(new CustomEvent("alertsChanged"));
        onSuccess?.();
      }

      if (errorCount > 0) {
        toast.error(`Failed to create alerts for ${errorCount} stock${errorCount > 1 ? "s" : ""}`);
      }

      onOpenChange(false);
    } catch (error) {
      console.error("Error creating bulk alerts:", error);
      toast.error("Failed to create alerts");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-yellow-500" />
            Add Alerts to {stocksWithoutAlerts.length} Stock{stocksWithoutAlerts.length > 1 ? "s" : ""}
          </DialogTitle>
          <DialogDescription>
            Set up alerts for all watchlisted stocks that don&apos;t have alerts yet.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Before earnings */}
          <div className="flex items-center gap-3">
            <Checkbox
              id="bulk-before"
              checked={beforeEnabled}
              onCheckedChange={(checked) => setBeforeEnabled(checked === true)}
            />
            <Label htmlFor="bulk-before" className="text-sm flex-1 cursor-pointer">
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
              id="bulk-after"
              checked={afterEnabled}
              onCheckedChange={(checked) => setAfterEnabled(checked === true)}
            />
            <Label htmlFor="bulk-after" className="text-sm flex-1 cursor-pointer">
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
              <Label htmlFor="bulk-recurring" className="text-sm cursor-pointer">
                Make recurring
              </Label>
            </div>
            <Switch
              id="bulk-recurring"
              checked={recurring}
              onCheckedChange={setRecurring}
            />
          </div>
          <p className="text-xs text-muted-foreground -mt-2">
            Automatically alert for future earnings
          </p>

          {/* Stock list preview */}
          <div className="rounded-lg bg-muted/50 p-3 mt-4">
            <p className="text-xs font-medium text-muted-foreground mb-2">
              Applies to:
            </p>
            <p className="text-sm">
              {stocksWithoutAlerts
                .slice(0, 8)
                .map((e) => e.symbol)
                .join(", ")}
              {stocksWithoutAlerts.length > 8 && ` +${stocksWithoutAlerts.length - 8} more`}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading || stocksWithoutAlerts.length === 0}>
            {loading
              ? "Creating..."
              : `Add ${stocksWithoutAlerts.length} Alert${stocksWithoutAlerts.length > 1 ? "s" : ""}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

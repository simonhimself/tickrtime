"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Bell } from "lucide-react";

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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { EarningsData } from "@/types";
import { createAlert, getEarningsWatchlist } from "@/lib/api-client";

interface AlertDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  symbol?: string;
  earningsData?: EarningsData | null;
  defaultDaysBefore?: number;
  defaultDaysAfter?: number;
  onSuccess?: () => void;
}

export function AlertDialog({
  open,
  onOpenChange,
  symbol: initialSymbol = "",
  earningsData,
  defaultDaysBefore = 1,
  defaultDaysAfter = 0,
  onSuccess,
}: AlertDialogProps) {
  const [symbol, setSymbol] = useState(initialSymbol);
  const [alertType, setAlertType] = useState<"before" | "after">("before");
  const [daysBefore, setDaysBefore] = useState(defaultDaysBefore.toString());
  const [daysAfter, setDaysAfter] = useState(defaultDaysAfter.toString());
  const [recurring, setRecurring] = useState(false);
  const [loading, setLoading] = useState(false);
  const [earningsDate, setEarningsDate] = useState<string>("");

  // Update symbol when prop changes
  useEffect(() => {
    if (initialSymbol) {
      setSymbol(initialSymbol);
    }
  }, [initialSymbol]);

  // Set earnings date from earningsData
  useEffect(() => {
    if (earningsData?.date) {
      setEarningsDate(earningsData.date);
    }
  }, [earningsData]);

  // Fetch next earnings date if symbol is provided but no date
  useEffect(() => {
    if (symbol && !earningsDate && open) {
      fetchNextEarningsDate(symbol);
    }
  }, [symbol, earningsDate, open]);

  const fetchNextEarningsDate = async (ticker: string) => {
    try {
      const data = await getEarningsWatchlist([ticker]);
      if (Array.isArray(data) && data.length > 0 && data[0].date) {
        setEarningsDate(data[0].date);
      }
    } catch (error) {
      console.error("Error fetching earnings date:", error);
    }
  };

  const handleSubmit = async () => {
    if (!symbol) {
      toast.error("Please enter a symbol");
      return;
    }

    if (!earningsDate) {
      toast.error("Could not determine earnings date. Please try again.");
      return;
    }

    if (alertType === "before" && (!daysBefore || parseInt(daysBefore) < 0)) {
      toast.error("Please enter a valid number of days before");
      return;
    }

    if (alertType === "after" && (!daysAfter || parseInt(daysAfter) < 0)) {
      toast.error("Please enter a valid number of days after");
      return;
    }

    setLoading(true);

    try {
      const token = localStorage.getItem("tickrtime-auth-token");
      if (!token) {
        toast.error("Please log in to set alerts");
        onOpenChange(false);
        return;
      }

      const data = await createAlert({
        symbol: symbol.toUpperCase(),
        alertType,
        daysBefore: alertType === "before" ? parseInt(daysBefore) : undefined,
        daysAfter: alertType === "after" ? parseInt(daysAfter) : undefined,
        recurring,
        earningsDate,
      });

      if (!data.success) {
        console.error("Alert creation error:", {
          data: JSON.stringify(data, null, 2),
        });
        toast.error(data.message || "Failed to create alert");
        return;
      }

      toast.success(`Alert created for ${symbol.toUpperCase()}`);
      onOpenChange(false);
      
      // Reset form
      setSymbol("");
      setAlertType("before");
      setDaysBefore(defaultDaysBefore.toString());
      setDaysAfter(defaultDaysAfter.toString());
      setRecurring(false);
      setEarningsDate("");

      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      console.error("Error creating alert:", error);
      toast.error("Failed to create alert");
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "Not available";
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    } catch {
      return dateString;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Set Earnings Alert
          </DialogTitle>
          <DialogDescription>
            Get notified when earnings are announced or before they happen.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="symbol">Symbol</Label>
            <Input
              id="symbol"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              placeholder="e.g., AAPL"
              disabled={!!initialSymbol}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="alertType">Alert Type</Label>
            <Select value={alertType} onValueChange={(value: "before" | "after") => setAlertType(value)}>
              <SelectTrigger id="alertType">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="before">Before Earnings</SelectItem>
                <SelectItem value="after">After Earnings</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {alertType === "before" && (
            <div className="space-y-2">
              <Label htmlFor="daysBefore">Days Before Earnings</Label>
              <Input
                id="daysBefore"
                type="number"
                min="0"
                value={daysBefore}
                onChange={(e) => setDaysBefore(e.target.value)}
                placeholder="1"
              />
              <p className="text-xs text-muted-foreground">
                You'll receive an alert this many days before the earnings date.
              </p>
            </div>
          )}

          {alertType === "after" && (
            <div className="space-y-2">
              <Label htmlFor="daysAfter">Days After Earnings</Label>
              <Input
                id="daysAfter"
                type="number"
                min="0"
                value={daysAfter}
                onChange={(e) => setDaysAfter(e.target.value)}
                placeholder="0"
              />
              <p className="text-xs text-muted-foreground">
                You'll receive an alert this many days after the earnings date.
              </p>
            </div>
          )}

          {earningsDate && (
            <div className="rounded-lg bg-muted p-3">
              <p className="text-sm font-medium">Next Earnings Date</p>
              <p className="text-sm text-muted-foreground">{formatDate(earningsDate)}</p>
            </div>
          )}

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="recurring">Recurring Alert</Label>
              <p className="text-xs text-muted-foreground">
                Automatically create alerts for future earnings dates
              </p>
            </div>
            <Switch
              id="recurring"
              checked={recurring}
              onCheckedChange={setRecurring}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? "Creating..." : "Create Alert"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


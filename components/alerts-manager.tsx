"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Bell, Trash2, Edit2, Calendar, Repeat, Clock } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AlertDialog as CreateAlertDialog } from "@/components/alert-dialog";
import type { KVAlert } from "@/lib/auth";
import { getAlerts, deleteAlert } from "@/lib/api-client";

interface AlertsManagerProps {
  className?: string;
}

export function AlertsManager({ className }: AlertsManagerProps) {
  const [alerts, setAlerts] = useState<KVAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [alertToDelete, setAlertToDelete] = useState<KVAlert | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [alertToEdit, setAlertToEdit] = useState<KVAlert | null>(null);

  useEffect(() => {
    loadAlerts();
  }, []);

  const loadAlerts = async () => {
    try {
      const token = localStorage.getItem("tickrtime-auth-token");
      if (!token) {
        setLoading(false);
        return;
      }

      const data = await getAlerts();
      if (data.success) {
        setAlerts(data.alerts || []);
      }
    } catch (error) {
      console.error("Error loading alerts:", error);
      toast.error("Failed to load alerts");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!alertToDelete) return;

    try {
      const token = localStorage.getItem("tickrtime-auth-token");
      if (!token) {
        toast.error("Please log in");
        return;
      }

      const data = await deleteAlert(alertToDelete.id);
      if (data.success) {
        toast.success("Alert deleted");
        loadAlerts();
      } else {
        toast.error(data.message || "Failed to delete alert");
      }
    } catch (error) {
      console.error("Error deleting alert:", error);
      toast.error("Failed to delete alert");
    } finally {
      setDeleteDialogOpen(false);
      setAlertToDelete(null);
    }
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return dateString;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-green-500">Active</Badge>;
      case "sent":
        return <Badge variant="secondary">Sent</Badge>;
      case "cancelled":
        return <Badge variant="destructive">Cancelled</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>My Alerts</CardTitle>
          <CardDescription>Manage your earnings alerts</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Loading alerts...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            My Alerts
          </CardTitle>
          <CardDescription>Manage your earnings alerts</CardDescription>
        </CardHeader>
        <CardContent>
          {alerts.length === 0 ? (
            <div className="text-center py-8">
              <Bell className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-sm text-muted-foreground">No alerts set yet</p>
              <p className="text-xs text-muted-foreground mt-2">
                Set alerts from the earnings table to get notified
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {alerts.map((alert) => (
                <div
                  key={alert.id}
                  className="flex items-start justify-between p-4 border rounded-lg"
                >
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{alert.symbol}</span>
                      {getStatusBadge(alert.status)}
                    </div>
                    <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        <span>{formatDate(alert.earningsDate)}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        <span>
                          {alert.alertType === "before"
                            ? `${alert.daysBefore || 0} day${alert.daysBefore !== 1 ? "s" : ""} before`
                            : `${alert.daysAfter || 0} day${alert.daysAfter !== 1 ? "s" : ""} after`}
                        </span>
                      </div>
                      {alert.recurring && (
                        <div className="flex items-center gap-1">
                          <Repeat className="h-4 w-4" />
                          <span>Recurring</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setAlertToEdit(alert);
                        setEditDialogOpen(true);
                      }}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setAlertToDelete(alert);
                        setDeleteDialogOpen(true);
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Alert</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the alert for {alertToDelete?.symbol}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {alertToEdit && (
        <CreateAlertDialog
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          symbol={alertToEdit.symbol}
          earningsData={{ date: alertToEdit.earningsDate } as any}
          defaultDaysBefore={alertToEdit.daysBefore || 1}
          defaultDaysAfter={alertToEdit.daysAfter || 0}
          onSuccess={() => {
            loadAlerts();
            setAlertToEdit(null);
          }}
        />
      )}
    </>
  );
}


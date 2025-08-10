"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { AuthResponse } from "@/types";

export default function VerifyEmailPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const verifyEmail = async () => {
      const token = searchParams.get("token");
      
      if (!token) {
        setStatus("error");
        setMessage("No verification token provided");
        return;
      }

      try {
        const response = await fetch(`/api/auth/verify-email?token=${token}`);
        const data: AuthResponse = await response.json();

        if (data.success) {
          setStatus("success");
          setMessage(data.message);
          
          // Store token if provided
          if (data.token) {
            localStorage.setItem("tickrtime-auth-token", data.token);
          }
          
          toast.success("Email verified successfully!");
        } else {
          setStatus("error");
          setMessage(data.message);
          toast.error(data.message);
        }
      } catch (error) {
        console.error("Email verification error:", error);
        setStatus("error");
        setMessage("Failed to verify email. Please try again.");
        toast.error("Failed to verify email");
      }
    };

    verifyEmail();
  }, [searchParams]);

  const handleContinue = () => {
    router.push("/");
  };

  const handleResend = () => {
    // TODO: Implement resend verification email
    toast.info("Resend functionality coming soon");
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            {status === "loading" && (
              <Loader2 className="h-12 w-12 text-blue-500 animate-spin" />
            )}
            {status === "success" && (
              <CheckCircle className="h-12 w-12 text-green-500" />
            )}
            {status === "error" && (
              <XCircle className="h-12 w-12 text-red-500" />
            )}
          </div>
          <CardTitle>
            {status === "loading" && "Verifying Email..."}
            {status === "success" && "Email Verified!"}
            {status === "error" && "Verification Failed"}
          </CardTitle>
          <CardDescription>
            {status === "loading" && "Please wait while we verify your email address"}
            {status === "success" && "Your email has been successfully verified"}
            {status === "error" && "We couldn't verify your email address"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-center text-muted-foreground">
            {message}
          </p>
          
          {status === "success" && (
            <Button onClick={handleContinue} className="w-full">
              Continue to TickrTime
            </Button>
          )}
          
          {status === "error" && (
            <div className="space-y-2">
              <Button onClick={handleResend} variant="outline" className="w-full">
                Resend Verification Email
              </Button>
              <Button onClick={handleContinue} className="w-full">
                Go to Homepage
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

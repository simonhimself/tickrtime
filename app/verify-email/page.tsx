"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AuthResponse } from "@/types";
import { verifyEmail as verifyEmailApi } from "@/lib/api-client";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");
  const [resendEmail, setResendEmail] = useState("");
  const [isResending, setIsResending] = useState(false);

  useEffect(() => {
    const performVerification = async () => {
      const token = searchParams.get("token");

      if (!token) {
        setStatus("error");
        setMessage("No verification token provided");
        return;
      }

      try {
        const data: AuthResponse = await verifyEmailApi(token);

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

    performVerification();
  }, [searchParams]);

  const handleContinue = () => {
    router.push("/");
  };

  const handleResend = async () => {
    if (!resendEmail) {
      toast.error("Please enter your email address");
      return;
    }

    setIsResending(true);

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/resend-verification`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: resendEmail }),
      });

      const data: AuthResponse = await response.json();

      if (data.success) {
        toast.success("If an unverified account exists, a verification email has been sent.");
        setResendEmail("");
      } else {
        toast.error(data.message || "Failed to resend verification email");
      }
    } catch (error) {
      console.error("Resend verification error:", error);
      toast.error("Failed to resend verification email. Please try again.");
    } finally {
      setIsResending(false);
    }
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
          {status === "error" && message && (
            <p className="text-center text-muted-foreground">
              {message}
            </p>
          )}

          {status === "success" && (
            <Button onClick={handleContinue} className="w-full">
              Continue to TickrTime
            </Button>
          )}
          
          {status === "error" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="resend-email">Email Address</Label>
                <Input
                  id="resend-email"
                  type="email"
                  placeholder="Enter your email"
                  value={resendEmail}
                  onChange={(e) => setResendEmail(e.target.value)}
                />
              </div>
              <Button
                onClick={handleResend}
                variant="outline"
                className="w-full"
                disabled={isResending}
              >
                {isResending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  "Resend Verification Email"
                )}
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

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <Loader2 className="h-12 w-12 text-blue-500 animate-spin" />
            </div>
            <CardTitle>Loading...</CardTitle>
            <CardDescription>Please wait while we load the verification page</CardDescription>
          </CardHeader>
        </Card>
      </div>
    }>
      <VerifyEmailContent />
    </Suspense>
  );
}

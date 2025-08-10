"use client";

import { useState } from "react";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SignupForm } from "./signup-form";
import { LoginForm } from "./login-form";
import type { AuthResponse } from "@/types";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (response: AuthResponse) => void;
  defaultMode?: "login" | "signup";
}

export function AuthModal({ 
  isOpen, 
  onClose, 
  onSuccess, 
  defaultMode = "login" 
}: AuthModalProps) {
  const [mode, setMode] = useState<"login" | "signup">(defaultMode);

  const handleSuccess = (response: AuthResponse) => {
    onSuccess?.(response);
    onClose();
  };

  const switchToSignup = () => setMode("signup");
  const switchToLogin = () => setMode("login");

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>
              {mode === "login" ? "Sign In" : "Create Account"}
            </DialogTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-6 w-6 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>
        
        <div className="py-4">
          {mode === "login" ? (
            <LoginForm
              onSuccess={handleSuccess}
              onSwitchToSignup={switchToSignup}
            />
          ) : (
            <SignupForm
              onSuccess={handleSuccess}
              onSwitchToLogin={switchToLogin}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useState } from "react";
import { SignupForm } from "./signup-form";
import { LoginForm } from "./login-form";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
      <DialogContent className="w-[calc(100%-2rem)] max-w-md mx-auto sm:w-full">
        <DialogHeader>
          <DialogTitle className="text-lg sm:text-xl">
            {mode === "login" ? "Sign In" : "Create Account"}
          </DialogTitle>
        </DialogHeader>
        
        <div className="py-2 sm:py-4">
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

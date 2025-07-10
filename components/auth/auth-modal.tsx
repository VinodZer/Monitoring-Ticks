"use client"

import { Dialog, DialogContent } from "@/components/ui/dialog"
import { useAuth } from "@/contexts/auth-context"
import { LoginForm } from "./login-form"
import { SignupForm } from "./signup-form"
import { ForgotPasswordForm } from "./forgot-password-form"

export function AuthModal() {
  const { isAuthModalOpen, setIsAuthModalOpen, authMode } = useAuth()

  return (
    <Dialog open={isAuthModalOpen} onOpenChange={setIsAuthModalOpen}>
      <DialogContent className="sm:max-w-md">
        {authMode === "signin" && <LoginForm />}
        {authMode === "signup" && <SignupForm />}
        {authMode === "forgot-password" && <ForgotPasswordForm />}
      </DialogContent>
    </Dialog>
  )
}

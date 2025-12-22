"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, HelpCircle } from "lucide-react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSent, setIsSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 1500));
    
    setIsLoading(false);
    setIsSent(true);
    toast.success("Link sent! (Probably to your spam folder)");
  };

  return (
    <div className="min-h-[calc(85vh-4rem)] w-screen flex items-center justify-center py-2 px-4">
      <Card className="w-full max-w-md shadow-2xl border-muted/50 bg-background/60 backdrop-blur-md">
        {isSent ? (
          <div className="p-8 text-center space-y-6">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 mb-4 animate-bounce">
              <HelpCircle className="h-8 w-8 text-primary" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight">Check Your Inbox</h2>
            <p className="text-muted-foreground text-sm md:text-base leading-relaxed">
              We just sent a reset link to <strong className="text-foreground">{email}</strong>. 
              If it isn't there in 2 minutes, check your spam folder, try typing your email correctly, or accept that it's lost forever.
            </p>
            <div className="pt-4">
              <Button asChild className="w-full cursor-pointer">
                <Link href="/login">Back to Login</Link>
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <CardHeader className="space-y-2 text-center">
              <CardTitle className="text-2xl md:text-3xl flex items-center justify-center gap-2">
                Memory Leak? 🧠
              </CardTitle>
              <CardDescription className="text-sm md:text-base">
                Forgot your password? Don't worry, we also forget what we had for breakfast. 
                Enter your email and we'll pretend to reset it.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="email">Your Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="name@company.com"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                />
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-4 py-4">
              <Button
                type="submit"
                className="w-full cursor-pointer"
                disabled={isLoading || !email}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Consulting our oracle...
                  </>
                ) : (
                  "Fix My Amnesia"
                )}
              </Button>
              <p className="text-center text-sm text-muted-foreground">
                Wait, I remembered it!{" "}
                <Link
                  href="/login"
                  className="underline hover:text-primary font-medium cursor-pointer"
                >
                  Praise be, log in
                </Link>
              </p>
            </CardFooter>
          </form>
        )}
      </Card>
    </div>
  );
}

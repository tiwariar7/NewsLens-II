"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
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
import * as api from "@/lib/api";
import { useAuthStore } from "@/lib/authStore";
import { Loader2, ShieldAlert } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { login, token } = useAuthStore();

  useEffect(() => {
    if (token) {
      router.replace("/dashboard");
    }
  }, [token, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const data = await api.loginUser(email, password);
      login(data.token, data.user);
      toast.success("Login successful! Welcome back to the matrix.");
      router.push("/dashboard");
    } catch (error: any) {
      toast.error("Access Denied", { 
        description: error.message || "Our servers rejected your offerings." 
      });
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(85vh-4rem)] w-screen flex items-center justify-center py-2 px-4">
      <Card className="w-full max-w-md shadow-2xl border-muted/50 bg-background/60 backdrop-blur-md">
        <form onSubmit={handleSubmit}>
          <CardHeader className="space-y-2 text-center">
            <CardTitle className="text-2xl md:text-3xl flex items-center justify-center gap-2">
              Welcome Back, Truth Seeker 📰
            </CardTitle>
            <CardDescription className="text-sm md:text-base">
              Sign in to see how the world is burning today. 
              We promise your credentials are (mostly) safe with us.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@corporate-overlord.com"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
              />
            </div>
            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Link
                  href="/forgot-password"
                  className="text-xs text-muted-foreground hover:underline hover:text-primary cursor-pointer"
                >
                  Forgot password? (Classic you)
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                required
                value={password}
                placeholder="Make it harder than 'password123'"
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4 py-3">
            <Button
              type="submit"
              className="w-full cursor-pointer"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin " />
                  Decrypting your secrets...
                </>
              ) : (
                <>Sign In (Enter the Echo Chamber)</>
              )}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              Don't have an account?{" "}
              <Link
                href="/signup"
                className="underline hover:text-primary font-medium cursor-pointer"
              >
                Join the indoctrination (Sign up)
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}

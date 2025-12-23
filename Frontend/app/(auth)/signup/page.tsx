"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
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
import { Loader2 } from "lucide-react";

export default function SignupPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [location, setLocation] = useState("");
  const [country, setCountry] = useState("us");
  const [language, setLanguage] = useState("en");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const login = useAuthStore((state) => state.login);

  useEffect(() => {
    fetch("https://ipapi.co/json/")
      .then((res) => res.json())
      .then((data) => {
        if (data.country_code) {
          setCountry(data.country_code.toLowerCase());
        }
        if (data.languages) {
          setLanguage(data.languages.split(",")[0].split("-")[0].toLowerCase());
        }
        if (data.city && data.country_name) {
          setLocation(`${data.city}, ${data.country_name}`);
        }
      })
      .catch((err) => console.error("Failed to detect location", err));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await api.signupUser(name, email, password, location, country, language);
      toast.success("Account created! Prepare for data ingestion.");

      const data = await api.loginUser(email, password);
      login(data.token, data.user);
      
      router.push("/onboarding");
    } catch (error: any) {
      toast.error("Signup Failed", { 
        description: error.message || "The gatekeeper refused your request." 
      });
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(80vh-4rem)] flex items-center justify-center w-screen py-8 px-4">
      <Card className="w-full max-w-md shadow-2xl border-muted/50 bg-background/60 backdrop-blur-md">
        <form onSubmit={handleSubmit}>
          <CardHeader className="space-y-2 text-center">
            <CardTitle className="text-2xl md:text-3xl">Begin Your Indoctrination ✍️</CardTitle>
            <CardDescription className="text-sm md:text-base">
              Create an account to track market volatility, policy shifts, and the general decline of order.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Name</Label>
              <Input 
                id="name" 
                placeholder="What should we call you?" 
                required 
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isLoading}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@corporate-conglomerate.com"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Password</Label>
              <Input 
                id="password" 
                type="password" 
                required 
                value={password}
                placeholder="Must be harder to guess than '123456'"
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="location">Location</Label>
              <Input 
                id="location" 
                placeholder="Where are you currently hiding? (e.g., Earth)" 
                required 
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                disabled={isLoading}
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4 py-4">
            <Button type="submit" className="w-full cursor-pointer" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Selling your soul...
                </>
              ) : (
                "Create Account (Agree to Everything)"
              )}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              Already a member of the cult?{" "}
              <Link href="/login" className="cursor-pointer underline hover:text-primary font-medium">
                Log in and surrender
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
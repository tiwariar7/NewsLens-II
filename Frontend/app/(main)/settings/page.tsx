"use client";

import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/lib/authStore";
import * as api from "@/lib/api";
import { TopicPicker } from "@/components/features/onboarding/TopicPicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Card } from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { toast } from "sonner";
import { User, Settings as SettingsIcon } from "lucide-react";

export default function SettingsPage() {
  const { user } = useAuthStore();

  const { data, isLoading, error } = useQuery({
    queryKey: ["preferences", user?.email],
    queryFn: () => api.getPreferences(user!.email!),
    enabled: !!user,
  });

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 md:py-8 space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-2xl md:text-4xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground text-sm md:text-lg">
          Manage your account and preferences
        </p>
      </div>

      <Tabs defaultValue="profile" className="mt-6 md:mt-8">
        <TabsList className="grid w-full grid-cols-2 h-auto">
          <TabsTrigger value="profile" className="gap-1.5 sm:gap-2 text-xs sm:text-sm py-2">
            <User className="h-3 w-3 sm:h-4 sm:w-4" />
            <span className="hidden xs:inline">Profile</span>
            <span className="xs:hidden">Profile</span>
          </TabsTrigger>
          <TabsTrigger value="preferences" className="gap-1.5 sm:gap-2 text-xs sm:text-sm py-2">
            <SettingsIcon className="h-3 w-3 sm:h-4 sm:w-4" />
            <span className="hidden xs:inline">Preferences</span>
            <span className="xs:hidden">Topics</span>
          </TabsTrigger>
        </TabsList>

        <Separator className="my-4 md:my-6" />

        <TabsContent value="profile" className="space-y-6">
          <Card className="p-4 sm:p-6">
            <div className="space-y-4 max-w-md">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-sm">Name</Label>
                <Input 
                  id="name" 
                  defaultValue={user?.name} 
                  disabled 
                  className="text-sm"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm">Email</Label>
                <Input 
                  id="email" 
                  type="email" 
                  defaultValue={user?.email} 
                  disabled 
                  className="text-sm"
                />
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground pt-2">
                Profile editing is not yet enabled.
              </p>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="preferences" className="space-y-6">
          <div className="space-y-4">
            <div>
              <h3 className="text-lg md:text-xl font-semibold mb-2">Manage Topics</h3>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Update the topics you're interested in to personalize your news feed.
              </p>
            </div>
            
            {isLoading && (
              <Card className="p-6 md:p-8 text-center">
                <p className="text-muted-foreground text-sm">Loading preferences...</p>
              </Card>
            )}
            
            {error && (
              <Card className="p-6 md:p-8 text-center border-destructive/50">
                <p className="text-destructive text-sm">Could not load preferences.</p>
              </Card>
            )}
            
            {data && (
              <TopicPicker
                initialTopics={data.preferred_domains}
                initialCountry={data.country}
                initialLanguage={data.language}
                initialScope={data.news_scope}
                onSuccess={() => {
                  toast.success("Preferences updated successfully!");
                }}
              />
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
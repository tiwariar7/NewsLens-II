"use client";

import { TopicPicker } from "@/components/features/onboarding/TopicPicker";
import { useMemo } from "react";

export default function OnboardingPage() {
  const emptyTopics = useMemo(() => [], []);

  return (
    <div className="min-h-screen bg-background py-8 md:py-12 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8 md:mb-12 space-y-3 md:space-y-4">
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-foreground">
            Welcome to the Bubble 🖲️
          </h1>
          <p className="text-base sm:text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto px-4">
            Just one more step before we flood your brain with endless updates.
          </p>
        </div>

        {/* Topic Selection */}
        <div className="bg-card text-card-foreground rounded-2xl border shadow-sm p-4 sm:p-6 md:p-8 lg:p-12">
          <div className="text-center mb-6 md:mb-8 space-y-2 md:space-y-3">
            <h2 className="text-2xl sm:text-2xl md:text-3xl font-bold text-foreground">
              Select Your Echo Chambers 🗣️
            </h2>
            <p className="text-muted-foreground text-sm sm:text-base md:text-lg">
              Choose the topics you want to obsess over. We'll help you ignore everything else.
            </p>
          </div>

          <TopicPicker initialTopics={emptyTopics} />
        </div>
      </div>
    </div>
  );
}
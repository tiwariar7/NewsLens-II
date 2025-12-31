"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { API_BASE_URL } from "@/lib/config";

interface ProgressLoaderProps {
  taskId: string;
  onComplete: () => void;
}

export function ProgressLoader({ taskId, onComplete }: ProgressLoaderProps) {
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("Connecting to ingestion queue...");
  const [status, setStatus] = useState("started");

  useEffect(() => {
    if (!taskId) return;

    const url = `${API_BASE_URL}/ingest/status/${taskId}`;
    console.log(`Connecting to SSE stream: ${url}`);
    
    const eventSource = new EventSource(url);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log("SSE progress update:", data);
        
        if (data.progress !== undefined) {
          setProgress(data.progress);
        }
        if (data.message) {
          setMessage(data.message);
        }
        if (data.status) {
          setStatus(data.status);
        }

        if (data.status === "completed" || data.status === "finished" || data.progress >= 100) {
          eventSource.close();
          // Short delay to let the user see 100% completion before refetching
          setTimeout(() => {
            onComplete();
          }, 800);
        }

        if (data.status === "failed") {
          eventSource.close();
        }
      } catch (err) {
        console.error("Error parsing SSE data:", err);
      }
    };

    eventSource.onerror = (err) => {
      console.error("SSE Connection error:", err);
      // Don't crash, it could be a transient disconnect
      setMessage("Connecting to live update server...");
    };

    return () => {
      console.log("Closing SSE connection");
      eventSource.close();
    };
  }, [taskId, onComplete]);

  return (
    <div className="flex flex-col items-center justify-center p-6 md:p-12 w-full max-w-xl mx-auto">
      <Card className="w-full border-muted/50 shadow-xl bg-background/50 backdrop-blur-md p-8 text-center space-y-6">
        <div className="flex justify-center">
          <div className="relative flex items-center justify-center">
            <Loader2 className="h-16 w-16 animate-spin text-primary opacity-20" />
            <div className="absolute text-xl font-bold text-primary">
              {progress}%
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <h3 className="text-xl font-bold tracking-tight">Compiling Your Briefing</h3>
          <p className="text-muted-foreground text-sm min-h-[20px] transition-all">
            {message}
          </p>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-secondary h-2.5 rounded-full overflow-hidden">
          <div
            className="bg-primary h-full transition-all duration-500 ease-out rounded-full"
            style={{ width: `${progress}%` }}
          />
        </div>
        
        {status === "failed" && (
          <p className="text-destructive text-xs font-semibold">
            Ingestion encountered an issue. Try refreshing preferences.
          </p>
        )}
      </Card>
    </div>
  );
}

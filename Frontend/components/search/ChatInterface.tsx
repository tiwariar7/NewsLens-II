"use client";

import { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles, Loader2, Bot } from "lucide-react";
import { useAuthStore } from "@/lib/authStore";

import { BackendArticle } from "@/types";

interface ChatInterfaceProps {
  query: string;
  contextArticles?: BackendArticle[];
}

export function ChatInterface({ query, contextArticles }: ChatInterfaceProps) {
  const [response, setResponse] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { token } = useAuthStore();

  useEffect(() => {
    if (!query || !token) return;

    let isMounted = true;
    const fetchChat = async () => {
      setIsLoading(true);
      setError(null);
      setResponse("");

      try {
        const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
        const res = await fetch(`${baseUrl}/chat`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
          body: JSON.stringify({ query, context_articles: contextArticles })
        });

        if (!res.ok) {
          throw new Error("Failed to fetch AI response");
        }

        if (!res.body) {
          throw new Error("No response body");
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n\n");
          
          // Keep the last partial chunk in the buffer
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const dataStr = line.substring(6);
              if (dataStr === "[DONE]") {
                break;
              }
              try {
                const data = JSON.parse(dataStr);
                if (data.error) {
                  if (isMounted) setError(data.error);
                } else if (data.text) {
                  if (isMounted) setResponse((prev) => prev + data.text);
                }
              } catch (e) {
                console.error("Failed to parse SSE data:", dataStr, e);
              }
            }
          }
        }
      } catch (err: any) {
        if (isMounted) setError(err.message || "Something went wrong.");
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchChat();

    return () => {
      isMounted = false;
    };
  }, [query, token]);

  if (!query) return null;

  return (
    <Card className="w-full mb-8 shadow-xl border-primary/20 bg-gradient-to-br from-card/80 to-muted/30 backdrop-blur-sm">
      <CardHeader className="pb-3 border-b bg-muted/20">
        <CardTitle className="text-xl flex items-center gap-2 text-primary">
          <Bot className="w-5 h-5" />
          AI Overview
          <Sparkles className="w-4 h-4 text-amber-500 animate-pulse ml-1" />
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4">
        {isLoading && !response && (
          <div className="flex items-center text-muted-foreground gap-2 py-4">
            <Loader2 className="w-5 h-5 animate-spin" />
            <p>Analyzing recent articles to answer your question...</p>
          </div>
        )}
        
        {error && (
          <div className="text-destructive bg-destructive/10 p-4 rounded-md">
            {error}
          </div>
        )}

        {response && (
          <div className="prose prose-sm md:prose-base dark:prose-invert max-w-none prose-p:leading-relaxed prose-a:text-primary prose-a:no-underline hover:prose-a:underline">
            <ReactMarkdown>{response}</ReactMarkdown>
          </div>
        )}
        
        {isLoading && response && (
          <div className="flex items-center text-muted-foreground gap-2 mt-4 text-xs">
            <Loader2 className="w-3 h-3 animate-spin" />
            <span>Synthesizing...</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

"use client";

import { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import { BackendArticle } from "@/types";
import { Bot, Sparkles, X, Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuthStore } from "@/lib/authStore";

interface ArticleChatModalProps {
  article: BackendArticle;
  isOpen: boolean;
  onClose: () => void;
}

export function ArticleChatModal({ article, isOpen, onClose }: ArticleChatModalProps) {
  const [query, setQuery] = useState("");
  const [response, setResponse] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { token } = useAuthStore();

  // Handle closing on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Prevent scrolling on body when open
  useEffect(() => {
    if (isOpen) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "unset";
    return () => { document.body.style.overflow = "unset"; };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || !token) return;

    setIsLoading(true);
    setError(null);
    setResponse("");

    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
      const res = await fetch(`${baseUrl}/article-chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ article_url: article.url, query })
      });

      if (!res.ok) throw new Error("Failed to fetch AI response");
      if (!res.body) throw new Error("No response body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const dataStr = line.substring(6);
            if (dataStr === "[DONE]") break;
            try {
              const data = JSON.parse(dataStr);
              if (data.error) setError(data.error);
              else if (data.text) setResponse((prev) => prev + data.text);
            } catch (e) {
              console.error("Failed to parse SSE data:", dataStr);
            }
          }
        }
      }
    } catch (err: any) {
      setError(err.message || "Something went wrong.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-card w-full max-w-2xl rounded-xl shadow-2xl border flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200 relative overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-muted/10">
          <div className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-primary" />
            <h2 className="font-semibold text-lg flex items-center">
              Ask AI
              <Sparkles className="w-4 h-4 text-amber-500 animate-pulse ml-2" />
            </h2>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full hover:bg-destructive/10 hover:text-destructive">
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Context info */}
        <div className="bg-muted/30 p-3 px-4 border-b text-xs text-muted-foreground flex items-center gap-2">
          <span className="font-medium whitespace-nowrap text-foreground">Context:</span>
          <span className="truncate">{article.title}</span>
        </div>

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {!response && !isLoading && !error && (
            <div className="text-center text-muted-foreground py-12 flex flex-col items-center">
              <Bot className="w-12 h-12 mb-4 opacity-20" />
              <p>Ask a question specifically about this article.</p>
              <p className="text-sm mt-1 opacity-70">Example: "Summarize the key points" or "What does this mean for the future?"</p>
            </div>
          )}

          {response && (
            <div className="prose prose-sm dark:prose-invert max-w-none prose-p:leading-relaxed bg-muted/20 p-5 rounded-xl border border-primary/10 shadow-sm">
              <ReactMarkdown>{response}</ReactMarkdown>
            </div>
          )}

          {isLoading && !response && (
             <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground">
               <Loader2 className="w-8 h-8 animate-spin text-primary" />
               <p className="text-sm animate-pulse">Reading the article...</p>
             </div>
          )}

          {isLoading && response && (
            <div className="flex items-center text-muted-foreground gap-2 mt-4 text-xs animate-pulse">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>Thinking...</span>
            </div>
          )}

          {error && (
            <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-md border border-destructive/20">
              {error}
            </div>
          )}
        </div>

        {/* Input Area */}
        <form onSubmit={handleSubmit} className="p-4 border-t bg-background rounded-b-xl flex gap-2">
          <Input 
            value={query} 
            onChange={(e) => setQuery(e.target.value)} 
            placeholder="Type your question here..." 
            className="flex-1"
            disabled={isLoading}
            autoFocus
          />
          <Button type="submit" disabled={!query.trim() || isLoading} className="w-12 px-0">
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </form>
      </div>
    </div>
  );
}

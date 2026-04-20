"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Loader2, Sparkles, Bot } from "lucide-react";
import { cn } from "@/lib/utils";
import { callAdvisor, AdvisorBusyError, type AdvisorMessage } from "@/lib/api";
import { getSupabase } from "@/lib/supabase";
import { toast } from "sonner";

const SUGGESTIONS = [
  "Plan my remaining semesters to graduation",
  "What should I take next semester?",
  "I want a lighter load — what do you suggest?",
  "Am I on track to graduate on time?",
  "What are the hardest courses I still need to take?",
];

function MessageBubble({ msg }: { msg: AdvisorMessage }) {
  const isUser = msg.role === "user";

  // Highlight course codes in assistant messages
  const renderContent = (text: string) => {
    // Strip JSON blocks from display (they're for internal use)
    const cleaned = text.replace(/```json[\s\S]*?```/g, "").trim();
    // Bold course codes like CSCI-241 or CSCI 241
    const parts = cleaned.split(/(\b[A-Z]{2,5}[-\s]\d{3}\b)/g);
    return parts.map((part, i) =>
      /^[A-Z]{2,5}[-\s]\d{3}$/.test(part)
        ? <span key={i} className="font-mono font-semibold bg-primary/10 text-primary px-1 rounded">{part}</span>
        : part
    );
  };

  return (
    <div className={cn("flex gap-3", isUser ? "flex-row-reverse" : "flex-row")}>
      {!isUser && (
        <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Bot className="w-4 h-4 text-primary" />
        </div>
      )}
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap",
          isUser
            ? "bg-primary text-primary-foreground rounded-tr-sm"
            : "bg-muted text-foreground rounded-tl-sm"
        )}
      >
        {isUser ? (
          msg.content
        ) : msg.content ? (
          renderContent(msg.content)
        ) : (
          <span className="inline-flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Thinking...
          </span>
        )}
      </div>
    </div>
  );
}

export default function AdvisorChat() {
  const [messages, setMessages] = useState<AdvisorMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const userMsg: AdvisorMessage = { role: "user", content: trimmed };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const supabase = getSupabase();
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("Not signed in");

      // Add an empty assistant bubble immediately so the user sees it start filling
      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      await callAdvisor(
        token,
        trimmed,
        messages,
        (chunk) => {
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last?.role === "assistant") {
              return [...prev.slice(0, -1), { ...last, content: last.content + chunk }];
            }
            return prev;
          });
        },
        (reasoningDetails) => {
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last?.role === "assistant") {
              return [...prev.slice(0, -1), { ...last, reasoning_details: reasoningDetails }];
            }
            return prev;
          });
        }
      );
    } catch (err) {
      console.error("[AdvisorChat] error:", err);
      const msg = err instanceof AdvisorBusyError
        ? "The advisor is busy right now — try again in a moment."
        : "Something went wrong. Please try again.";
      toast.error(msg);
      // Roll back both the user message and the empty assistant bubble
      setMessages((prev) => prev.slice(0, -2));
    } finally {
      setLoading(false);
    }
  };

  const isEmpty = messages.length === 0;

  return (
    <div className="flex flex-col h-full min-h-[400px] md:min-h-[500px]">

      {/* Empty state */}
      {isEmpty && (
        <div className="flex-1 flex flex-col items-center justify-center text-center px-4 py-12 gap-6">
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
            <Sparkles className="w-7 h-7 text-primary" />
          </div>
          <div>
            <p className="text-base font-semibold text-foreground mb-1">Your AI Academic Advisor</p>
            <p className="text-sm text-muted-foreground max-w-sm">
              Ask anything about your courses, plan, or path to graduation.
              I know your major, your completed courses, and what students say about these classes.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 justify-center max-w-lg">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => send(s)}
                className="text-xs px-3 py-1.5 rounded-full border border-border bg-background hover:bg-muted transition-colors text-foreground"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Messages */}
      {!isEmpty && (
        <div className="flex-1 overflow-y-auto flex flex-col gap-4 py-4 px-1">
          {messages.map((msg, i) => (
            <MessageBubble key={i} msg={msg} />
          ))}
          {false && loading && (
            <div className="flex gap-3">
              <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Bot className="w-4 h-4 text-primary" />
              </div>
              <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Thinking…</span>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      )}

      {/* Input */}
      <div className="flex gap-2 pt-4 border-t border-border mt-auto">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send(input)}
          placeholder="Ask your advisor anything…"
          disabled={loading}
          className="flex-1 text-sm rounded-xl border border-input bg-background px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-60"
        />
        <button
          onClick={() => send(input)}
          disabled={loading || !input.trim()}
          className="flex-shrink-0 w-10 h-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}

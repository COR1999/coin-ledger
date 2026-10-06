"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export function ChatPanel({
  actorName,
  paused,
}: {
  actorName: string;
  paused: boolean;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;

    const userMessage: Message = { role: "user", content: text };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Request failed" }));
        setMessages([
          ...newMessages,
          {
            role: "assistant",
            content: `Error: ${err.error ?? "Something went wrong"}`,
          },
        ]);
        return;
      }

      const data = await res.json();
      setMessages([
        ...newMessages,
        { role: "assistant", content: data.message },
      ]);
    } catch {
      setMessages([
        ...newMessages,
        { role: "assistant", content: "Error: Failed to reach the server." },
      ]);
    } finally {
      setLoading(false);
      setTimeout(() => {
        scrollRef.current?.scrollTo({
          top: scrollRef.current.scrollHeight,
          behavior: "smooth",
        });
      }, 50);
    }
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col">
      {paused && (
        <div
          role="status"
          className="shrink-0 border-b border-red-600/40 bg-red-50 px-4 py-2 text-xs text-red-800 dark:bg-red-950/20 dark:text-red-200"
        >
          <span className="font-semibold">Payments are paused.</span> The agent
          can still answer questions, but won&apos;t create new payment
          proposals until an owner resumes payments in Policies.
        </div>
      )}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-4 space-y-4"
      >
        {messages.length === 0 && (
          <div className="flex h-full items-center justify-center">
            <div className="text-center text-muted-foreground">
              <p className="text-lg font-medium">
                Hi {actorName}, how can I help?
              </p>
              <p className="mt-1 text-sm">
                Ask about cash position, upcoming bills, or request a payment.
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {[
                  "How much cash do we have?",
                  "What bills are coming up?",
                  "What suppliers do we have on file?",
                ].map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => setInput(q)}
                    className="rounded-full border px-3 py-1.5 text-xs hover:bg-accent"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] rounded-lg px-4 py-2.5 text-sm whitespace-pre-wrap ${
                msg.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted"
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="rounded-lg bg-muted px-4 py-2.5 text-sm text-muted-foreground">
              Thinking...
            </div>
          </div>
        )}
      </div>

      <form
        onSubmit={handleSubmit}
        className="border-t bg-background px-4 py-3"
      >
        <div className="mx-auto flex max-w-3xl gap-2">
          <label htmlFor="chat-input" className="sr-only">
            Message
          </label>
          <input
            id="chat-input"
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={`Ask about finances as ${actorName}...`}
            disabled={loading}
            className="flex-1 rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
          />
          <Button type="submit" disabled={loading || !input.trim()}>
            Send
          </Button>
        </div>
      </form>
    </div>
  );
}

import Image from "next/image";
import { FormEvent, useEffect, useRef, useState } from "react";
import chatbotLogo from "@/logo.png";
import { MessageBubble } from "@/components/MessageBubble";

const quickActions = ["Admissions", "Courses", "Fee Structure", "Hostel", "Placements", "Contact"];

const API_ERROR_MESSAGE =
  "I could not process your request right now. Please try again in a moment.";

type Message = {
  id: number;
  role: "assistant" | "user";
  text: string;
  sources?: string[];
};

type ChatApiResponse = {
  answer?: string;
  sources?: string[];
  error?: string;
};

type ChatWindowProps = {
  isOpen: boolean;
  onMinimize: () => void;
  onClose: () => void;
};

export function ChatWindow({ isOpen, onMinimize, onClose }: ChatWindowProps) {
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 1,
      role: "assistant",
      text: "Welcome to Galgotias Admission Assistant. Choose a topic below or type your question."
    }
  ]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isLoading) {
      return;
    }

    setInput("");
    setMessages((current) => [
      ...current,
      { id: Date.now(), role: "user", text: trimmed }
    ]);
    setIsLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ message: trimmed })
      });

      const data = (await response.json()) as ChatApiResponse;

      if (!response.ok) {
        throw new Error(data.error || "Chat API request failed");
      }

      setMessages((current) => [
        ...current,
        {
          id: Date.now() + 1,
          role: "assistant",
          text: data.answer?.trim() || API_ERROR_MESSAGE,
          sources: data.sources ?? []
        }
      ]);
    } catch {
      setMessages((current) => [
        ...current,
        {
          id: Date.now() + 1,
          role: "assistant",
          text: API_ERROR_MESSAGE
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void sendMessage(input);
  };

  return (
    <section
      aria-label="Galgotias Admission Assistant"
      className={`fixed bottom-24 right-4 z-[69] flex h-[min(640px,calc(100vh-120px))] w-[calc(100vw-32px)] max-w-[390px] origin-bottom-right flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-[0_24px_70px_rgba(0,0,0,0.24)] transition duration-200 ease-out sm:right-6 ${
        isOpen ? "translate-y-0 scale-100 opacity-100" : "pointer-events-none translate-y-4 scale-95 opacity-0"
      }`}
    >
      <header className="flex min-h-[76px] items-center gap-3 bg-guRed px-4 text-white">
        <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full bg-white">
          <Image src={chatbotLogo} alt="Galgotias chatbot" fill sizes="44px" className="object-cover object-top" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-mont text-base font-semibold">Galgotias Admission Assistant</h2>
          <p className="text-xs text-white/80">Online admission help</p>
        </div>
        <button
          type="button"
          aria-label="Minimize chat"
          onClick={onMinimize}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-xl leading-none text-white transition hover:bg-white/15 focus:outline-none focus:ring-2 focus:ring-white/60"
        >
          -
        </button>
        <button
          type="button"
          aria-label="Close chat"
          onClick={onClose}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-xl leading-none text-white transition hover:bg-white/15 focus:outline-none focus:ring-2 focus:ring-white/60"
        >
          x
        </button>
      </header>

      <div className="flex-1 overflow-y-auto bg-[#f6f7f9] px-4 py-4">
        <div className="space-y-3">
          {messages.map((message) => (
            <MessageBubble key={message.id} role={message.role} sources={message.sources}>
              {message.text}
            </MessageBubble>
          ))}
          {isLoading ? (
            <MessageBubble role="assistant">Typing...</MessageBubble>
          ) : null}
          <div ref={messagesEndRef} />
        </div>

        <div className="mt-5">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.08em] text-neutral-500">Quick Actions</p>
          <div className="grid grid-cols-2 gap-2">
            {quickActions.map((action) => (
              <button
                type="button"
                key={action}
                onClick={() => void sendMessage(action)}
                className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-left text-sm font-medium text-neutral-800 shadow-sm transition hover:border-guRed hover:text-guRed focus:outline-none focus:ring-2 focus:ring-guRed/20"
              >
                {action}
              </button>
            ))}
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex items-center gap-2 border-t border-neutral-200 bg-white p-3">
        <input
          type="text"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Type your message..."
          disabled={isLoading}
          className="min-h-11 flex-1 rounded-full border border-neutral-300 px-4 text-sm outline-none transition placeholder:text-neutral-400 focus:border-guRed focus:ring-2 focus:ring-guRed/15"
        />
        <button
          type="submit"
          disabled={isLoading}
          className="min-h-11 shrink-0 rounded-full bg-guRed px-5 text-sm font-semibold text-white transition hover:bg-guDeep focus:outline-none focus:ring-4 focus:ring-guRed/20"
        >
          Send
        </button>
      </form>
    </section>
  );
}

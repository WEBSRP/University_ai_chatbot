import Image from "next/image";
import { FormEvent, useEffect, useRef, useState } from "react";
import chatbotLogo from "@/logo.png";
import { MessageBubble } from "@/components/MessageBubble";
import type { SourceLink } from "@/lib/sources";

type ChatAction = {
  label: string;
  prompt?: string;
  category?: string;
  subOptions?: ChatAction[];
};

const COURSE_DETAILS: ChatAction[] = [
  { label: "Eligibility", prompt: "eligibility", category: "courses" },
  { label: "Fee Structure", prompt: "fee structure", category: "courses" },
  { label: "Specializations", prompt: "specializations", category: "courses" },
];

const MENU_CONFIG: Record<string, ChatAction[]> = {
  Admissions: [
    { label: "Eligibility", prompt: "What is the eligibility criteria for admission?", category: "admissions" },
    { label: "Application Process", prompt: "How to apply for admission?", category: "admissions" },
    { label: "Required Documents", prompt: "What documents are required for admission?", category: "admissions" },
    { label: "Important Dates", prompt: "Admission important dates", category: "admissions" },
    { label: "Contact Admissions", prompt: "Contact Admissions office", category: "admissions" },
  ],
  Courses: [
    {
      label: "Undergraduate Programs",
      subOptions: [
        { label: "B.Tech", subOptions: COURSE_DETAILS.map(opt => ({ ...opt, prompt: `B.Tech ${opt.prompt}` })) },
        { label: "BBA", subOptions: COURSE_DETAILS.map(opt => ({ ...opt, prompt: `BBA ${opt.prompt}` })) },
        { label: "BCA", subOptions: COURSE_DETAILS.map(opt => ({ ...opt, prompt: `BCA ${opt.prompt}` })) },
        { label: "B.Com", subOptions: COURSE_DETAILS.map(opt => ({ ...opt, prompt: `B.Com ${opt.prompt}` })) },
        { label: "BA", subOptions: COURSE_DETAILS.map(opt => ({ ...opt, prompt: `BA ${opt.prompt}` })) },
        { label: "B.Sc", subOptions: COURSE_DETAILS.map(opt => ({ ...opt, prompt: `B.Sc ${opt.prompt}` })) },
      ],
    },
    {
      label: "Postgraduate Programs",
      subOptions: [
        { label: "M.Tech", subOptions: COURSE_DETAILS.map(opt => ({ ...opt, prompt: `M.Tech ${opt.prompt}` })) },
        { label: "MBA", subOptions: COURSE_DETAILS.map(opt => ({ ...opt, prompt: `MBA ${opt.prompt}` })) },
        { label: "MCA", subOptions: COURSE_DETAILS.map(opt => ({ ...opt, prompt: `MCA ${opt.prompt}` })) },
        { label: "M.Com", subOptions: COURSE_DETAILS.map(opt => ({ ...opt, prompt: `M.Com ${opt.prompt}` })) },
        { label: "M.Sc", subOptions: COURSE_DETAILS.map(opt => ({ ...opt, prompt: `M.Sc ${opt.prompt}` })) },
      ],
    },
    { label: "Diploma Programs", prompt: "List diploma programs", category: "courses" },
    { label: "Course Comparison", prompt: "How to compare courses?", category: "courses" },
  ],
  Fees: [
    { label: "Fee Structure", prompt: "What is the fee structure?", category: "fees" },
    { label: "Scholarship Information", prompt: "Scholarship information", category: "fees" },
    { label: "Payment Methods", prompt: "What are the payment methods for fees?", category: "fees" },
  ],
  Hostel: [
    { label: "Hostel Facilities", prompt: "What hostel facilities are available?", category: "hostel" },
    { label: "Hostel Fees", prompt: "What are the hostel fees?", category: "hostel" },
    { label: "Rules & Regulations", prompt: "Hostel rules and regulations", category: "hostel" },
  ],
  Placements: [
    { label: "Placement Statistics", prompt: "Latest placement statistics", category: "placements" },
    { label: "Recruiters", prompt: "Who are the top recruiters?", category: "placements" },
    { label: "Internship Opportunities", prompt: "Internship opportunities", category: "placements" },
  ],
  Scholarships: [
    { label: "Merit Scholarships", prompt: "Merit scholarships", category: "scholarships" },
    { label: "Need-Based Scholarships", prompt: "Need-based scholarships", category: "scholarships" },
    { label: "Eligibility Criteria", prompt: "Scholarship eligibility criteria", category: "scholarships" },
  ],
  Contact: [
    { label: "Admission Office", prompt: "Admission office contact details", category: "contact" },
    { label: "Email", prompt: "University email address", category: "contact" },
    { label: "Phone Numbers", prompt: "University phone numbers", category: "contact" },
    { label: "Campus Visit", prompt: "How to visit the campus?", category: "contact" },
  ],
};

const topicActions: ChatAction[] = Object.keys(MENU_CONFIG)
  .filter((topic) => topic !== "Scholarships")
  .map((topic) => ({
    label: topic,
    category: topic.toLowerCase(),
    subOptions: MENU_CONFIG[topic],
  }));

const API_ERROR_MESSAGE =
  "I could not process your request right now. Please try again in a moment.";

type Message = {
  id: number;
  role: "assistant" | "user";
  text: string;
  question?: string;
  sources?: SourceLink[];
  actions?: ChatAction[];
  feedback?: "positive" | "negative";
  showCallbackPrompt?: boolean;
  showCallbackForm?: boolean;
  callbackComplete?: boolean;
};

type ChatApiResponse = {
  answer?: string;
  sources?: SourceLink[];
  error?: string;
};

type FeedbackApiResponse = {
  ok?: boolean;
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
  const [callbackForms, setCallbackForms] = useState<
    Record<number, { name: string; phone: string; error: string; isSubmitting: boolean }>
  >({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 1,
      role: "assistant",
      text: "Welcome to Galgotias Admission Assistant. Choose a topic below or type your question.",
    }
  ]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const sendMessage = async (text: string, category?: string) => {
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
        body: JSON.stringify({ message: trimmed, category })
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
          question: trimmed,
          sources: data.sources ?? []
        }
      ]);
    } catch {
      setMessages((current) => [
        ...current,
        {
          id: Date.now() + 1,
          role: "assistant",
          text: API_ERROR_MESSAGE,
          question: trimmed,
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

  const showGuidedTopic = (action: ChatAction, isBack = false) => {
    if (action.subOptions) {
      const actionsWithBack: ChatAction[] = [
        ...action.subOptions,
        { label: "Back", category: "navigation" }
      ];

      setMessages((current) => [
        ...current,
        { id: Date.now(), role: "user", text: action.label },
        {
          id: Date.now() + 1,
          role: "assistant",
          text: isBack ? "Choose an option:" : `Please select an option for ${action.label}:`,
          actions: actionsWithBack,
        },
      ]);
    } else if (action.category === "navigation" && action.label === "Back") {
      setMessages((current) => [
        ...current,
        { id: Date.now(), role: "user", text: "Back" },
        {
          id: Date.now() + 1,
          role: "assistant",
          text: "Choose a topic below or type your question.",
        },
      ]);
    } else {
      void sendMessage(action.prompt ?? action.label, action.category);
    }
  };

  const submitFeedback = async (
    messageId: number,
    question: string,
    feedback: "positive" | "negative",
  ) => {
    setMessages((current) =>
      current.map((message) =>
        message.id === messageId
          ? {
              ...message,
              feedback,
              showCallbackPrompt: feedback === "negative",
              showCallbackForm: false,
            }
          : message,
      ),
    );

    if (feedback === "negative") {
      return;
    }

    try {
      await fetch("/api/feedback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ question, feedback }),
      });
    } catch {
      setMessages((current) =>
        current.map((message) =>
          message.id === messageId ? { ...message, feedback: undefined } : message,
        ),
      );
    }
  };

  const updateCallbackForm = (
    messageId: number,
    field: "name" | "phone",
    value: string,
  ) => {
    setCallbackForms((current) => ({
      ...current,
      [messageId]: {
        name: current[messageId]?.name ?? "",
        phone: current[messageId]?.phone ?? "",
        error: "",
        isSubmitting: false,
        [field]: value,
      },
    }));
  };

  const submitCallback = async (
    event: FormEvent<HTMLFormElement>,
    messageId: number,
    question: string,
  ) => {
    event.preventDefault();

    const form = callbackForms[messageId] ?? {
      name: "",
      phone: "",
      error: "",
      isSubmitting: false,
    };

    if (!isValidIndianMobile(form.phone)) {
      setCallbackForms((current) => ({
        ...current,
        [messageId]: {
          ...form,
          error: "Enter a valid Indian mobile number.",
          isSubmitting: false,
        },
      }));
      return;
    }

    setCallbackForms((current) => ({
      ...current,
      [messageId]: { ...form, error: "", isSubmitting: true },
    }));

    try {
      const response = await fetch("/api/callback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: form.name,
          phone: form.phone,
          question,
        }),
      });
      const data = (await response.json()) as FeedbackApiResponse;

      if (!response.ok) {
        throw new Error(data.error || "Could not save callback request");
      }

      setMessages((current) =>
        current.map((message) =>
          message.id === messageId
            ? {
                ...message,
                showCallbackPrompt: false,
                showCallbackForm: false,
                callbackComplete: true,
              }
            : message,
        ),
      );
      setCallbackForms((current) => ({
        ...current,
        [messageId]: {
          name: "",
          phone: "",
          error: "",
          isSubmitting: false,
        },
      }));
    } catch (error) {
      setCallbackForms((current) => ({
        ...current,
        [messageId]: {
          ...form,
          error:
            error instanceof Error
              ? error.message
              : "Could not save callback request.",
          isSubmitting: false,
        },
      }));
    }
  };

  const dismissCallback = (messageId: number) => {
    setMessages((current) =>
      current.map((message) =>
        message.id === messageId
          ? { ...message, showCallbackPrompt: false }
          : message,
      ),
    );
  };

  const openCallbackForm = (messageId: number) => {
    setMessages((current) =>
      current.map((message) =>
        message.id === messageId
          ? { ...message, showCallbackForm: true }
          : message,
      ),
    );
    setCallbackForms((current) => ({
      ...current,
      [messageId]: {
        name: current[messageId]?.name ?? "",
        phone: current[messageId]?.phone ?? "",
        error: current[messageId]?.error ?? "",
        isSubmitting: false,
      },
    }));
  };

  const showCallbackForm = (question: string) => {
    const messageId = Date.now() + 1;

    setMessages((current) => [
      ...current,
      { id: Date.now(), role: "user", text: "Request Callback" },
      {
        id: messageId,
        role: "assistant",
        text: "Please share your name and phone number.",
        question,
        showCallbackForm: true,
      },
    ]);
    setCallbackForms((current) => ({
      ...current,
      [messageId]: {
        name: "",
        phone: "",
        error: "",
        isSubmitting: false,
      },
    }));
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
            <div key={message.id}>
              <MessageBubble role={message.role} sources={message.sources}>
                {message.text}
              </MessageBubble>
              {message.role === "assistant" && message.actions?.length ? (
                <div className="ml-1 mt-2 flex max-w-[86%] flex-wrap gap-2">
                  {message.actions.map((action) => (
                    <button
                      type="button"
                      key={`${message.id}-${action.label}`}
                      onClick={() => showGuidedTopic(action)}
                      disabled={isLoading}
                      className="rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-800 shadow-sm transition hover:border-guRed hover:text-guRed focus:outline-none focus:ring-2 focus:ring-guRed/20 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              ) : null}
              {message.role === "assistant" && message.question ? (
                <div className="ml-1 mt-2 max-w-[86%]">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      aria-label="Positive feedback"
                      onClick={() =>
                        void submitFeedback(message.id, message.question ?? "", "positive")
                      }
                      disabled={message.feedback === "positive"}
                      className="grid h-8 w-8 place-items-center rounded-full border border-neutral-200 bg-white text-sm shadow-sm transition hover:border-guRed focus:outline-none focus:ring-2 focus:ring-guRed/20 disabled:cursor-not-allowed disabled:bg-guRed disabled:text-white"
                    >
                      👍
                    </button>
                    <button
                      type="button"
                      aria-label="Negative feedback"
                      onClick={() =>
                        void submitFeedback(message.id, message.question ?? "", "negative")
                      }
                      disabled={message.feedback === "negative"}
                      className="grid h-8 w-8 place-items-center rounded-full border border-neutral-200 bg-white text-sm shadow-sm transition hover:border-guRed focus:outline-none focus:ring-2 focus:ring-guRed/20 disabled:cursor-not-allowed disabled:bg-guRed disabled:text-white"
                    >
                      👎
                    </button>
                  </div>
                  {message.showCallbackPrompt || message.showCallbackForm ? (
                    <div className="mt-2 rounded-lg border border-neutral-200 bg-white p-3 shadow-sm">
                      {message.showCallbackPrompt ? (
                        <div className="mb-3 flex gap-2">
                          <button
                            type="button"
                            onClick={() => openCallbackForm(message.id)}
                            className="rounded-full bg-guRed px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-guDeep focus:outline-none focus:ring-2 focus:ring-guRed/25"
                          >
                            Request Callback
                          </button>
                          <button
                            type="button"
                            onClick={() => dismissCallback(message.id)}
                            className="rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 transition hover:border-guRed hover:text-guRed focus:outline-none focus:ring-2 focus:ring-guRed/20"
                          >
                            No Thanks
                          </button>
                        </div>
                      ) : null}
                      {message.showCallbackForm ? (
                        <form
                          onSubmit={(event) =>
                            void submitCallback(
                              event,
                              message.id,
                              message.question ?? "Request Callback",
                            )
                          }
                          className="space-y-2"
                        >
                          <input
                            type="text"
                            value={callbackForms[message.id]?.name ?? ""}
                            onChange={(event) =>
                              updateCallbackForm(message.id, "name", event.target.value)
                            }
                            placeholder="Name"
                            required
                            className="min-h-10 w-full rounded-lg border border-neutral-300 px-3 text-sm outline-none focus:border-guRed focus:ring-2 focus:ring-guRed/15"
                          />
                          <input
                            type="tel"
                            value={callbackForms[message.id]?.phone ?? ""}
                            onChange={(event) =>
                              updateCallbackForm(message.id, "phone", event.target.value)
                            }
                            placeholder="Phone Number"
                            required
                            className="min-h-10 w-full rounded-lg border border-neutral-300 px-3 text-sm outline-none focus:border-guRed focus:ring-2 focus:ring-guRed/15"
                          />
                          {callbackForms[message.id]?.error ? (
                            <p className="text-xs font-medium text-guRed">
                              {callbackForms[message.id]?.error}
                            </p>
                          ) : null}
                          <button
                            type="submit"
                            disabled={callbackForms[message.id]?.isSubmitting}
                            className="min-h-10 w-full rounded-lg bg-guRed px-3 text-sm font-semibold text-white transition hover:bg-guDeep focus:outline-none focus:ring-2 focus:ring-guRed/25 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            Submit
                          </button>
                        </form>
                      ) : null}
                    </div>
                  ) : message.callbackComplete ? (
                    <p className="mt-2 max-w-[86%] rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs font-medium text-neutral-800 shadow-sm">
                      Thank you. Our admissions team will contact you soon.
                    </p>
                  ) : callbackForms[message.id]?.error ? (
                    <p className="mt-2 text-xs font-medium text-guRed">
                      {callbackForms[message.id]?.error}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
          ))}
          {isLoading ? (
            <MessageBubble role="assistant">Typing...</MessageBubble>
          ) : null}
          <div ref={messagesEndRef} />
        </div>

        <div className="mt-5">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.08em] text-neutral-500">Quick Actions</p>
          <div className="grid grid-cols-2 gap-2">
            {topicActions.map((action) => (
              <button
                type="button"
                key={action.label}
                onClick={() => showGuidedTopic(action)}
                className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-left text-sm font-medium text-neutral-800 shadow-sm transition hover:border-guRed hover:text-guRed focus:outline-none focus:ring-2 focus:ring-guRed/20"
              >
                {action.label}
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

function isValidIndianMobile(phone: string): boolean {
  return /^(?:\+91[\s-]?|91[\s-]?)?[6-9]\d{9}$/.test(phone.replace(/[\s-]/g, ""));
}

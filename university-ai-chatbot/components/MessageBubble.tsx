import ReactMarkdown from "react-markdown";
import type { SourceLink } from "@/lib/sources";

type MessageBubbleProps = {
  role: "assistant" | "user";
  children: string;
  sources?: SourceLink[];
};

export function MessageBubble({ role, children, sources = [] }: MessageBubbleProps) {
  const isUser = role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[82%] rounded-2xl px-4 py-3 text-sm leading-5 shadow-sm ${
          isUser
            ? "rounded-br-md bg-guRed text-white"
            : "rounded-bl-md border border-neutral-200 bg-white text-neutral-800"
        }`}
      >
        {isUser ? (
          <div className="whitespace-pre-line">{children}</div>
        ) : (
          <ReactMarkdown
            components={{
              a: ({ children: linkChildren, ...props }) => (
                <a
                  {...props}
                  target="_blank"
                  rel="noreferrer"
                  className="text-guRed underline-offset-2 hover:underline"
                >
                  {linkChildren}
                </a>
              ),
            }}
          >
            {children}
          </ReactMarkdown>
        )}
        {!isUser && sources.length > 0 ? (
          <details className="mt-3 border-t border-neutral-200 pt-2">
            <summary className="inline-flex cursor-pointer list-none items-center gap-1 rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-xs font-semibold text-neutral-700 transition hover:border-guRed hover:text-guRed focus:outline-none focus:ring-2 focus:ring-guRed/20">
              <span aria-hidden="true">🔗</span>
              View Sources ({sources.length})
            </summary>
            <div className="mt-3 rounded-lg border border-neutral-200 bg-neutral-50 p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-neutral-500">
                Official Sources
              </p>
              <ul className="space-y-2">
                {sources.map((source) => (
                  <li key={source.url} className="text-xs leading-4">
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-start gap-2 font-medium text-guRed underline-offset-2 hover:underline"
                    >
                      <span aria-hidden="true">•</span>
                      <span>{source.title}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </details>
        ) : null}
      </div>
    </div>
  );
}

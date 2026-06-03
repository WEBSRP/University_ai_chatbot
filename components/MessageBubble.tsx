import ReactMarkdown from "react-markdown";

type MessageBubbleProps = {
  role: "assistant" | "user";
  children: string;
  sources?: string[];
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
          <div className="mt-3 space-y-1 border-t border-neutral-200 pt-2">
            {sources.map((source) => (
              <a
                key={source}
                href={source}
                target="_blank"
                rel="noreferrer"
                className="block break-words text-xs font-medium text-guRed underline-offset-2 hover:underline"
              >
                {source}
              </a>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

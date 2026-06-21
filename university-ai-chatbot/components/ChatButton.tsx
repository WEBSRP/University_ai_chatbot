import Image from "next/image";
import chatbotLogo from "@/logo.png";

type ChatButtonProps = {
  isOpen: boolean;
  onClick: () => void;
};

export function ChatButton({ isOpen, onClick }: ChatButtonProps) {
  return (
    <button
      type="button"
      aria-label={isOpen ? "Minimize admission assistant" : "Open admission assistant"}
      aria-expanded={isOpen}
      onClick={onClick}
      className="group fixed bottom-5 right-5 z-[70] grid h-16 w-16 place-items-center rounded-full bg-guRed shadow-[0_16px_36px_rgba(0,0,0,0.28)] transition duration-200 hover:-translate-y-0.5 hover:bg-guDeep focus:outline-none focus:ring-4 focus:ring-guRed/25 sm:bottom-6 sm:right-6"
    >
      <span className="absolute inset-0 rounded-full border border-white/25" />
      <span className="relative grid h-12 w-12 place-items-center overflow-hidden rounded-full bg-white">
        <Image src={chatbotLogo} alt="Galgotias chatbot" fill sizes="48px" className="object-cover object-top" />
      </span>
    </button>
  );
}

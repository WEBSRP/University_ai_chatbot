import { useState } from "react";
import { ChatButton } from "@/components/ChatButton";
import { ChatWindow } from "@/components/ChatWindow";

export function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <ChatWindow isOpen={isOpen} onMinimize={() => setIsOpen(false)} onClose={() => setIsOpen(false)} />
      <ChatButton isOpen={isOpen} onClick={() => setIsOpen((value) => !value)} />
    </>
  );
}

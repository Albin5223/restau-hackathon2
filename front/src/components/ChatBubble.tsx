"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

type MdProps = { children?: ReactNode };
type MdCodeProps = MdProps & { className?: string };
type MdAnchorProps = MdProps & { href?: string };

const MARKDOWN_COMPONENTS: Components = {
  p: ({ children }: MdProps) => <p className="mb-2 last:mb-0">{children}</p>,
  ul: ({ children }: MdProps) => <ul className="mb-2 list-disc pl-5 last:mb-0">{children}</ul>,
  ol: ({ children }: MdProps) => <ol className="mb-2 list-decimal pl-5 last:mb-0">{children}</ol>,
  li: ({ children }: MdProps) => <li className="mb-1 last:mb-0">{children}</li>,
  h1: ({ children }: MdProps) => <h1 className="mb-2 text-base font-bold">{children}</h1>,
  h2: ({ children }: MdProps) => <h2 className="mb-2 text-sm font-bold">{children}</h2>,
  h3: ({ children }: MdProps) => <h3 className="mb-1 text-sm font-semibold">{children}</h3>,
  strong: ({ children }: MdProps) => <strong className="font-semibold">{children}</strong>,
  em: ({ children }: MdProps) => <em className="italic">{children}</em>,
  code: ({ children, className }: MdCodeProps) => {
    const isInline = !className;
    return isInline ? (
      <code className="rounded bg-zinc-200 px-1 py-0.5 font-mono text-[12px] dark:bg-zinc-800">
        {children}
      </code>
    ) : (
      <code className="block overflow-x-auto rounded bg-zinc-200 p-2 font-mono text-[12px] dark:bg-zinc-800">
        {children}
      </code>
    );
  },
  pre: ({ children }: MdProps) => <pre className="mb-2 last:mb-0">{children}</pre>,
  a: ({ children, href }: MdAnchorProps) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-blue-600 underline dark:text-blue-400"
    >
      {children}
    </a>
  ),
  table: ({ children }: MdProps) => (
    <div className="my-2 overflow-x-auto">
      <table className="w-full border-collapse text-xs">{children}</table>
    </div>
  ),
  th: ({ children }: MdProps) => (
    <th className="border border-zinc-300 bg-zinc-200 px-2 py-1 text-left font-semibold dark:border-zinc-700 dark:bg-zinc-800">
      {children}
    </th>
  ),
  td: ({ children }: MdProps) => (
    <td className="border border-zinc-300 px-2 py-1 dark:border-zinc-700">{children}</td>
  ),
  hr: () => <hr className="my-2 border-zinc-300 dark:border-zinc-700" />,
  blockquote: ({ children }: MdProps) => (
    <blockquote className="my-2 border-l-2 border-zinc-400 pl-3 italic">{children}</blockquote>
  ),
};

type ChatRole = "user" | "assistant";

type ChatMessage = {
  role: ChatRole;
  content: string;
};

export function ChatBubble() {
  const [available, setAvailable] = useState<boolean | null>(null);
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/chat", { method: "GET" })
      .then((r) => r.json())
      .then((d: { available?: boolean }) => {
        if (!cancelled) setAvailable(!!d.available);
      })
      .catch(() => {
        if (!cancelled) setAvailable(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => inputRef.current?.focus(), 50);
    return () => window.clearTimeout(id);
  }, [open]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, loading]);

  async function send() {
    const trimmed = input.trim();
    if (!trimmed || loading) return;
    const next: ChatMessage[] = [...messages, { role: "user", content: trimmed }];
    setMessages(next);
    setInput("");
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });
      if (res.status === 503) {
        const data = await res.json().catch(() => ({}));
        if ((data as { available?: boolean }).available === false) {
          setAvailable(false);
          setOpen(false);
          return;
        }
      }
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Erreur ${res.status}${text ? ": " + text : ""}`);
      }
      const data = (await res.json()) as { message?: { content?: string } };
      const content = data.message?.content ?? "(réponse vide)";
      setMessages((m) => [...m, { role: "assistant", content }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue.");
    } finally {
      setLoading(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  }

  function reset() {
    setMessages([]);
    setError(null);
  }

  if (available !== true) return null;

  return (
    <>
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          aria-label="Ouvrir l'assistant"
          className="fixed bottom-32 right-5 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-zinc-900 text-white shadow-lg transition-transform hover:scale-105 dark:bg-zinc-100 dark:text-zinc-900"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-5 w-5"
          >
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
          </svg>
          <span className="absolute -top-1 -right-1 rounded-full bg-amber-500 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white shadow ring-2 ring-white dark:ring-zinc-950">
            beta
          </span>
        </button>
      ) : (
        <div className="fixed bottom-32 right-5 z-50 flex h-[36rem] w-[24rem] max-w-[calc(100vw-2.5rem)] flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-950">
          <header className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Assistant Restoptim</p>
                <span className="rounded-full bg-amber-500 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white">
                  beta
                </span>
              </div>
              <p className="text-[10px] uppercase tracking-wider text-zinc-500">Mistral · lecture + actions</p>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={reset}
                title="Effacer la conversation"
                className="rounded-md px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900"
              >
                Reset
              </button>
              <button
                onClick={() => setOpen(false)}
                aria-label="Fermer"
                className="rounded-md px-2 py-1 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900"
              >
                ✕
              </button>
            </div>
          </header>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
            {messages.length === 0 ? (
              <div className="space-y-2 text-xs text-zinc-500">
                <p>Demande-moi par exemple :</p>
                <ul className="list-disc space-y-1 pl-4">
                  <li>« Combien de tables sont libres ? »</li>
                  <li>« Quel est le prochain plat à dresser ? »</li>
                  <li>« Passe une commande de magret sur la table 3 »</li>
                  <li>« Libère la table 5 »</li>
                </ul>
              </div>
            ) : null}

            {messages.map((m, i) => (
              <div
                key={i}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] break-words rounded-lg px-3 py-2 text-sm ${
                    m.role === "user"
                      ? "whitespace-pre-wrap bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                      : "markdown-message bg-zinc-100 text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100"
                  }`}
                >
                  {m.role === "user" ? (
                    m.content
                  ) : (
                    <ReactMarkdown remarkPlugins={[remarkGfm]} components={MARKDOWN_COMPONENTS}>
                      {m.content}
                    </ReactMarkdown>
                  )}
                </div>
              </div>
            ))}

            {loading ? (
              <div className="flex justify-start">
                <div className="rounded-lg bg-zinc-100 px-3 py-2 text-sm text-zinc-500 dark:bg-zinc-900">
                  <span className="inline-block animate-pulse">…</span>
                </div>
              </div>
            ) : null}

            {error ? (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
                {error}
              </div>
            ) : null}
          </div>

          <div className="border-t border-zinc-200 p-3 dark:border-zinc-800">
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                rows={2}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                disabled={loading}
                placeholder="Pose ta question…"
                className="flex-1 resize-none rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-400 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
              />
              <button
                onClick={() => void send()}
                disabled={loading || input.trim().length === 0}
                className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-40 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                Envoyer
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

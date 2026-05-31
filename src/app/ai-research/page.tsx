'use client';

import React from 'react';
import { Send, Bot, User, Loader2, Sparkles } from 'lucide-react';
import { MarkdownRenderer } from '@/components/ui/markdown-renderer';

type ProductResult = {
  id: string;
  title: string;
  description: string;
  category: string | null;
  brand: string | null;
  productType: string | null;
  tags: string[];
  specifications: Record<string, any> | null;
  image: string | null;
  images: string[];
};

type ResearchResult = {
  summary: string;
  products: ProductResult[];
  sources: string[];
};

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content?: string;
  result?: ResearchResult;
  error?: string;
  isLoading?: boolean;
};

export default function AiResearchPage() {
  const [input, setInput] = React.useState('');
  const [messages, setMessages] = React.useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: 'Hello! I am your AI Research Assistant. Ask me about any product, technology, or comparison you need help with.',
    }
  ]);
  const [isLoading, setIsLoading] = React.useState(false);
  const messagesContainerRef = React.useRef<HTMLDivElement>(null);
  const isUserNearBottomRef = React.useRef(true);

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    const container = messagesContainerRef.current;
    if (!container) return;
    container.scrollTo({ top: container.scrollHeight, behavior });
  };

  const handleMessagesScroll = () => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;
    isUserNearBottomRef.current = distanceFromBottom < 120;
  };

  React.useEffect(() => {
    const lastMessage = messages[messages.length - 1];
    if (!lastMessage) return;

    // Avoid jumpy UX: do not force-scroll immediately on user submit/loading.
    if (lastMessage.role === 'user' || lastMessage.isLoading) return;

    if (isUserNearBottomRef.current) {
      scrollToBottom('smooth');
    }
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    const loadingMessageId = (Date.now() + 1).toString();
    setMessages((prev) => [
      ...prev,
      { id: loadingMessageId, role: 'assistant', isLoading: true },
    ]);

    let timeoutId: number | undefined;

    try {
      const controller = new AbortController();
      timeoutId = window.setTimeout(() => controller.abort(), 65000);

      const response = await fetch('/api/ai/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: userMessage.content }),
        signal: controller.signal,
      });

      const raw = await response.text();
      let data: any = null;

      try {
        data = raw ? JSON.parse(raw) : null;
      } catch {
        data = null;
      }

      setMessages((prev) => prev.filter(m => m.id !== loadingMessageId));

      if (!response.ok) {
        throw new Error(data?.error || `Failed to generate AI research. (${response.status})`);
      }

      if (!data || typeof data !== 'object') {
        throw new Error('AI service returned an empty response. Please try again.');
      }

      const result: ResearchResult = data;
      
      const assistantMessage: Message = {
        id: Date.now().toString(),
        role: 'assistant',
        result: result,
      };
      
      setMessages((prev) => [...prev, assistantMessage]);

    } catch (err: any) {
      setMessages((prev) => prev.filter(m => m.id !== loadingMessageId));

      const errorMessage = err?.name === 'AbortError'
        ? 'Request timed out. Please try again.'
        : err?.message || 'Something went wrong. Please try again.';

      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: 'assistant',
          error: errorMessage,
        },
      ]);
    } finally {
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-[calc(100vh-80px)] flex-col bg-slate-950 text-slate-200">
      <div className="pointer-events-none absolute inset-0 bg-[url('/noise.svg')] opacity-20" />
      
      {/* Header */}
      <header className="relative z-10 flex items-center justify-between border-b border-white/10 bg-slate-950/80 px-4 py-4 backdrop-blur-md sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-400">
            <Bot className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-white">AI Research Assistant</h1>
            <p className="text-xs text-slate-400">Powered by Gemini 2.5 Flash Lite</p>
          </div>
        </div>
      </header>

      {/* Messages Area */}
      <div
        ref={messagesContainerRef}
        onScroll={handleMessagesScroll}
        className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 scroll-smooth"
      >
        <div className="mx-auto max-w-4xl space-y-6">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex w-full gap-4 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {message.role === 'assistant' && (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-cyan-500/10 text-cyan-400">
                  <Sparkles className="h-4 w-4" />
                </div>
              )}

              <div
                className={`relative max-w-3xl rounded-2xl px-6 py-5 ${
                  message.role === 'user'
                    ? 'bg-cyan-600 text-white rounded-tr-sm'
                    : 'bg-slate-900 border border-white/10 text-slate-200 rounded-tl-sm'
                }`}
              >
                {message.isLoading ? (
                  <div className="flex items-center gap-2 text-cyan-400">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-xs font-medium">Analyzing...</span>
                  </div>
                ) : message.error ? (
                  <p className="text-rose-400">{message.error}</p>
                ) : message.content ? (
                  <MarkdownRenderer content={message.content} />
                ) : message.result ? (
                  <div className="space-y-6">
                    <div>
                      <h3 className="mb-2 font-semibold text-white">Research Summary</h3>
                      <MarkdownRenderer content={message.result.summary} />
                    </div>

                    {message.result.products && message.result.products.length > 0 && (
                      <div className="space-y-3">
                        <h4 className="font-medium text-slate-200">Recommended Products</h4>
                        <div className="grid gap-3 sm:grid-cols-2">
                          {message.result.products.slice(0, 4).map((product) => (
                            <div key={product.id} className="group relative overflow-hidden rounded-xl border border-white/10 bg-black/20 p-3 transition hover:border-cyan-500/30 hover:bg-cyan-500/5">
                              <div className="flex gap-3">
                                <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-slate-800">
                                  {product.image ? (
                                    <img src={product.image} alt={product.title} className="h-full w-full object-cover" />
                                  ) : (
                                    <div className="flex h-full w-full items-center justify-center text-slate-600">
                                      <Bot className="h-6 w-6" />
                                    </div>
                                  )}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <h5 className="truncate text-sm font-medium text-white">{product.title}</h5>
                                  <p className="mt-1 line-clamp-2 text-xs text-slate-400">{product.description}</p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : null}
              </div>

               {message.role === 'user' && (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-800 text-slate-400">
                  <User className="h-4 w-4" />
                </div>
              )}
            </div>
          ))}
          <div />
        </div>
      </div>

      {/* Input Area */}
      <div className="relative z-10 border-t border-white/10 bg-slate-950/80 p-4 backdrop-blur-md sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <form onSubmit={handleSubmit} className="relative flex items-center gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about a product, e.g., 'Best CCTV camera for outdoor use'..."
              className="flex-1 rounded-xl border border-white/10 bg-slate-900/50 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-cyan-500/50 focus:bg-slate-900 focus:outline-none focus:ring-1 focus:ring-cyan-500/50 transition-all"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              aria-label={isLoading ? 'Sending message' : 'Send message'}
              className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-600 text-white transition hover:bg-cyan-500 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-600"
            >
              {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
            </button>
          </form>
          <div className="mt-2 text-center">
             <p className="text-[10px] text-slate-500">AI can make mistakes. Please verify important information.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

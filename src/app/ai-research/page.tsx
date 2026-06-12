'use client';

import React from 'react';
import { Send, Bot, User, Loader2, Sparkles, Lock, ShieldCheck } from 'lucide-react';
import { MarkdownRenderer } from '@/components/ui/markdown-renderer';
import { TechStackAudit } from '@/components/ai-research/TechStackAudit';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

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
  const [showAudit, setShowAudit] = React.useState(true);
  const [isLocked, setIsLocked] = React.useState(false);
  const [leadVerified, setLeadVerified] = React.useState(false);
  const [showLeadGate, setShowLeadGate] = React.useState(false);
  const [leadData, setLeadData] = React.useState({ phone: '', email: '' });
  
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

  const handleAuditComplete = (selections: any) => {
    if (!leadVerified) {
      setShowLeadGate(true);
      return;
    }
    // Proceed to generate report
    const query = `Generate a technical telemetry report for an infrastructure with: ${selections.infrastructure}, ${selections.securityLevel}, and ${selections.connectivity}. Include architectural recommendations and budget optimization.`;
    void handleCustomSubmit(query);
    setShowAudit(false);
  };

  const handleCustomSubmit = async (query: string) => {
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: query,
    };
    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);
    // ... rest of the logic similar to handleSubmit but simplified for direct query
    const loadingMessageId = (Date.now() + 1).toString();
    setMessages((prev) => [...prev, { id: loadingMessageId, role: 'assistant', isLoading: true }]);
    
    try {
      const response = await fetch('/api/ai/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });
      const data = await response.json();
      setMessages((prev) => prev.filter(m => m.id !== loadingMessageId).concat({
        id: Date.now().toString(),
        role: 'assistant',
        result: data,
      }));
    } catch (err) {
      setMessages((prev) => prev.filter(m => m.id !== loadingMessageId).concat({
        id: Date.now().toString(),
        role: 'assistant',
        error: 'Failed to generate report. Please try again.',
      }));
    } finally {
      setIsLoading(false);
    }
  };

  const handleLeadVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    // Simulate WhatsApp OTP Verification
    setTimeout(() => {
      setLeadVerified(true);
      setShowLeadGate(false);
      setIsLoading(false);
      // Re-trigger audit completion
      setShowAudit(true); 
    }, 1500);
  };

  return (
    <div className="flex h-[calc(100vh-80px)] flex-col bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0 bg-noise opacity-20" />
      
      {/* Header */}
      <header className="relative z-10 flex items-center justify-between border-b border-border bg-background/80 px-4 py-4 backdrop-blur-md sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Bot className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-foreground">AI Research Assistant</h1>
            <p className="text-xs text-muted-foreground">Powered by Gemini 2.5 Flash Lite</p>
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
          {showAudit && messages.length === 1 && (
            <div className="mb-10">
              <TechStackAudit onComplete={handleAuditComplete} isLocked={showLeadGate} />
            </div>
          )}

          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex w-full gap-4 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {message.role === 'assistant' && (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Sparkles className="h-4 w-4" />
                </div>
              )}

              <div
                className={`relative max-w-3xl rounded-2xl px-6 py-5 ${
                  message.role === 'user'
                    ? 'bg-primary text-primary-foreground rounded-tr-sm'
                    : 'bg-card border border-border text-foreground rounded-tl-sm'
                }`}
              >
                {message.isLoading ? (
                  <div className="flex items-center gap-2 text-primary">
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
                      <h3 className="mb-2 font-semibold text-foreground">Research Summary</h3>
                      <MarkdownRenderer content={message.result.summary} />
                    </div>

                    {message.result.products && message.result.products.length > 0 && (
                      <div className="space-y-3">
                        <h4 className="font-medium text-foreground">Recommended Products</h4>
                        <div className="grid gap-3 sm:grid-cols-2">
                          {message.result.products.slice(0, 4).map((product) => (
                            <div key={product.id} className="group relative overflow-hidden rounded-xl border border-border bg-muted/40 p-3 transition hover:border-primary/30 hover:bg-primary/5">
                              <div className="flex gap-3">
                                <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-muted">
                                  {product.image ? (
                                    <img src={product.image} alt={product.title} className="h-full w-full object-cover" />
                                  ) : (
                                    <div className="flex h-full w-full items-center justify-center text-muted-foreground/60">
                                      <Bot className="h-6 w-6" />
                                    </div>
                                  )}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <h5 className="truncate text-sm font-medium text-foreground">{product.title}</h5>
                                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{product.description}</p>
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
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  <User className="h-4 w-4" />
                </div>
              )}
            </div>
          ))}
          <div />
        </div>
      </div>

      {/* Lead Gate Modal */}
      {showLeadGate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 backdrop-blur-xl p-4">
          <div className="w-full max-w-md rounded-3xl border border-border bg-card p-8 shadow-2xl">
            <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Lock className="h-7 w-7" />
            </div>
            <h3 className="mb-2 text-2xl font-bold text-foreground">Unlock Telemetry Report</h3>
            <p className="mb-8 text-sm text-muted-foreground leading-relaxed">
              We require corporate verification to share comprehensive architectural telemetry reports. Please provide your business contact details.
            </p>
            
            <form onSubmit={handleLeadVerification} className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Corporate Email</label>
                <Input 
                  required 
                  type="email" 
                  placeholder="name@company.com" 
                  className="bg-muted/50 border-border text-foreground h-12"
                  value={leadData.email}
                  onChange={(e) => setLeadData({ ...leadData, email: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Phone (for WhatsApp OTP)</label>
                <Input 
                  required 
                  type="tel" 
                  placeholder="+91 12345 67890" 
                  className="bg-muted/50 border-border text-foreground h-12"
                  value={leadData.phone}
                  onChange={(e) => setLeadData({ ...leadData, phone: e.target.value })}
                />
              </div>
              
              <Button 
                type="submit" 
                className="w-full h-14 bg-primary hover:bg-primary/90 text-primary-foreground text-lg font-bold mt-4"
                disabled={isLoading}
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-5 w-5 animate-spin" /> Verifying...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    Verify & Unlock Report <ShieldCheck className="h-5 w-5" />
                  </span>
                )}
              </Button>
              
              <button 
                type="button" 
                onClick={() => setShowLeadGate(false)}
                className="w-full py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel and return to chat
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="relative z-10 border-t border-border bg-background/80 p-4 backdrop-blur-md sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <form onSubmit={handleSubmit} className="relative flex items-center gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about a product, e.g., 'Best CCTV camera for outdoor use'..."
              className="flex-1 rounded-xl border border-border bg-muted px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:bg-card focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              aria-label={isLoading ? 'Sending message' : 'Send message'}
              className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground"
            >
              {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
            </button>
          </form>
          <div className="mt-2 text-center">
             <p className="text-[10px] text-muted-foreground">AI can make mistakes. Please verify important information.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

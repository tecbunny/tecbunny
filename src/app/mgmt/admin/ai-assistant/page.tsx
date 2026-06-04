'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';

type Message = {
  role: 'user' | 'assistant';
  content: string;
  data?: any;
};

export default function AIAssistantPage() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: 'Hello! I am your website AI assistant. Ask me about sales, leads, inventory, or analytics.' }
  ]);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setLoading(true);

    try {
      const res = await fetch('/api/admin/ai-query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: userMessage })
      });
      
      const data = await res.json();
      
      if (data.error) {
        setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${data.error}` }]);
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: data.answer, data: data.data }]);
      }
    } catch (err) {
      console.error('AI assistant query error:', err);
      setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, something went wrong.' }]);
    } finally {
      setLoading(false);
    }
  };

  const renderData = (data: any) => {
    if (!data) return null;

    if (data.type === 'orders' || data.type === 'orders_report') {
      return (
        <div className="mt-4 border rounded-md p-2 bg-background">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b">
                <th className="p-2">Order ID</th>
                <th className="p-2">Total</th>
                <th className="p-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.items?.map((item: any) => (
                <tr key={item.id} className="border-b last:border-0">
                  <td className="p-2 font-mono text-xs">{item.id.slice(0, 8)}...</td>
                  <td className="p-2">${item.total}</td>
                  <td className="p-2"><Badge variant="outline">{item.status}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    if (data.type === 'leads' || data.type === 'analytics_report') {
      return (
        <div className="mt-4 grid gap-2">
          {data.items?.map((item: any) => (
            <div key={item.id} className="border p-3 rounded-md bg-background flex justify-between items-center">
              <div>
                <p className="font-medium">{item.customer_name || 'Guest'}</p>
                <p className="text-xs text-muted-foreground">{item.type?.toUpperCase?.() || 'Lead'} - {item.status || 'new'}</p>
              </div>
              <div className="text-xs text-muted-foreground">
                {new Date(item.created_at).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>
      );
    }

    if (data.type === 'products' || data.type === 'analytics' || data.type === 'products_report') {
      return (
        <div className="mt-4 border rounded-md p-2 bg-background">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b">
                <th className="p-2">Product</th>
                {data.type === 'products' && <th className="p-2">Stock</th>}
                {(data.type === 'analytics' || data.type === 'products_report') && <th className="p-2">Views</th>}
              </tr>
            </thead>
            <tbody>
              {data.items?.map((item: any) => (
                <tr key={item.id} className="border-b last:border-0">
                  <td className="p-2">{item.title}</td>
                  {data.type === 'products' && <td className="p-2 text-red-500 font-bold">{item.stock}</td>}
                  {(data.type === 'analytics' || data.type === 'products_report') && <td className="p-2">{item.view_count ?? item.views ?? '-'}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    if (data.type === 'customers_report') {
      return (
        <div className="mt-4 grid gap-2">
          {data.items?.map((item: any) => (
            <div key={item.id} className="border p-3 rounded-md bg-background flex justify-between items-center">
              <div>
                <p className="font-medium">{item.name || item.email}</p>
                <p className="text-xs text-muted-foreground">{item.role || 'customer'}</p>
              </div>
              <div className="text-xs text-muted-foreground">
                {item.created_at ? new Date(item.created_at).toLocaleDateString() : ''}
              </div>
            </div>
          ))}
        </div>
      );
    }

    if (data.type === 'services_report') {
      return (
        <div className="mt-4 grid gap-2">
          {data.items?.map((item: any) => (
            <div key={item.id} className="border p-3 rounded-md bg-background flex justify-between items-center">
              <div>
                <p className="font-medium">{item.title}</p>
                <p className="text-xs text-muted-foreground">{item.is_active ? 'Active' : 'Inactive'}</p>
              </div>
            </div>
          ))}
        </div>
      );
    }

    if (data.type === 'related_products') {
      return (
        <div className="mt-4 grid gap-2">
          {data.items?.map((item: any) => (
            <div key={item.id} className="border p-3 rounded-md bg-background">
              <p className="font-medium">{item.title}</p>
              <p className="text-xs text-muted-foreground">{item.category || item.product_type || 'Product'}</p>
            </div>
          ))}
        </div>
      );
    }

    return <pre className="mt-2 text-xs bg-muted p-2 rounded">{JSON.stringify(data, null, 2)}</pre>;
  };

  return (
    <div className="h-[calc(100dvh-100px)] flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">AI Assistant</h2>
      </div>

      <Card className="flex-1 flex flex-col overflow-hidden">
        <CardContent className="flex-1 p-0 flex flex-col h-full">
          <ScrollArea className="flex-1 p-4">
            <div className="space-y-4">
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                    {msg.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                  </div>
                  <div className={`flex flex-col max-w-[80%] ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                    <div className={`rounded-lg px-4 py-2 ${msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                      {msg.content}
                    </div>
                    {msg.data && (
                      <div className="w-full max-w-md">
                        {renderData(msg.data)}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                    <Bot className="w-4 h-4" />
                  </div>
                  <div className="bg-muted rounded-lg px-4 py-2 flex items-center">
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Thinking...
                  </div>
                </div>
              )}
              <div ref={scrollRef} />
            </div>
          </ScrollArea>
          
          <div className="p-4 border-t bg-background">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="flex gap-2"
            >
              <Input
                placeholder="Ask about orders, customers, products, services, or analytics..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={loading}
              />
              <Button type="submit" disabled={loading || !input.trim()}>
                <Send className="w-4 h-4" />
                <span className="sr-only">Send</span>
              </Button>
            </form>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

'use client';

import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Megaphone, Mail, MessageCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { z } from 'zod';

const RawDataSchema = z.string().min(1, 'Raw data is required');

interface Contact {
  name: string;
  phone?: string;
  email?: string;
}

export default function PromotionalBroadcastPage() {
  const { toast } = useToast();
  const [campaignName, setCampaignName] = useState('');
  const [rawData, setRawData] = useState('');
  const [template, setTemplate] = useState('Hi {{NAME}},\n\nHere is your special offer: {{COUPON_CODE}}\n\nRegards,\nTecBunny Team');
  const [channel, setChannel] = useState<'WhatsApp' | 'Email'>('WhatsApp');
  const [isDispatching, setIsDispatching] = useState(false);
  const [parsedContacts, setParsedContacts] = useState<Contact[]>([]);
  const [activeCoupon, setActiveCoupon] = useState('BUNNY10');

  // Simple CSV/JSON parser
  const handleParse = () => {
    try {
      RawDataSchema.parse(rawData);
      
      const lines = rawData.split('\n').filter(l => l.trim().length > 0);
      const contacts: Contact[] = lines.map((line, index) => {
        // Attempt to parse JSON block first
        try {
          const parsed = JSON.parse(line);
          if (parsed.name) return { name: parsed.name, phone: parsed.phone, email: parsed.email };
        } catch {
          // Fallback to CSV (Name, Phone, Email)
        }

        const parts = line.split(',').map(p => p.trim());
        return {
          name: parts[0] || `Customer ${index + 1}`,
          phone: parts[1] || undefined,
          email: parts[2] || undefined,
        };
      });

      setParsedContacts(contacts);
      toast({ title: 'Data Parsed', description: `Successfully loaded ${contacts.length} contacts.` });
    } catch (e) {
      toast({ title: 'Parsing Error', description: 'Invalid data format. Please check your inputs.', variant: 'destructive' });
    }
  };

  const handleDispatch = async () => {
    if (!campaignName) {
      toast({ title: 'Validation', description: 'Campaign name is required', variant: 'destructive' });
      return;
    }
    if (parsedContacts.length === 0) {
      toast({ title: 'Validation', description: 'Please parse contacts first', variant: 'destructive' });
      return;
    }
    if (!template) {
      toast({ title: 'Validation', description: 'Template cannot be empty', variant: 'destructive' });
      return;
    }

    setIsDispatching(true);
    
    // Inject Coupon immediately for all, or rely on backend. Here we replace it before sending to backend for ease.
    const resolvedTemplate = template.replace(/{{COUPON_CODE}}/g, activeCoupon);

    try {
      const res = await fetch('/api/admin/marketing/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaignName,
          channelType: channel,
          template: resolvedTemplate,
          contacts: parsedContacts
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to dispatch');

      toast({
        title: 'Dispatch Initiated',
        description: `Campaign running in background. Log ID: ${data.logId}`,
      });
      
      // Reset form
      setRawData('');
      setParsedContacts([]);
      setCampaignName('');
    } catch (error: any) {
      toast({
        title: 'Dispatch Error',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setIsDispatching(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Megaphone className="h-8 w-8 text-indigo-600" />
            Promotional Broadcast Desk
          </h1>
          <p className="text-slate-500 mt-2">Execute high-velocity bulk marketing campaigns via WhatsApp or Email.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* LEFT PANEL: DATA INGESTION */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5 text-blue-500" />
              Target Audience
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Campaign Name</label>
              <input 
                type="text"
                placeholder="e.g. Summer Clearance Sale"
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
                className="w-full flex h-10 rounded-md border border-slate-300 bg-transparent px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium flex justify-between">
                Raw Data List 
                <span className="text-xs text-slate-500 font-normal">Format: Name, Phone, Email (Line separated)</span>
              </label>
              <textarea
                value={rawData}
                onChange={(e) => setRawData(e.target.value)}
                className="w-full h-48 rounded-md border border-slate-300 bg-slate-50 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
                placeholder="John Doe, 919876543210, john@example.com&#10;Jane Smith, 919876543211, jane@example.com"
              />
            </div>

            <Button 
              onClick={handleParse} 
              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
              variant="default"
            >
              Validate & Parse Contacts
            </Button>

            {parsedContacts.length > 0 && (
              <div className="p-3 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md text-sm flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                Ready to dispatch to {parsedContacts.length} verified contacts.
              </div>
            )}
          </CardContent>
        </Card>

        {/* RIGHT PANEL: TEMPLATE & DISPATCH */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Megaphone className="h-5 w-5 text-indigo-500" />
              Message Template & Channel
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            
            <div className="flex gap-4">
              <div 
                onClick={() => setChannel('WhatsApp')}
                className={`flex-1 flex flex-col items-center justify-center p-4 rounded-xl border-2 cursor-pointer transition-all ${channel === 'WhatsApp' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-200 hover:border-emerald-200'}`}
              >
                <MessageCircle className="h-6 w-6 mb-2" />
                <span className="font-semibold">WhatsApp</span>
              </div>
              <div 
                onClick={() => setChannel('Email')}
                className={`flex-1 flex flex-col items-center justify-center p-4 rounded-xl border-2 cursor-pointer transition-all ${channel === 'Email' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 hover:border-blue-200'}`}
              >
                <Mail className="h-6 w-6 mb-2" />
                <span className="font-semibold">Email</span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Inject Active Coupon Code</label>
              <select 
                value={activeCoupon}
                onChange={(e) => setActiveCoupon(e.target.value)}
                className="w-full flex h-10 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
              >
                <option value="BUNNY10">BUNNY10 - 10% Off Standard</option>
                <option value="FREESHIP">FREESHIP - Free Delivery</option>
                <option value="VIP20">VIP20 - 20% Premium Tier</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium flex justify-between">
                Template Builder
                <span className="text-xs text-slate-500 font-normal">Variables: {'{{NAME}}, {{COUPON_CODE}}'}</span>
              </label>
              <textarea
                value={template}
                onChange={(e) => setTemplate(e.target.value)}
                className="w-full h-40 rounded-md border border-slate-300 bg-white p-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
              />
            </div>

            <Button 
              onClick={handleDispatch} 
              disabled={isDispatching || parsedContacts.length === 0}
              className="w-full h-12 text-lg font-bold bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              {isDispatching ? (
                <><RefreshCw className="mr-2 h-5 w-5 animate-spin" /> Dispatching...</>
              ) : (
                <><Megaphone className="mr-2 h-5 w-5" /> Launch Campaign</>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

'use client';

import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Megaphone, RefreshCw, Send, CheckCircle2, XCircle } from 'lucide-react';
import { z } from 'zod';

const RawDataSchema = z.string().min(1, 'Data is required');

interface Contact {
  name: string;
  phone?: string;
  email?: string;
  status?: 'pending' | 'success' | 'failed';
  error?: string;
}

export default function BroadcastDeskPage() {
  const { toast } = useToast();
  const [campaignName, setCampaignName] = useState('');
  const [rawData, setRawData] = useState('');
  const [template, setTemplate] = useState('Hi {{NAME}},\n\nYour TecBunny infrastructure is ready. Use code {{COUPON_CODE}} to claim 15% off adjacent hardware upgrades.\n\nRegards,\nTecBunny Team');
  const [channel, setChannel] = useState<'whatsapp' | 'email'>('whatsapp');
  const [injectCoupon, setInjectCoupon] = useState(false);
  const [activeCoupon, setActiveCoupon] = useState('TB-CORP-15');
  const [isDispatching, setIsDispatching] = useState(false);
  const [parsedContacts, setParsedContacts] = useState<Contact[]>([]);
  const [lastLogId, setLastLogId] = useState<string | null>(null);

  const handleParse = () => {
    try {
      RawDataSchema.parse(rawData);
      
      const lines = rawData.split('\n').filter(l => l.trim().length > 0);
      const contacts: Contact[] = lines.map((line, index) => {
        const parts = line.split(',').map(p => p.trim());
        return {
          name: parts[0] || `Lead ${index + 1}`,
          phone: parts[1] || '',
          email: parts[2] || '',
          status: 'pending'
        };
      });

      setParsedContacts(contacts);
      toast({ title: 'Data Parsed', description: `Successfully mapped ${contacts.length} rows.` });
    } catch (e) {
      toast({ title: 'Parsing Error', description: 'Invalid data format.', variant: 'destructive' });
    }
  };

  const handleDispatch = async () => {
    if (!campaignName) {
      toast({ title: 'Validation', description: 'Campaign Name is required', variant: 'destructive' });
      return;
    }
    if (parsedContacts.length === 0) {
      toast({ title: 'Validation', description: 'Parse data before dispatch', variant: 'destructive' });
      return;
    }
    if (!template) {
      toast({ title: 'Validation', description: 'Template required', variant: 'destructive' });
      return;
    }

    setIsDispatching(true);
    
    const resolvedTemplate = injectCoupon ? template.replace(/{{COUPON_CODE}}/g, activeCoupon) : template;

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
      if (!res.ok) throw new Error(data.error || 'Dispatch execution failed');

      toast({
        title: 'Batch Dispatched',
        description: `Broadcast executing asynchronously. Check log ID: ${data.logId}`,
      });
      
      setLastLogId(data.logId);
      
      // Update UI state to show simulated dispatch start
      setParsedContacts(prev => prev.map(c => ({ ...c, status: 'success' })));

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
    <div className="p-6 max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
      {/* Left Column: Workspace */}
      <div className="space-y-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-blue-500/10 rounded-lg">
            <Megaphone className="h-6 w-6 text-blue-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">B2B Broadcast Desk</h1>
            <p className="text-sm text-slate-500">Secure high-velocity payload transmission workspace.</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Campaign Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-medium">Campaign Tag</label>
                <input 
                  type="text" 
                  value={campaignName}
                  onChange={e => setCampaignName(e.target.value)}
                  placeholder="e.g. Q3_NORTH_GOA_BLITZ" 
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Channel Pipeline</label>
                <select 
                  value={channel} 
                  onChange={e => setChannel(e.target.value as any)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="whatsapp">Infobip WhatsApp Routing</option>
                  <option value="email">SMTP Email Routing</option>
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">Data Arrays (Name, Phone, Email)</label>
              <textarea 
                rows={6}
                value={rawData}
                onChange={e => setRawData(e.target.value)}
                placeholder="Rajesh Kumar, 9876543210, rajesh@corp.com&#10;Amit Singh, 9123456780, amit@hotel.com"
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 font-mono"
              />
              <Button variant="secondary" className="w-full mt-2" onClick={handleParse}>
                Parse Matrix Vectors
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Right Column: Template & Telemetry */}
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Template Engineering</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <textarea 
              rows={5}
              value={template}
              onChange={e => setTemplate(e.target.value)}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 font-mono"
            />
            
            <div className="flex items-center gap-3 p-3 bg-slate-100 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
              <input type="checkbox" checked={injectCoupon} onChange={e => setInjectCoupon(e.target.checked)} className="h-4 w-4" />
              <span className="text-sm font-medium">Inject Active Coupon Code:</span>
              <input 
                type="text" 
                value={activeCoupon}
                onChange={e => setActiveCoupon(e.target.value)}
                disabled={!injectCoupon}
                className="h-8 rounded border px-2 text-sm font-mono w-32 disabled:opacity-50 bg-white dark:bg-black"
              />
            </div>

            <Button 
              onClick={handleDispatch} 
              disabled={isDispatching || parsedContacts.length === 0}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold h-12"
            >
              {isDispatching ? <RefreshCw className="mr-2 h-5 w-5 animate-spin" /> : <Send className="mr-2 h-5 w-5" />}
              {isDispatching ? 'Transmitting Payloads...' : 'Execute Batch Dispatch'}
            </Button>
          </CardContent>
        </Card>

        {parsedContacts.length > 0 && (
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-sm flex justify-between">
                <span>Execution Table</span>
                <span className="text-slate-500 font-normal">Rows: {parsedContacts.length}</span>
              </CardTitle>
            </CardHeader>
            <div className="max-h-[300px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 dark:bg-slate-900 sticky top-0">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium text-slate-500">Name</th>
                    <th className="px-4 py-2 text-left font-medium text-slate-500">Routing Key</th>
                    <th className="px-4 py-2 text-left font-medium text-slate-500">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {parsedContacts.map((contact, i) => (
                    <tr key={i}>
                      <td className="px-4 py-2 font-medium">{contact.name}</td>
                      <td className="px-4 py-2 font-mono text-xs">{channel === 'whatsapp' ? contact.phone : contact.email}</td>
                      <td className="px-4 py-2">
                        {contact.status === 'pending' && <span className="text-yellow-600 flex items-center gap-1 text-xs"><RefreshCw className="w-3 h-3" /> Queued</span>}
                        {contact.status === 'success' && <span className="text-green-600 flex items-center gap-1 text-xs"><CheckCircle2 className="w-3 h-3" /> Transmitted</span>}
                        {contact.status === 'failed' && <span className="text-red-600 flex items-center gap-1 text-xs"><XCircle className="w-3 h-3" /> Failed</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
'use client';

import React, { useState } from 'react';
import { Copy, Check, ExternalLink, Code, BarChart3, Globe, MousePointer2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface MarketingKitTerminalProps {
  referralCode: string;
  stats?: {
    views: number;
    clicks: number;
    conversions: number;
  };
}

export function MarketingKitTerminal({ referralCode, stats = { views: 0, clicks: 0, conversions: 0 } }: MarketingKitTerminalProps) {
  const [copied, setCopied] = useState(false);
  const embedCode = `<div data-tecbunny-widget data-ref-id="${referralCode}" data-variant="configurator"></div>\n<script src="https://tecbunny.com/embed/tecbunny-widget.js" async></script>`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(embedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card className="border-white/10 bg-slate-900/40 backdrop-blur-md overflow-hidden">
      <CardHeader className="border-b border-white/5 bg-white/5">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-xl font-bold text-white flex items-center gap-2">
              <Code className="h-5 w-5 text-cyan-400" /> Agent Marketing Kit
            </CardTitle>
            <CardDescription className="text-slate-400">
              Embed our high-converting configurator directly into your website.
            </CardDescription>
          </div>
          <Badge variant="outline" className="border-cyan-400/30 text-cyan-400 bg-cyan-400/10">
            v1.2 Public Release
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="pt-6">
        <Tabs defaultValue="embed" className="w-full">
          <TabsList className="grid w-full grid-cols-2 bg-slate-950/50 p-1 mb-6">
            <TabsTrigger value="embed" className="data-[state=active]:bg-cyan-500 data-[state=active]:text-slate-950">
              <Globe className="h-4 w-4 mr-2" /> Embed Snippet
            </TabsTrigger>
            <TabsTrigger value="analytics" className="data-[state=active]:bg-purple-500 data-[state=active]:text-white">
              <BarChart3 className="h-4 w-4 mr-2" /> Real-time Tracking
            </TabsTrigger>
          </TabsList>

          <TabsContent value="embed" className="space-y-4">
            <div className="rounded-xl border border-white/10 bg-slate-950 p-4 relative group">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">HTML Embed Snippet</span>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-8 text-cyan-400 hover:text-white hover:bg-white/5"
                  onClick={copyToClipboard}
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  <span className="ml-2 text-xs">{copied ? 'Copied' : 'Copy Code'}</span>
                </Button>
              </div>
              <pre className="text-xs font-mono text-cyan-100 overflow-x-auto p-2 bg-white/5 rounded-md leading-relaxed">
                {embedCode}
              </pre>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
              <div className="p-4 rounded-xl border border-white/5 bg-white/5">
                <h4 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
                  <ExternalLink className="h-4 w-4 text-slate-400" /> Preview Widget
                </h4>
                <p className="text-xs text-slate-400 mb-4">Test how the configurator looks with your referral ID.</p>
                <Button asChild variant="outline" size="sm" className="w-full border-white/10 text-slate-300">
                  <a href={`/embed/configurator?ref=${referralCode}`} target="_blank" rel="noopener noreferrer">
                    Open Preview Frame
                  </a>
                </Button>
              </div>
              <div className="p-4 rounded-xl border border-white/5 bg-white/5">
                <h4 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
                  <MousePointer2 className="h-4 w-4 text-slate-400" /> Custom Sub-tracking
                </h4>
                <p className="text-xs text-slate-400 mb-4">Append sub-tags to track different campaigns.</p>
                <div className="flex gap-2">
                  <Input 
                    placeholder="e.g. blog_sidebar" 
                    className="h-8 bg-white/5 border-white/10 text-xs" 
                  />
                  <Button size="sm" className="h-8 bg-cyan-400 text-slate-950 font-bold text-xs">
                    Apply
                  </Button>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="analytics">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              <div className="p-4 rounded-2xl border border-white/10 bg-white/5 text-center">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Total Views</p>
                <p className="text-3xl font-bold text-white">{stats.views.toLocaleString()}</p>
                <div className="mt-2 text-[10px] text-emerald-400 flex items-center justify-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" /> 
                  Live Interaction
                </div>
              </div>
              <div className="p-4 rounded-2xl border border-white/10 bg-white/5 text-center">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Config Clicks</p>
                <p className="text-3xl font-bold text-cyan-400">{stats.clicks.toLocaleString()}</p>
                <p className="mt-2 text-[10px] text-slate-400">CTR: {((stats.clicks / (stats.views || 1)) * 100).toFixed(1)}%</p>
              </div>
              <div className="p-4 rounded-2xl border border-white/10 bg-white/5 text-center">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Widget Leads</p>
                <p className="text-3xl font-bold text-purple-400">{stats.conversions.toLocaleString()}</p>
                <p className="mt-2 text-[10px] text-slate-400">Conversion: {((stats.conversions / (stats.clicks || 1)) * 100).toFixed(1)}%</p>
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-sm font-bold text-white uppercase tracking-tight">Recent Widget Conversions</h4>
                <Badge variant="outline" className="text-[10px] border-emerald-400/20 text-emerald-400">Real-time sync active</Badge>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between py-2 border-b border-white/5">
                  <div>
                    <p className="text-xs font-bold text-white">Residential IP Setup (8 Nodes)</p>
                    <p className="text-[10px] text-slate-400">Source: your-blog.com/security-tips</p>
                  </div>
                  <Badge className="bg-emerald-500/10 text-emerald-400 border-none text-[10px]">₹450.00 Comm.</Badge>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-white/5">
                  <div>
                    <p className="text-xs font-bold text-white">Industrial Surveillance Query</p>
                    <p className="text-[10px] text-slate-400">Source: LinkedIn Ad Campaign</p>
                  </div>
                  <Badge className="bg-amber-500/10 text-amber-400 border-none text-[10px]">Processing</Badge>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

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
    <Card className="border-border bg-card/40 backdrop-blur-md overflow-hidden">
      <CardHeader className="border-b border-border bg-muted/30">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-xl font-bold text-foreground flex items-center gap-2">
              <Code className="h-5 w-5 text-primary" /> Agent Marketing Kit
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              Embed our high-converting configurator directly into your website.
            </CardDescription>
          </div>
          <Badge variant="outline" className="border-primary/30 text-primary bg-primary/10">
            v1.2 Public Release
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="pt-6">
        <Tabs defaultValue="embed" className="w-full">
          <TabsList className="grid w-full grid-cols-2 bg-muted p-1 mb-6">
            <TabsTrigger value="embed" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Globe className="h-4 w-4 mr-2" /> Embed Snippet
            </TabsTrigger>
            <TabsTrigger value="analytics" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <BarChart3 className="h-4 w-4 mr-2" /> Real-time Tracking
            </TabsTrigger>
          </TabsList>
 
          <TabsContent value="embed" className="space-y-4">
            <div className="rounded-xl border border-border bg-muted/30 p-4 relative group">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">HTML Embed Snippet</span>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-8 text-primary hover:text-foreground hover:bg-muted"
                  onClick={copyToClipboard}
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  <span className="ml-2 text-xs">{copied ? 'Copied' : 'Copy Code'}</span>
                </Button>
              </div>
              <pre className="text-xs font-mono text-foreground overflow-x-auto p-2 bg-muted/20 rounded-md leading-relaxed">
                {embedCode}
              </pre>
            </div>
 
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
              <div className="p-4 rounded-xl border border-border bg-muted/20">
                <h4 className="text-sm font-bold text-foreground mb-2 flex items-center gap-2">
                  <ExternalLink className="h-4 w-4 text-muted-foreground" /> Preview Widget
                </h4>
                <p className="text-xs text-muted-foreground mb-4">Test how the configurator looks with your referral ID.</p>
                <Button asChild variant="outline" size="sm" className="w-full border-border text-muted-foreground">
                  <a href={`/embed/configurator?ref=${referralCode}`} target="_blank" rel="noopener noreferrer">
                    Open Preview Frame
                  </a>
                </Button>
              </div>
              <div className="p-4 rounded-xl border border-border bg-muted/20">
                <h4 className="text-sm font-bold text-foreground mb-2 flex items-center gap-2">
                  <MousePointer2 className="h-4 w-4 text-muted-foreground" /> Custom Sub-tracking
                </h4>
                <p className="text-xs text-muted-foreground mb-4">Append sub-tags to track different campaigns.</p>
                <div className="flex gap-2">
                  <Input 
                    placeholder="e.g. blog_sidebar" 
                    className="h-8 bg-muted/20 border-border text-xs text-foreground" 
                  />
                  <Button size="sm" className="h-8 bg-primary text-white font-bold text-xs hover:bg-primary/95">
                    Apply
                  </Button>
                </div>
              </div>
            </div>
          </TabsContent>
 
          <TabsContent value="analytics">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              <div className="p-4 rounded-2xl border border-border bg-muted/20 text-center">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Total Views</p>
                <p className="text-3xl font-bold text-foreground">{stats.views.toLocaleString()}</p>
                <div className="mt-2 text-[10px] text-primary flex items-center justify-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" /> 
                  Live Interaction
                </div>
              </div>
              <div className="p-4 rounded-2xl border border-border bg-muted/20 text-center">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Config Clicks</p>
                <p className="text-3xl font-bold text-primary">{stats.clicks.toLocaleString()}</p>
                <p className="mt-2 text-[10px] text-muted-foreground">CTR: {((stats.clicks / (stats.views || 1)) * 100).toFixed(1)}%</p>
              </div>
              <div className="p-4 rounded-2xl border border-border bg-muted/20 text-center">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Widget Leads</p>
                <p className="text-3xl font-bold text-primary">{stats.conversions.toLocaleString()}</p>
                <p className="mt-2 text-[10px] text-muted-foreground">Conversion: {((stats.conversions / (stats.clicks || 1)) * 100).toFixed(1)}%</p>
              </div>
            </div>
 
            <div className="rounded-xl border border-border bg-muted/20 p-4">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-sm font-bold text-foreground uppercase tracking-tight">Recent Widget Conversions</h4>
                <Badge variant="outline" className="text-[10px] border-primary/20 text-primary bg-primary/5">Real-time sync active</Badge>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between py-2 border-b border-border">
                  <div>
                    <p className="text-xs font-bold text-foreground">Residential IP Setup (8 Nodes)</p>
                    <p className="text-[10px] text-muted-foreground">Source: your-blog.com/security-tips</p>
                  </div>
                  <Badge className="bg-primary/10 text-primary border-none text-[10px]">₹450.00 Comm.</Badge>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-border">
                  <div>
                    <p className="text-xs font-bold text-foreground">Industrial Surveillance Query</p>
                    <p className="text-[10px] text-muted-foreground">Source: LinkedIn Ad Campaign</p>
                  </div>
                  <Badge className="bg-zinc-800 text-zinc-300 border-none text-[10px]">Processing</Badge>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

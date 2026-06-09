'use client';

import React from 'react';
import { Share2, Zap, Shield, Cpu, Network, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useViralAttribution } from '@/hooks/use-viral-attribution';
import { toast } from '@/hooks/use-toast';

interface BlueprintShowcaseProps {
  blueprint: any;
}

export function BlueprintShowcase({ blueprint }: BlueprintShowcaseProps) {
  const { config_payload: config, id } = blueprint;
  const { trackLanding } = useViralAttribution();

  React.useEffect(() => {
    trackLanding(id);
  }, [id, trackLanding]);

  const handleClonePlaceholder = () => {
    toast({ 
      title: 'Layout Customization Notice', 
      description: 'The automated catalog hardware matching system is under design development. Please contact our support to customize this setup.', 
      variant: 'default'
    });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-12 grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Visual Showcase Panel */}
      <div className="lg:col-span-2 space-y-8">
        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-slate-900/40 p-8 backdrop-blur-xl">
          <div className="absolute top-0 right-0 p-6 opacity-10">
            <Network className="w-64 h-64 text-cyan-400" />
          </div>
          
          <div className="relative z-10">
            <Badge className="bg-cyan-500/10 text-cyan-400 border-cyan-400/20 mb-4">Public Shared Blueprint</Badge>
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4 tracking-tight">
              {config.cameraCount}x Node {config.systemType} Architecture
            </h1>
            <p className="text-xl text-slate-400 max-w-2xl">
              Professional-grade security layout optimized for {config.premiseType} environments.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-12">
            {[
              { icon: Cpu, label: 'Resolution', value: config.resolution },
              { icon: Shield, label: 'Retention', value: config.storage },
              { icon: Network, label: 'Topology', value: config.cameraCount > 16 ? 'Multi-Switch' : 'Single-Node' },
              { icon: CheckCircle2, label: 'Compliance', value: 'Tier-1' }
            ].map((stat, i) => (
              <div key={i} className="p-4 rounded-2xl bg-white/5 border border-white/5">
                <stat.icon className="h-5 w-5 text-cyan-400 mb-2" />
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{stat.label}</p>
                <p className="text-lg font-bold text-white">{stat.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Technical Diagram Block */}
        <div className="rounded-3xl border border-white/10 bg-slate-950 p-8 overflow-hidden min-h-[400px] flex items-center justify-center relative">
          <div className="absolute inset-0 opacity-20 pointer-events-none bg-[radial-gradient(#22d3ee_1px,transparent_1px)] [background-size:20px_20px]" />
          <div className="text-center z-10">
            <Network className="h-16 w-16 text-cyan-400 mx-auto mb-4" />
            <h3 className="text-white text-lg">Logic Diagram: {config.systemType}</h3>
            <p className="text-slate-500 text-sm mt-2">Physical node distribution mapping.</p>
          </div>
        </div>
      </div>

      {/* Sidebar Inbound Conversion */}
      <div className="lg:col-span-1 space-y-6">
        <Card className="border-cyan-400/30 bg-cyan-400/5 backdrop-blur-md sticky top-28">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Zap className="h-5 w-5 text-yellow-400" /> Save Design Specification
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-sm text-slate-300 leading-relaxed">
              This technical layout is currently in view-only template mode. Request customization to have our engineers compile the precise bill of hardware for your site.
            </p>
            
            <div className="space-y-3">
              <Button onClick={handleClonePlaceholder} className="w-full bg-cyan-400 hover:bg-white text-slate-950 font-bold h-14 text-lg rounded-xl transition-all shadow-lg shadow-cyan-400/20">
                Request Layout Customization
              </Button>
              <Button variant="outline" className="w-full border-white/10 text-slate-300 h-12">
                <Share2 className="mr-2 h-4 w-4" /> Share Design Layout
              </Button>
            </div>

            <div className="pt-6 border-t border-white/10 space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-slate-800 border border-white/10 flex items-center justify-center text-xs text-white">PI</div>
                <div>
                  <p className="text-xs font-bold text-white">Creator: {blueprint.profiles?.name || 'Installer'}</p>
                  <p className="text-[10px] text-slate-500">System Design Engineer</p>
                </div>
              </div>
              <p className="text-[10px] text-slate-500 italic">
                CCTV design layouts are subject to final site survey dimensions and structural layout parameters.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

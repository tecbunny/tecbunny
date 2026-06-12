'use client';

import React, { useState } from 'react';
import { Shield, Server, Cpu, Globe, CheckCircle2, ChevronRight, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface TechStackAuditProps {
  onComplete: (data: any) => void;
  isLocked?: boolean;
}

export function TechStackAudit({ onComplete, isLocked = false }: TechStackAuditProps) {
  const [step, setStep] = useState(1);
  const [selections, setSelections] = useState({
    infrastructure: '',
    securityLevel: '',
    connectivity: '',
  });

  const handleNext = () => {
    if (step < 3) setStep(step + 1);
    else onComplete(selections);
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <div className="space-y-4">
            <h4 className="text-sm font-bold text-primary uppercase tracking-wider">Step 1: Infrastructure Profile</h4>
            <p className="text-xs text-muted-foreground">Select your current primary technology environment.</p>
            <div className="grid grid-cols-1 gap-3">
              {['On-Premise Legacy', 'Hybrid Cloud', 'Edge Computing', 'Multi-Site Enterprise'].map((opt) => (
                <button
                  key={opt}
                  onClick={() => setSelections({ ...selections, infrastructure: opt })}
                  className={`flex items-center justify-between rounded-xl border p-4 text-left transition-all ${selections.infrastructure === opt ? 'border-primary bg-primary/10 text-foreground font-semibold' : 'border-border bg-card text-muted-foreground hover:bg-muted/50'}`}
                >
                  <span className="text-sm font-medium">{opt}</span>
                  {selections.infrastructure === opt && <CheckCircle2 className="h-4 w-4 text-primary" />}
                </button>
              ))}
            </div>
          </div>
        );
      case 2:
        return (
          <div className="space-y-4">
            <h4 className="text-sm font-bold text-primary uppercase tracking-wider">Step 2: Security Criticality</h4>
            <p className="text-xs text-muted-foreground">Define the sensitivity of your operational data.</p>
            <div className="grid grid-cols-1 gap-3">
              {['Standard Monitoring', 'Regulatory Compliance (GDPR/SOC2)', 'High-Security / Defence', 'Public-Facing Retail'].map((opt) => (
                <button
                  key={opt}
                  onClick={() => setSelections({ ...selections, securityLevel: opt })}
                  className={`flex items-center justify-between rounded-xl border p-4 text-left transition-all ${selections.securityLevel === opt ? 'border-primary bg-primary/10 text-foreground font-semibold' : 'border-border bg-card text-muted-foreground hover:bg-muted/50'}`}
                >
                  <span className="text-sm font-medium">{opt}</span>
                  {selections.securityLevel === opt && <CheckCircle2 className="h-4 w-4 text-primary" />}
                </button>
              ))}
            </div>
          </div>
        );
      case 3:
        return (
          <div className="space-y-4">
            <h4 className="text-sm font-bold text-primary uppercase tracking-wider">Step 3: Network Resilience</h4>
            <p className="text-xs text-muted-foreground">How do your sites connect to the central hub?</p>
            <div className="grid grid-cols-1 gap-3">
              {['Fiber / Leased Line', '4G/5G Wireless WAN', 'Starlink / Satellite', 'Air-Gapped (No External Network)'].map((opt) => (
                <button
                  key={opt}
                  onClick={() => setSelections({ ...selections, connectivity: opt })}
                  className={`flex items-center justify-between rounded-xl border p-4 text-left transition-all ${selections.connectivity === opt ? 'border-primary bg-primary/10 text-foreground font-semibold' : 'border-border bg-card text-muted-foreground hover:bg-muted/50'}`}
                >
                  <span className="text-sm font-medium">{opt}</span>
                  {selections.connectivity === opt && <CheckCircle2 className="h-4 w-4 text-primary" />}
                </button>
              ))}
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-2xl backdrop-blur-sm">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Cpu className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-foreground">Tech-Stack Audit</h3>
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Architectural Assessment v2.5</p>
          </div>
        </div>
        <div className="flex gap-1">
          {[1, 2, 3].map((s) => (
            <div key={s} className={`h-1 w-8 rounded-full transition-all ${s <= step ? 'bg-primary' : 'bg-muted'}`} />
          ))}
        </div>
      </div>

      <div className="min-h-[300px]">
        {renderStep()}
      </div>

      <div className="mt-8 flex items-center justify-between border-t border-border pt-6">
        <p className="text-[10px] text-muted-foreground max-w-[200px]">
          Our AI will generate a tailored telemetry report based on these parameters.
        </p>
        <Button 
          onClick={handleNext}
          disabled={
            (step === 1 && !selections.infrastructure) ||
            (step === 2 && !selections.securityLevel) ||
            (step === 3 && !selections.connectivity)
          }
          className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
        >
          {step === 3 ? 'Generate Audit' : 'Next Step'} <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {isLocked && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-background/90 backdrop-blur-md p-6 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Lock className="h-8 w-8" />
          </div>
          <h4 className="mb-2 text-xl font-bold text-foreground">Report Access Locked</h4>
          <p className="mb-6 max-w-xs text-sm text-muted-foreground">
            Corporate authentication required. Please verify your identity via WhatsApp OTP to unlock this telemetry report.
          </p>
          <Button className="bg-emerald-600 hover:bg-emerald-700 text-white">
             Unlock with WhatsApp OTP
          </Button>
        </div>
      )}
    </div>
  );
}

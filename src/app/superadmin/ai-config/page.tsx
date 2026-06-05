'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  ShieldAlert, ArrowLeft, Terminal, Save, 
  RefreshCw, Cpu, Code, HelpCircle 
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const PROMPT_TYPES = [
  { 
    id: 'research', 
    name: 'AI Research Assistant', 
    variables: ['{query}', '{productContext}', '{sourceContext}'],
    description: 'Generates detailed overview and use-case reports for products.'
  },
  { 
    id: 'product_details', 
    name: 'Product Details Extractor', 
    variables: ['{schema}', '{existingData}', '{pageMetadata}', '{bodyText}'],
    description: 'Extracts structured database fields from raw web pages.'
  },
  { 
    id: 'generate_description', 
    name: 'HTML Description Copywriter', 
    variables: ['{title}', '{category}', '{brand}', '{model_number}', '{featureBlock}', '{hsnNote}', '{accent_color}', '{hsnSummaryNote}'],
    description: 'Generates highly styled HTML description fragments for e-commerce.'
  },
  { 
    id: 'ai_query', 
    name: 'Root Factual Query Assistant', 
    variables: ['{rawQuery}', '{contextData}'],
    description: 'Answers system/telemetry questions in the admin console.'
  },
  { 
    id: 'product_description', 
    name: 'E-commerce Brief Copywriter', 
    variables: ['{tone}', '{length}', '{productData}'],
    description: 'Writes simple marketing copy of specific tone/length.'
  },
  { 
    id: 'ai_add', 
    name: 'Raw Product Ingestion Engine', 
    variables: ['{imageNote}', '{rawInput}'],
    description: 'Parses raw supplier invoice texts and lists into DB columns.'
  }
];

export default function AiConfigConsole() {
  const [selectedPrompt, setSelectedPrompt] = useState(PROMPT_TYPES[0]);
  const [promptText, setPromptText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  const loadPrompt = async (promptId: string) => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/settings?key=ai_prompt_${promptId}`);
      if (response.ok) {
        const data = await response.json();
        setPromptText(data.value || '');
      } else {
        // Fall back to empty string (will let backend use static fallbacks)
        setPromptText('');
      }
    } catch (err) {
      console.error('Failed to load prompt settings:', err);
      setPromptText('');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPrompt(selectedPrompt.id);
  }, [selectedPrompt]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: `ai_prompt_${selectedPrompt.id}`,
          value: promptText,
          description: `Customized prompt override for ${selectedPrompt.name}`
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Write failed');
      }

      toast({
        title: 'Prompt Override Saved',
        description: `Custom ${selectedPrompt.name} template updated successfully.`,
      });
    } catch (err: any) {
      console.error('Save failed:', err);
      toast({
        title: 'Error Saving Prompt',
        description: err.message || 'Check database permissions.',
        variant: 'destructive'
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#020617] text-slate-100 flex flex-col font-sans relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-rose-500/5 rounded-full blur-[140px] pointer-events-none" />

      {/* Header */}
      <header className="border-b border-rose-500/20 bg-slate-950/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ShieldAlert className="h-6 w-6 text-rose-500" />
            <span className="font-semibold tracking-widest text-sm uppercase text-white">AI Engine Orchestrator</span>
          </div>
          <Link
            href="/superadmin/dashboard"
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Control Center
          </Link>
        </div>
      </header>

      {/* Dashboard View */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-6 py-10 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
          <div>
            <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
              <Cpu className="h-6 w-6 text-rose-500" />
              AI Prompt Orchestration
            </h2>
            <p className="text-slate-400 text-xs mt-1">
              Select an orchestrator template below to override static fallback models at runtime.
            </p>
          </div>
          <div className="flex gap-2">
            <select
              value={selectedPrompt.id}
              onChange={(e) => {
                const target = PROMPT_TYPES.find(p => p.id === e.target.value);
                if (target) setSelectedPrompt(target);
              }}
              className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:border-rose-500 outline-none"
            >
              {PROMPT_TYPES.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.name}
                </option>
              ))}
            </select>

            <button
              onClick={handleSave}
              disabled={isLoading || isSaving}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-bold text-sm tracking-wider uppercase text-white flex items-center gap-1.5 shadow-[0_0_15px_rgba(244,63,94,0.15)] transition-colors"
            >
              {isSaving ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Commit
            </button>
          </div>
        </div>

        {/* Editor Console */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 shadow-lg space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
                <span className="flex items-center gap-1">
                  <Terminal className="h-3.5 w-3.5 text-rose-500" />
                  ai_prompt_{selectedPrompt.id}
                </span>
                <span>UTF-8 Engine Template</span>
              </div>

              {isLoading ? (
                <div className="h-96 w-full bg-slate-900/40 rounded-lg border border-slate-900 flex items-center justify-center">
                  <RefreshCw className="h-8 w-8 text-rose-500 animate-spin" />
                </div>
              ) : (
                <textarea
                  value={promptText}
                  onChange={(e) => setPromptText(e.target.value)}
                  placeholder="Enter custom prompt system instructions here. Leave completely empty to use static codebase defaults."
                  className="w-full h-[450px] bg-slate-900/60 border border-slate-800 rounded-lg p-4 font-mono text-xs text-emerald-400 placeholder-slate-600 outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 resize-none transition-colors"
                />
              )}
              <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                <HelpCircle className="h-3 w-3" />
                <span>Tip: Leaving this empty forces the engine to fallback to its built-in code template.</span>
              </div>
            </div>
          </div>

          {/* Variables and Instructions Column */}
          <div className="space-y-6">
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 shadow-lg space-y-4">
              <h3 className="text-sm font-bold text-white tracking-wide flex items-center gap-1.5">
                <Code className="h-4 w-4 text-indigo-400" />
                Variable Injection
              </h3>
              <p className="text-slate-400 text-xs leading-relaxed">
                The AI parser expects these exact placeholders. Ensure you include them in your prompt so context can be injected at runtime:
              </p>
              <div className="flex flex-wrap gap-2">
                {selectedPrompt.variables.map((v) => (
                  <span 
                    key={v}
                    onClick={() => {
                      if (!isLoading) setPromptText(prev => prev + ' ' + v);
                    }}
                    className="font-mono text-xs px-2.5 py-1 rounded bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 cursor-pointer hover:bg-indigo-500/20 hover:border-indigo-500/40 transition-all"
                  >
                    {v}
                  </span>
                ))}
              </div>
              <div className="text-[10px] text-slate-500 leading-normal">
                Click a variable token above to append it directly to your editor cursor.
              </div>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 shadow-lg space-y-2">
              <h4 className="text-xs font-bold text-white tracking-wide uppercase">Orchestration Details</h4>
              <p className="text-slate-400 text-xs leading-relaxed">
                {selectedPrompt.description}
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

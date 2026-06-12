'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  ArrowLeft, Terminal, Save, 
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
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header Actions */}
      <div className="flex items-center justify-between">
        <Link
          href="/superadmin/mgmt/dashboard"
          className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Control Center
        </Link>
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800 pb-5">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Cpu className="h-6 w-6 text-primary" />
            AI Prompt Orchestration
          </h2>
          <p className="text-zinc-400 text-xs mt-1">
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
            className="bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:border-primary outline-none"
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
            className="px-4 py-2 bg-primary hover:bg-primary/95 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-bold text-sm tracking-wider uppercase text-white flex items-center gap-1.5 shadow-[0_0_15px_rgba(37,99,235,0.15)] transition-colors"
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
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5 shadow-lg space-y-3">
            <div className="flex items-center justify-between text-xs text-zinc-400 font-mono">
              <span className="flex items-center gap-1">
                <Terminal className="h-3.5 w-3.5 text-primary" />
                ai_prompt_{selectedPrompt.id}
              </span>
              <span>UTF-8 Engine Template</span>
            </div>

            {isLoading ? (
              <div className="h-[450px] w-full bg-zinc-950 rounded-lg border border-zinc-800 flex items-center justify-center">
                <RefreshCw className="h-8 w-8 text-primary animate-spin" />
              </div>
            ) : (
              <textarea
                value={promptText}
                onChange={(e) => setPromptText(e.target.value)}
                placeholder="Enter custom prompt system instructions here. Leave completely empty to use static codebase defaults."
                className="w-full h-[450px] bg-zinc-950 border border-zinc-800 rounded-lg p-4 font-mono text-xs text-primary placeholder-zinc-700 outline-none focus:border-primary focus:ring-1 focus:ring-primary resize-none transition-colors"
              />
            )}
            <div className="flex items-center gap-1.5 text-[10px] text-zinc-500">
              <HelpCircle className="h-3 w-3" />
              <span>Tip: Leaving this empty forces the engine to fallback to its built-in code template.</span>
            </div>
          </div>
        </div>

        {/* Variables and Instructions Column */}
        <div className="space-y-6">
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5 shadow-lg space-y-4">
            <h3 className="text-sm font-bold text-white tracking-wide flex items-center gap-1.5">
              <Code className="h-4 w-4 text-primary" />
              Variable Injection
            </h3>
            <p className="text-zinc-400 text-xs leading-relaxed">
              The AI parser expects these exact placeholders. Ensure you include them in your prompt so context can be injected at runtime:
            </p>
            <div className="flex flex-wrap gap-2">
              {selectedPrompt.variables.map((v) => (
                <span 
                  key={v}
                  onClick={() => {
                    if (!isLoading) setPromptText(prev => prev + ' ' + v);
                  }}
                  className="font-mono text-xs px-2.5 py-1 rounded bg-primary/10 border border-primary/20 text-primary cursor-pointer hover:bg-primary/20 hover:border-primary/40 transition-all"
                >
                  {v}
                </span>
              ))}
            </div>
            <div className="text-[10px] text-zinc-500 leading-normal">
              Click a variable token above to append it directly to your editor cursor.
            </div>
          </div>

          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5 shadow-lg space-y-2">
            <h4 className="text-xs font-bold text-white tracking-wide uppercase">Orchestration Details</h4>
            <p className="text-zinc-400 text-xs leading-relaxed">
              {selectedPrompt.description}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

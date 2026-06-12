'use client';

import React, { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import ClientCustomSetupFlow from '@/components/customised-setups/ClientCustomSetupFlow';

/**
 * Minimalist Embeddable Page for Configurator Widget
 * GET /embed/configurator?ref=AGENT_CODE
 */
function ConfiguratorEmbedContent() {
  const searchParams = useSearchParams();
  const referralCode = searchParams.get('ref') || '';
  
  return (
    <div className="bg-background min-h-screen p-4 text-foreground">
      <ClientCustomSetupFlow 
        blueprint={null} 
        variant="tech" 
        // Note: The CustomSetupFlow component should be updated to accept referralCode 
        // to pass it to the submission API.
      />
      
      {/* Script to communicate height changes to parent frame */}
      <script dangerouslySetInnerHTML={{ __html: `
        const resizeObserver = new ResizeObserver((entries) => {
          for (let entry of entries) {
            window.parent.postMessage({
              type: 'TECBUNNY_RESIZE',
              height: document.body.scrollHeight
            }, '*');
          }
        });
        resizeObserver.observe(document.body);
      `}} />
    </div>
  );
}

export default function ConfiguratorEmbedPage() {
  return (
    <Suspense fallback={<div className="bg-background min-h-screen animate-pulse" />}>
      <ConfiguratorEmbedContent />
    </Suspense>
  );
}

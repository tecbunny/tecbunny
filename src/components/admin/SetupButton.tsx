'use client';

import { useState } from 'react';

import { Loader2, CheckCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useToast } from '../../hooks/use-toast';
import { logger } from '@/lib/logger';

export function SetupButton() {
  const [isSettingUp, setIsSettingUp] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const { toast } = useToast();

  const handleSetup = async () => {
    setIsSettingUp(true);
    try {
      const response = await fetch('/api/admin/setup-sales-agents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Setup failed');
      }

      setIsComplete(true);
      toast({
        title: 'Setup Complete!',
        description: 'Sales Agent feature has been set up successfully. Refreshing page...',
      });

      // Refresh the page after a short delay
      setTimeout(() => {
        window.location.reload();
      }, 2000);

    } catch (error) {
      logger.error('Setup error in SetupButton', { error });
      toast({
        variant: 'destructive',
        title: 'Setup Failed',
        description: error instanceof Error ? error.message : 'An unknown error occurred',
      });
    } finally {
      setIsSettingUp(false);
    }
  };

  if (isComplete) {
    return (
      <Button disabled className="w-full sm:w-auto">
        <CheckCircle className="mr-2 h-4 w-4" />
        Setup Complete! Refreshing...
      </Button>
    );
  }

  return (
    <Button 
      onClick={handleSetup} 
      disabled={isSettingUp}
      className="w-full sm:w-auto"
    >
      {isSettingUp ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Setting up Sales Agent feature...
        </>
      ) : (
        'Set Up Sales Agent Feature'
      )}
    </Button>
  );
}
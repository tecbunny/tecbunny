'use client';

import React from 'react';

import { AlertTriangle, RefreshCw } from 'lucide-react';

import { logger } from '@/lib/logger';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: React.ErrorInfo;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<{ error: Error; retry: () => void }>;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    logger.error('ErrorBoundary caught an error', { error, errorInfo, context: 'ErrorBoundary.componentDidCatch' });

    this.setState({
      error,
      errorInfo
    });

    // Call optional error handler
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        const FallbackComponent = this.props.fallback;
        return <FallbackComponent error={this.state.error!} retry={this.handleRetry} />;
      }

      // Default error UI
      return (
        <Card className="max-w-md mx-auto mt-8 border-white/10 bg-slate-950/60 text-slate-100">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="p-3 bg-red-500/10 rounded-full">
                <AlertTriangle className="h-6 w-6 text-red-300" />
              </div>
            </div>
            <CardTitle className="text-xl text-red-300">Something went wrong</CardTitle>
            <CardDescription className="text-slate-300">
              An unexpected error occurred. Please try again or contact support if the problem persists.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <div className="p-3 bg-white/5 rounded border border-white/10">
                <p className="text-sm font-medium text-slate-200 mb-2">Error Details:</p>
                <pre className="text-xs text-slate-400 overflow-auto max-h-32">
                  {this.state.error.message}
                  {this.state.errorInfo?.componentStack && (
                    `\n\nComponent Stack:${  this.state.errorInfo.componentStack}`
                  )}
                </pre>
              </div>
            )}
            <Button onClick={this.handleRetry} className="w-full">
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
          </CardContent>
        </Card>
      );
    }

    return this.props.children;
  }
}

// Communication-specific error fallback
export function CommunicationErrorFallback({ error, retry }: { error: Error; retry: () => void }) {
  return (
    <Card className="max-w-md mx-auto mt-8 border-white/10 bg-slate-950/60 text-slate-100">
      <CardHeader className="text-center">
        <div className="flex justify-center mb-4">
          <div className="p-3 bg-orange-500/10 rounded-full">
            <AlertTriangle className="h-6 w-6 text-orange-300" />
          </div>
        </div>
        <CardTitle className="text-xl text-orange-300">Communication Error</CardTitle>
        <CardDescription className="text-slate-300">
          There was an issue with the communication system. This could be due to network connectivity or service availability.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="p-3 bg-orange-500/10 rounded border border-orange-500/20">
          <p className="text-sm text-orange-200">
            <strong>Possible causes:</strong>
          </p>
          <ul className="text-sm text-orange-700 mt-1 ml-4 list-disc">
            <li>Network connectivity issues</li>
            <li>SMS or Email service temporarily unavailable</li>
            <li>Database connection problems</li>
            <li>Invalid configuration settings</li>
          </ul>
        </div>

        {error?.message && (
          <div className="p-3 bg-orange-100 rounded border border-orange-200 text-xs text-orange-700">
            Details: {error.message}
          </div>
        )}
        
        <div className="flex space-x-2">
          <Button onClick={retry} className="flex-1">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
          <Button 
            variant="outline" 
            onClick={() => window.location.reload()} 
            className="flex-1"
          >
            Reload Page
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// Hook for error handling in functional components
export function useErrorHandler() {
  const handleError = React.useCallback((error: Error, errorInfo?: string) => {
    logger.error('Manual error report', { error, errorInfo, context: 'useErrorHandler.handleError' });

    // You can add error reporting service here
    // Example: Sentry, LogRocket, etc.
    
    // For now, just log to console
    if (process.env.NODE_ENV === 'development') {
      logger.error('Error details', {
        message: error.message,
        stack: error.stack,
        info: errorInfo,
        context: 'useErrorHandler.development'
      });
    }
  }, []);

  return handleError;
}
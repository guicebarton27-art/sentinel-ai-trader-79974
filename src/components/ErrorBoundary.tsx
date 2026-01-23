import { ReactNode } from 'react';
import { ErrorBoundary as ReactErrorBoundary, FallbackProps } from 'react-error-boundary';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface ErrorBoundaryProps {
  children: ReactNode;
}

const ErrorFallback = ({ error, resetErrorBoundary }: FallbackProps) => {
  const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md border-destructive/50">
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-6 w-6 text-destructive" />
            <CardTitle>Something went wrong</CardTitle>
          </div>
          <CardDescription>
            An unexpected error occurred. Please try refreshing the page.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {errorMessage && (
            <div className="bg-muted p-3 rounded text-sm font-mono overflow-auto max-h-32 text-destructive">
              {errorMessage}
            </div>
          )}
          <div className="flex gap-2">
            <Button
              onClick={resetErrorBoundary}
              variant="outline"
              className="flex-1"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
            <Button
              onClick={() => window.location.reload()}
              className="flex-1"
            >
              Refresh Page
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

const handleError = (error: Error, info: { componentStack?: string | null }) => {
  // Log to error tracking service in production
  if (import.meta.env.PROD) {
    // Could integrate with Sentry, LogRocket, etc.
    console.error('Application error:', {
      message: error.message,
      stack: error.stack,
      componentStack: info.componentStack,
    });
  }
};

export const ErrorBoundary = ({ children }: ErrorBoundaryProps) => {
  return (
    <ReactErrorBoundary
      FallbackComponent={ErrorFallback}
      onError={handleError}
      onReset={() => {
        // Reset app state if needed
        window.location.hash = '';
      }}
    >
      {children}
    </ReactErrorBoundary>
  );
};

export default ErrorBoundary;

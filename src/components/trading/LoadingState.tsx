import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2 } from 'lucide-react';

interface LoadingStateProps {
  title?: string;
  rows?: number;
}

export const LoadingState = ({ title, rows = 3 }: LoadingStateProps) => {
  return (
    <Card>
      <CardHeader>
        {title && <Skeleton className="h-6 w-48" />}
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </CardContent>
    </Card>
  );
};

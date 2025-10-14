import { TradingDashboard } from '@/components/TradingDashboard';
import { AuthGuard } from '@/components/auth/AuthGuard';

const Index = () => {
  return (
    <AuthGuard>
      <TradingDashboard />
    </AuthGuard>
  );
};

export default Index;

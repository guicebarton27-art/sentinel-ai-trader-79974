import { TradingDashboard } from '@/components/TradingDashboard';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';

const Index = () => {
  return (
    <ProtectedRoute>
      <TradingDashboard />
    </ProtectedRoute>
  );
};

export default Index;

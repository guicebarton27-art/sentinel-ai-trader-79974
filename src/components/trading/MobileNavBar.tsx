import { 
  LayoutDashboard, 
  TrendingUp, 
  Shield, 
  Settings,
  Activity
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface MobileNavBarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const NAV_ITEMS = [
  { id: 'home', icon: LayoutDashboard, label: 'Home' },
  { id: 'trades', icon: Activity, label: 'Trades' },
  { id: 'analytics', icon: TrendingUp, label: 'Analytics' },
  { id: 'risk', icon: Shield, label: 'Risk' },
  { id: 'settings', icon: Settings, label: 'Settings' },
];

export const MobileNavBar = ({ activeTab, onTabChange }: MobileNavBarProps) => {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 glass-panel border-t border-border/50 safe-area-bottom">
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={cn(
                "flex flex-col items-center justify-center gap-1 px-4 py-2 rounded-xl transition-all duration-200",
                "min-w-[64px] active:scale-95",
                isActive 
                  ? "text-primary" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <div className={cn(
                "p-1.5 rounded-lg transition-colors",
                isActive && "bg-primary/10"
              )}>
                <Icon className={cn(
                  "h-5 w-5 transition-transform",
                  isActive && "scale-110"
                )} />
              </div>
              <span className={cn(
                "text-[10px] font-medium transition-colors",
                isActive && "text-primary"
              )}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

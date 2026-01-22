import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface AutomationConfig {
  enabled: boolean;
  minProfitThreshold: number; // Minimum profit in USD to trigger execution
  minProfitPercentage: number; // Minimum profit percentage to trigger
  maxPositionSize: number; // Maximum position size in USD
  autoHedge: boolean; // Automatically create delta-neutral hedge
  hedgeMinFundingCapture: number; // Minimum daily funding to auto-hedge
  scanIntervalSeconds: number; // How often to scan for opportunities
  maxConcurrentExecutions: number; // Max simultaneous executions
  cooldownSeconds: number; // Cooldown between executions
  enabledTypes: {
    crossExchange: boolean;
    fundingRate: boolean;
  };
  enabledExchanges: string[];
  enabledSymbols: string[];
}

export interface AutomationStats {
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  totalProfit: number;
  hedgesCreated: number;
  lastExecutionTime: number | null;
  isRunning: boolean;
  currentExecutions: number;
}

interface ArbitrageOpportunity {
  id?: string;
  type: 'cross_exchange' | 'triangular' | 'funding_rate';
  exchanges: string[];
  symbol: string;
  buyExchange: string;
  sellExchange: string;
  buyPrice: number;
  sellPrice: number;
  spreadPercentage: number;
  estimatedProfit: number;
  volumeAvailable: number;
  feesEstimate: number;
  netProfit: number;
  fundingData?: any[];
  hedgeRecommendation?: {
    action: 'long_short' | 'short_long' | 'none';
    longExchange: string;
    shortExchange: string;
    expectedFundingCapture: number;
    holdPeriodHours: number;
  };
}

const DEFAULT_CONFIG: AutomationConfig = {
  enabled: false,
  minProfitThreshold: 10, // $10 minimum profit
  minProfitPercentage: 0.15, // 0.15% minimum spread after fees
  maxPositionSize: 10000, // $10,000 max position
  autoHedge: true,
  hedgeMinFundingCapture: 5, // $5/day minimum for auto-hedge
  scanIntervalSeconds: 30,
  maxConcurrentExecutions: 3,
  cooldownSeconds: 10,
  enabledTypes: {
    crossExchange: true,
    fundingRate: true,
  },
  enabledExchanges: ['kraken', 'binance', 'coinbase', 'bybit', 'okx'],
  enabledSymbols: ['BTC/USD', 'ETH/USD'],
};

const STORAGE_KEY = 'arbitrage-automation-config';

export function useArbitrageAutomation() {
  const [config, setConfig] = useState<AutomationConfig>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? { ...DEFAULT_CONFIG, ...JSON.parse(stored) } : DEFAULT_CONFIG;
    } catch {
      return DEFAULT_CONFIG;
    }
  });

  const [stats, setStats] = useState<AutomationStats>({
    totalExecutions: 0,
    successfulExecutions: 0,
    failedExecutions: 0,
    totalProfit: 0,
    hedgesCreated: 0,
    lastExecutionTime: null,
    isRunning: false,
    currentExecutions: 0,
  });

  const [opportunities, setOpportunities] = useState<ArbitrageOpportunity[]>([]);
  const [executionLog, setExecutionLog] = useState<Array<{
    id: string;
    timestamp: number;
    type: string;
    symbol: string;
    profit: number;
    status: 'success' | 'failed' | 'pending';
    message: string;
  }>>([]);

  const scanIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const cooldownRef = useRef<boolean>(false);
  const { toast } = useToast();

  // Persist config to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  }, [config]);

  const updateConfig = useCallback((updates: Partial<AutomationConfig>) => {
    setConfig(prev => ({ ...prev, ...updates }));
  }, []);

  const resetConfig = useCallback(() => {
    setConfig(DEFAULT_CONFIG);
  }, []);

  const addExecutionLog = useCallback((entry: Omit<typeof executionLog[0], 'id' | 'timestamp'>) => {
    setExecutionLog(prev => [
      { ...entry, id: crypto.randomUUID(), timestamp: Date.now() },
      ...prev.slice(0, 99), // Keep last 100 entries
    ]);
  }, []);

  // Check if opportunity meets automation criteria
  const meetsAutomationCriteria = useCallback((opp: ArbitrageOpportunity): boolean => {
    // Check type filter
    if (opp.type === 'cross_exchange' && !config.enabledTypes.crossExchange) return false;
    if (opp.type === 'funding_rate' && !config.enabledTypes.fundingRate) return false;

    // Check exchange filter
    const oppExchanges = [opp.buyExchange, opp.sellExchange];
    if (!oppExchanges.every(ex => config.enabledExchanges.includes(ex))) return false;

    // Check symbol filter
    if (!config.enabledSymbols.includes(opp.symbol)) return false;

    // Check profit thresholds
    if (opp.netProfit < config.minProfitThreshold) return false;
    if (opp.spreadPercentage < config.minProfitPercentage) return false;

    // Check position size
    if (opp.volumeAvailable * opp.buyPrice > config.maxPositionSize) return false;

    return true;
  }, [config]);

  // Execute a single opportunity
  const executeOpportunity = useCallback(async (opp: ArbitrageOpportunity): Promise<boolean> => {
    if (cooldownRef.current) {
      console.log('Execution in cooldown, skipping');
      return false;
    }

    if (stats.currentExecutions >= config.maxConcurrentExecutions) {
      console.log('Max concurrent executions reached');
      return false;
    }

    setStats(prev => ({ ...prev, currentExecutions: prev.currentExecutions + 1 }));
    cooldownRef.current = true;

    try {
      // Paper trade execution via edge function
      const { data, error } = await supabase.functions.invoke('multi-exchange-arbitrage', {
        body: { 
          action: 'auto_execute',
          opportunity: opp,
          config: {
            maxPositionSize: config.maxPositionSize,
            autoHedge: config.autoHedge,
            hedgeMinFundingCapture: config.hedgeMinFundingCapture,
          }
        }
      });

      if (error) throw error;

      if (data.success) {
        const executedProfit = data.execution?.actualProfit || opp.netProfit;
        
        setStats(prev => ({
          ...prev,
          totalExecutions: prev.totalExecutions + 1,
          successfulExecutions: prev.successfulExecutions + 1,
          totalProfit: prev.totalProfit + executedProfit,
          hedgesCreated: prev.hedgesCreated + (data.hedgeCreated ? 1 : 0),
          lastExecutionTime: Date.now(),
        }));

        addExecutionLog({
          type: opp.type,
          symbol: opp.symbol,
          profit: executedProfit,
          status: 'success',
          message: `Executed ${opp.type}: ${opp.buyExchange} → ${opp.sellExchange}`,
        });

        toast({
          title: "Auto-Execution Successful",
          description: `${opp.symbol}: +$${executedProfit.toFixed(2)} profit`,
        });

        return true;
      } else {
        throw new Error(data.error || 'Execution failed');
      }
    } catch (error: any) {
      setStats(prev => ({
        ...prev,
        totalExecutions: prev.totalExecutions + 1,
        failedExecutions: prev.failedExecutions + 1,
      }));

      addExecutionLog({
        type: opp.type,
        symbol: opp.symbol,
        profit: 0,
        status: 'failed',
        message: error.message || 'Unknown error',
      });

      console.error('Auto-execution failed:', error);
      return false;
    } finally {
      setStats(prev => ({ ...prev, currentExecutions: prev.currentExecutions - 1 }));
      
      setTimeout(() => {
        cooldownRef.current = false;
      }, config.cooldownSeconds * 1000);
    }
  }, [config, stats.currentExecutions, addExecutionLog, toast]);

  // Scan and auto-execute opportunities
  const scanAndExecute = useCallback(async () => {
    if (!config.enabled) return;

    try {
      const { data, error } = await supabase.functions.invoke('multi-exchange-arbitrage', {
        body: { action: 'scan' }
      });

      if (error) throw error;

      if (data.success && data.opportunities) {
        setOpportunities(data.opportunities);

        // Filter opportunities that meet criteria
        const eligibleOpps = data.opportunities.filter(meetsAutomationCriteria);

        // Execute top opportunities (up to max concurrent)
        const toExecute = eligibleOpps.slice(0, config.maxConcurrentExecutions - stats.currentExecutions);
        
        for (const opp of toExecute) {
          await executeOpportunity(opp);
        }
      }
    } catch (error) {
      console.error('Scan and execute error:', error);
    }
  }, [config, stats.currentExecutions, meetsAutomationCriteria, executeOpportunity]);

  // Start/stop automation
  const startAutomation = useCallback(() => {
    if (scanIntervalRef.current) return;

    setStats(prev => ({ ...prev, isRunning: true }));
    updateConfig({ enabled: true });

    // Initial scan
    scanAndExecute();

    // Set up interval
    scanIntervalRef.current = setInterval(scanAndExecute, config.scanIntervalSeconds * 1000);

    toast({
      title: "Automation Started",
      description: `Scanning every ${config.scanIntervalSeconds}s for opportunities`,
    });
  }, [config.scanIntervalSeconds, scanAndExecute, updateConfig, toast]);

  const stopAutomation = useCallback(() => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }

    setStats(prev => ({ ...prev, isRunning: false }));
    updateConfig({ enabled: false });

    toast({
      title: "Automation Stopped",
      description: "Automated execution has been disabled",
    });
  }, [updateConfig, toast]);

  const toggleAutomation = useCallback(() => {
    if (stats.isRunning) {
      stopAutomation();
    } else {
      startAutomation();
    }
  }, [stats.isRunning, startAutomation, stopAutomation]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (scanIntervalRef.current) {
        clearInterval(scanIntervalRef.current);
      }
    };
  }, []);

  // Resume automation if it was enabled
  useEffect(() => {
    if (config.enabled && !stats.isRunning && !scanIntervalRef.current) {
      startAutomation();
    }
  }, []);

  return {
    config,
    updateConfig,
    resetConfig,
    stats,
    opportunities,
    executionLog,
    startAutomation,
    stopAutomation,
    toggleAutomation,
    meetsAutomationCriteria,
    executeOpportunity,
    scanAndExecute,
  };
}

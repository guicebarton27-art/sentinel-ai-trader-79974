import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Brain, 
  Sparkles, 
  Send, 
  Zap, 
  Target, 
  TrendingUp, 
  TrendingDown,
  Activity,
  Eye,
  Cpu,
  Radio,
  Waves,
  CircleDot,
  ArrowUpRight,
  ArrowDownRight,
  Loader2,
  Bot,
  MessageSquare,
  Lightbulb
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTicker } from "@/hooks/useMarketData";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface NeuralSignal {
  id: string;
  type: "bullish" | "bearish" | "neutral";
  source: string;
  confidence: number;
  message: string;
  timestamp: Date;
}

interface ThinkingStep {
  step: string;
  status: "pending" | "active" | "complete";
  result?: string;
}

export const AICommandCenter = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "I'm Sentinel AI, your autonomous trading copilot. I'm analyzing markets 24/7 and can explain my decisions, provide insights, or execute commands. What would you like to know?",
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [thinkingSteps, setThinkingSteps] = useState<ThinkingStep[]>([]);
  const [neuralSignals, setNeuralSignals] = useState<NeuralSignal[]>([]);
  const [brainActivity, setBrainActivity] = useState(50);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Real market data for neural activity
  const { ticker } = useTicker({ symbol: 'BTC/USD', refreshInterval: 5000 });

  // Update brain activity based on real market volatility
  useEffect(() => {
    if (ticker) {
      // Calculate activity based on price change magnitude
      const changePercent = Math.abs(ticker.change24h || 0);
      const newActivity = Math.min(100, Math.max(20, 50 + changePercent * 10));
      setBrainActivity(newActivity);
    }
  }, [ticker]);

  // Generate neural signals from real market data and bot events
  useEffect(() => {
    const fetchRealSignals = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Fetch recent bot events as signals
        const { data: events } = await supabase
          .from('bot_events')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(5);

        // Fetch recent sentiment data
        const { data: sentiment } = await supabase
          .from('sentiment_data')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(3);

        const signals: NeuralSignal[] = [];

        // Add signals from bot events
        if (events) {
          events.forEach(event => {
            const type = event.event_type === 'fill' || event.event_type === 'order' 
              ? (event.payload as { decision?: { side?: string } })?.decision?.side === 'buy' ? 'bullish' : 'bearish'
              : 'neutral';
            
            signals.push({
              id: event.id,
              type,
              source: `Bot ${event.event_type}`,
              confidence: Math.min(95, 50 + Math.abs(event.bot_pnl || 0)),
              message: event.message,
              timestamp: new Date(event.created_at)
            });
          });
        }

        // Add signals from sentiment data
        if (sentiment) {
          sentiment.forEach(s => {
            signals.push({
              id: s.id,
              type: s.sentiment_score > 0.2 ? 'bullish' : s.sentiment_score < -0.2 ? 'bearish' : 'neutral',
              source: s.source,
              confidence: Math.round((s.confidence || 0.5) * 100),
              message: s.trend || 'Market sentiment analysis',
              timestamp: new Date(s.created_at || Date.now())
            });
          });
        }

        // Add live price signal
        if (ticker) {
          signals.unshift({
            id: `ticker-${Date.now()}`,
            type: (ticker.change24h || 0) > 0.5 ? 'bullish' : (ticker.change24h || 0) < -0.5 ? 'bearish' : 'neutral',
            source: 'Price Action',
            confidence: Math.min(95, 50 + Math.abs(ticker.change24h || 0) * 5),
            message: `BTC ${(ticker.change24h || 0) >= 0 ? '+' : ''}${(ticker.change24h || 0).toFixed(2)}% @ $${ticker.price.toLocaleString()}`,
            timestamp: new Date()
          });
        }

        if (signals.length > 0) {
          setNeuralSignals(signals.slice(0, 10));
        }
      } catch (err) {
        console.error('Error fetching signals:', err);
      }
    };

    fetchRealSignals();
    const interval = setInterval(fetchRealSignals, 10000);
    return () => clearInterval(interval);
  }, [ticker]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const simulateThinking = async () => {
    const steps: ThinkingStep[] = [
      { step: "Parsing intent...", status: "pending" },
      { step: "Analyzing market context...", status: "pending" },
      { step: "Querying neural networks...", status: "pending" },
      { step: "Synthesizing response...", status: "pending" }
    ];

    setThinkingSteps(steps);

    for (let i = 0; i < steps.length; i++) {
      await new Promise(r => setTimeout(r, 300 + Math.random() * 400));
      setThinkingSteps(prev => prev.map((s, idx) => ({
        ...s,
        status: idx === i ? "active" : idx < i ? "complete" : "pending"
      })));
    }

    await new Promise(r => setTimeout(r, 200));
    setThinkingSteps(prev => prev.map(s => ({ ...s, status: "complete" })));
  };

  const sendMessage = async () => {
    if (!input.trim() || isThinking) return;

    const userMessage: Message = {
      role: "user",
      content: input,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsThinking(true);

    try {
      await simulateThinking();

      const { data, error } = await supabase.functions.invoke("ai-copilot", {
        body: { 
          messages: [...messages, userMessage].map(m => ({
            role: m.role,
            content: m.content
          })),
          context: {
            neuralSignals: neuralSignals.slice(0, 5),
            brainActivity,
            currentPrice: ticker?.price,
            priceChange: ticker?.change24h
          }
        }
      });

      if (error) throw error;

      const assistantMessage: Message = {
        role: "assistant",
        content: data?.response || `Based on current market data, BTC is trading at $${ticker?.price?.toLocaleString() || 'N/A'} with ${(ticker?.change24h || 0) >= 0 ? '+' : ''}${(ticker?.change24h || 0).toFixed(2)}% change. My neural analysis is processing ${neuralSignals.length} active signals.`,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error("AI Copilot error:", error);
      // Fallback with real data
      const priceInfo = ticker ? `BTC at $${ticker.price.toLocaleString()} (${(ticker.change24h || 0) >= 0 ? '+' : ''}${(ticker.change24h || 0).toFixed(2)}%)` : 'Market data loading...';
      
      setMessages(prev => [...prev, {
        role: "assistant",
        content: `Current status: ${priceInfo}. I've processed ${neuralSignals.length} signals with an average confidence of ${neuralSignals.length > 0 ? Math.round(neuralSignals.reduce((sum, s) => sum + s.confidence, 0) / neuralSignals.length) : 0}%. Brain activity is at ${brainActivity.toFixed(0)}%.`,
        timestamp: new Date()
      }]);
    } finally {
      setIsThinking(false);
      setThinkingSteps([]);
    }
  };

  const getSignalColor = (type: string) => {
    switch (type) {
      case "bullish": return "text-success";
      case "bearish": return "text-destructive";
      default: return "text-muted-foreground";
    }
  };

  const getSignalIcon = (type: string) => {
    switch (type) {
      case "bullish": return <ArrowUpRight className="h-3 w-3" />;
      case "bearish": return <ArrowDownRight className="h-3 w-3" />;
      default: return <Activity className="h-3 w-3" />;
    }
  };

  return (
    <Card className="relative overflow-hidden border-primary/20 bg-gradient-to-br from-background via-background to-primary/5">
      {/* Animated background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-64 h-64 bg-primary/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-48 h-48 bg-accent/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: "1s" }} />
        
        {/* Neural network visualization */}
        <svg className="absolute inset-0 w-full h-full opacity-10">
          {[...Array(8)].map((_, i) => (
            <circle
              key={i}
              cx={`${15 + (i % 4) * 25}%`}
              cy={`${20 + Math.floor(i / 4) * 60}%`}
              r="3"
              fill="currentColor"
              className="text-primary animate-pulse"
              style={{ animationDelay: `${i * 0.2}s` }}
            />
          ))}
          {[...Array(12)].map((_, i) => (
            <line
              key={`line-${i}`}
              x1={`${15 + (i % 4) * 25}%`}
              y1="20%"
              x2={`${15 + ((i + 1) % 4) * 25}%`}
              y2="80%"
              stroke="currentColor"
              strokeWidth="0.5"
              className="text-primary/50"
            />
          ))}
        </svg>
      </div>

      <CardHeader className="relative pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-primary to-accent">
                <Brain className="h-6 w-6 text-white" />
              </div>
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-success rounded-full animate-pulse" />
            </div>
            <div>
              <CardTitle className="text-xl flex items-center gap-2">
                AI Command Center
                <Sparkles className="h-4 w-4 text-primary animate-pulse" />
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                {ticker ? `BTC $${ticker.price.toLocaleString()}` : 'Neural Trading Intelligence v2.0'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Brain activity indicator */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary/50 border border-border/50">
              <Cpu className="h-4 w-4 text-primary animate-pulse" />
              <div className="w-16 h-2 bg-secondary rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-primary to-accent transition-all duration-500"
                  style={{ width: `${brainActivity}%` }}
                />
              </div>
              <span className="text-xs font-mono text-muted-foreground">{brainActivity.toFixed(0)}%</span>
            </div>

            <Badge variant="outline" className="gap-1.5 bg-success/10 text-success border-success/30">
              <Radio className="h-3 w-3 animate-pulse" />
              LIVE
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="relative space-y-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Neural Signals Feed */}
          <div className="lg:col-span-1 space-y-3">
            <div className="flex items-center gap-2">
              <Waves className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold">Neural Signals</span>
              <Badge variant="secondary" className="text-xs">{neuralSignals.length}</Badge>
            </div>
            
            <ScrollArea className="h-[300px] pr-2">
              <div className="space-y-2">
                {neuralSignals.length === 0 ? (
                  <div className="text-center text-sm text-muted-foreground py-8">
                    <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    Loading signals...
                  </div>
                ) : (
                  neuralSignals.map((signal, idx) => (
                    <div 
                      key={signal.id}
                      className={`p-2.5 rounded-lg border transition-all duration-300 ${
                        idx === 0 ? 'bg-primary/5 border-primary/30 scale-[1.02]' : 'bg-secondary/30 border-border/30'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className={`flex items-center gap-1.5 ${getSignalColor(signal.type)}`}>
                          {getSignalIcon(signal.type)}
                          <span className="text-xs font-semibold uppercase">{signal.type}</span>
                        </div>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                          {signal.confidence}%
                        </Badge>
                      </div>
                      <p className="text-xs text-foreground">{signal.message}</p>
                      <p className="text-[10px] text-muted-foreground mt-1">{signal.source}</p>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>

          {/* AI Chat Interface */}
          <div className="lg:col-span-2 space-y-3">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold">AI Copilot</span>
              {isThinking && (
                <Badge variant="secondary" className="gap-1 text-xs animate-pulse">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Thinking
                </Badge>
              )}
            </div>

            <div className="relative">
              <ScrollArea className="h-[220px] pr-4 rounded-lg bg-secondary/20 p-3" ref={scrollRef}>
                <div className="space-y-3">
                  {messages.map((msg, idx) => (
                    <div 
                      key={idx}
                      className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                      {msg.role === "assistant" && (
                        <div className="p-1.5 rounded-lg bg-primary/20 h-fit">
                          <Bot className="h-4 w-4 text-primary" />
                        </div>
                      )}
                      <div className={`max-w-[80%] p-3 rounded-xl ${
                        msg.role === "user" 
                          ? "bg-primary text-primary-foreground rounded-br-sm" 
                          : "bg-secondary/50 border border-border/50 rounded-bl-sm"
                      }`}>
                        <p className="text-sm">{msg.content}</p>
                        <p className={`text-[10px] mt-1 ${
                          msg.role === "user" ? "text-primary-foreground/70" : "text-muted-foreground"
                        }`}>
                          {msg.timestamp.toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  ))}

                  {/* Thinking visualization */}
                  {isThinking && thinkingSteps.length > 0 && (
                    <div className="flex gap-2">
                      <div className="p-1.5 rounded-lg bg-primary/20 h-fit">
                        <Bot className="h-4 w-4 text-primary animate-pulse" />
                      </div>
                      <div className="bg-secondary/50 border border-border/50 rounded-xl rounded-bl-sm p-3 space-y-1.5">
                        {thinkingSteps.map((step, idx) => (
                          <div key={idx} className="flex items-center gap-2 text-xs">
                            {step.status === "pending" && <CircleDot className="h-3 w-3 text-muted-foreground" />}
                            {step.status === "active" && <Loader2 className="h-3 w-3 text-primary animate-spin" />}
                            {step.status === "complete" && <Zap className="h-3 w-3 text-success" />}
                            <span className={step.status === "active" ? "text-primary" : "text-muted-foreground"}>
                              {step.step}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>

              {/* Input */}
              <div className="flex gap-2 mt-3">
                <Input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                  placeholder="Ask about trades, market analysis, or give commands..."
                  className="bg-secondary/30 border-border/50 focus:border-primary"
                  disabled={isThinking}
                />
                <Button 
                  onClick={sendMessage} 
                  disabled={isThinking || !input.trim()}
                  className="gap-2"
                >
                  {isThinking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex flex-wrap gap-2">
              {["Explain last trade", "Market outlook?", "Risk assessment", "Top opportunities"].map((action) => (
                <Button
                  key={action}
                  variant="outline"
                  size="sm"
                  className="text-xs gap-1.5 bg-secondary/30 hover:bg-primary/10"
                  onClick={() => {
                    setInput(action);
                    setTimeout(() => sendMessage(), 100);
                  }}
                  disabled={isThinking}
                >
                  <Lightbulb className="h-3 w-3" />
                  {action}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

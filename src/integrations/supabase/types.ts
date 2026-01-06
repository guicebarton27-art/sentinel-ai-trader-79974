export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      api_keys: {
        Row: {
          created_at: string
          encrypted_key: string
          encrypted_secret: string
          exchange: string
          id: string
          is_active: boolean | null
          key_name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          encrypted_key: string
          encrypted_secret: string
          exchange: string
          id?: string
          is_active?: boolean | null
          key_name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          encrypted_key?: string
          encrypted_secret?: string
          exchange?: string
          id?: string
          is_active?: boolean | null
          key_name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      backtest_equity_curve: {
        Row: {
          backtest_run_id: string
          created_at: string
          drawdown: number
          equity: number
          id: string
          timestamp: number
        }
        Insert: {
          backtest_run_id: string
          created_at?: string
          drawdown: number
          equity: number
          id?: string
          timestamp: number
        }
        Update: {
          backtest_run_id?: string
          created_at?: string
          drawdown?: number
          equity?: number
          id?: string
          timestamp?: number
        }
        Relationships: [
          {
            foreignKeyName: "backtest_equity_curve_backtest_run_id_fkey"
            columns: ["backtest_run_id"]
            isOneToOne: false
            referencedRelation: "backtest_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      backtest_runs: {
        Row: {
          avg_loss: number | null
          avg_win: number | null
          calmar_ratio: number | null
          created_at: string
          end_timestamp: number
          expectancy: number | null
          final_capital: number
          id: string
          initial_capital: number
          interval: string
          losing_trades: number
          max_drawdown: number
          name: string
          omega_ratio: number | null
          profit_factor: number | null
          sharpe_ratio: number | null
          sortino_ratio: number | null
          start_timestamp: number
          status: string
          strategy_config: Json
          symbol: string
          total_return: number
          total_trades: number
          walk_forward_analysis: Json | null
          win_rate: number
          winning_trades: number
        }
        Insert: {
          avg_loss?: number | null
          avg_win?: number | null
          calmar_ratio?: number | null
          created_at?: string
          end_timestamp: number
          expectancy?: number | null
          final_capital: number
          id?: string
          initial_capital: number
          interval: string
          losing_trades: number
          max_drawdown: number
          name: string
          omega_ratio?: number | null
          profit_factor?: number | null
          sharpe_ratio?: number | null
          sortino_ratio?: number | null
          start_timestamp: number
          status?: string
          strategy_config: Json
          symbol: string
          total_return: number
          total_trades: number
          walk_forward_analysis?: Json | null
          win_rate: number
          winning_trades: number
        }
        Update: {
          avg_loss?: number | null
          avg_win?: number | null
          calmar_ratio?: number | null
          created_at?: string
          end_timestamp?: number
          expectancy?: number | null
          final_capital?: number
          id?: string
          initial_capital?: number
          interval?: string
          losing_trades?: number
          max_drawdown?: number
          name?: string
          omega_ratio?: number | null
          profit_factor?: number | null
          sharpe_ratio?: number | null
          sortino_ratio?: number | null
          start_timestamp?: number
          status?: string
          strategy_config?: Json
          symbol?: string
          total_return?: number
          total_trades?: number
          walk_forward_analysis?: Json | null
          win_rate?: number
          winning_trades?: number
        }
        Relationships: []
      }
      backtest_trades: {
        Row: {
          backtest_run_id: string
          created_at: string
          entry_price: number
          entry_timestamp: number
          exit_price: number
          exit_timestamp: number
          id: string
          pnl: number
          pnl_percentage: number
          side: string
          signal_strength: number | null
          size: number
        }
        Insert: {
          backtest_run_id: string
          created_at?: string
          entry_price: number
          entry_timestamp: number
          exit_price: number
          exit_timestamp: number
          id?: string
          pnl: number
          pnl_percentage: number
          side: string
          signal_strength?: number | null
          size: number
        }
        Update: {
          backtest_run_id?: string
          created_at?: string
          entry_price?: number
          entry_timestamp?: number
          exit_price?: number
          exit_timestamp?: number
          id?: string
          pnl?: number
          pnl_percentage?: number
          side?: string
          signal_strength?: number | null
          size?: number
        }
        Relationships: [
          {
            foreignKeyName: "backtest_trades_backtest_run_id_fkey"
            columns: ["backtest_run_id"]
            isOneToOne: false
            referencedRelation: "backtest_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      bot_events: {
        Row: {
          bot_capital: number | null
          bot_id: string
          bot_pnl: number | null
          created_at: string
          event_type: Database["public"]["Enums"]["bot_event_type"]
          id: string
          market_price: number | null
          message: string
          order_id: string | null
          payload: Json | null
          position_id: string | null
          severity: string
          user_id: string
        }
        Insert: {
          bot_capital?: number | null
          bot_id: string
          bot_pnl?: number | null
          created_at?: string
          event_type: Database["public"]["Enums"]["bot_event_type"]
          id?: string
          market_price?: number | null
          message: string
          order_id?: string | null
          payload?: Json | null
          position_id?: string | null
          severity?: string
          user_id: string
        }
        Update: {
          bot_capital?: number | null
          bot_id?: string
          bot_pnl?: number | null
          created_at?: string
          event_type?: Database["public"]["Enums"]["bot_event_type"]
          id?: string
          market_price?: number | null
          message?: string
          order_id?: string | null
          payload?: Json | null
          position_id?: string | null
          severity?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bot_events_bot_id_fkey"
            columns: ["bot_id"]
            isOneToOne: false
            referencedRelation: "bots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bot_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bot_events_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "positions"
            referencedColumns: ["id"]
          },
        ]
      }
      bots: {
        Row: {
          api_key_id: string | null
          created_at: string
          current_capital: number
          daily_pnl: number
          error_count: number
          id: string
          last_error: string | null
          last_heartbeat_at: string | null
          last_tick_at: string | null
          max_daily_loss: number
          max_leverage: number
          max_position_size: number
          mode: Database["public"]["Enums"]["bot_mode"]
          name: string
          starting_capital: number
          status: Database["public"]["Enums"]["bot_status"]
          stop_loss_pct: number
          strategy_config: Json
          strategy_id: string
          symbol: string
          take_profit_pct: number
          total_pnl: number
          total_trades: number
          updated_at: string
          user_id: string
          winning_trades: number
        }
        Insert: {
          api_key_id?: string | null
          created_at?: string
          current_capital?: number
          daily_pnl?: number
          error_count?: number
          id?: string
          last_error?: string | null
          last_heartbeat_at?: string | null
          last_tick_at?: string | null
          max_daily_loss?: number
          max_leverage?: number
          max_position_size?: number
          mode?: Database["public"]["Enums"]["bot_mode"]
          name?: string
          starting_capital?: number
          status?: Database["public"]["Enums"]["bot_status"]
          stop_loss_pct?: number
          strategy_config?: Json
          strategy_id?: string
          symbol?: string
          take_profit_pct?: number
          total_pnl?: number
          total_trades?: number
          updated_at?: string
          user_id: string
          winning_trades?: number
        }
        Update: {
          api_key_id?: string | null
          created_at?: string
          current_capital?: number
          daily_pnl?: number
          error_count?: number
          id?: string
          last_error?: string | null
          last_heartbeat_at?: string | null
          last_tick_at?: string | null
          max_daily_loss?: number
          max_leverage?: number
          max_position_size?: number
          mode?: Database["public"]["Enums"]["bot_mode"]
          name?: string
          starting_capital?: number
          status?: Database["public"]["Enums"]["bot_status"]
          stop_loss_pct?: number
          strategy_config?: Json
          strategy_id?: string
          symbol?: string
          take_profit_pct?: number
          total_pnl?: number
          total_trades?: number
          updated_at?: string
          user_id?: string
          winning_trades?: number
        }
        Relationships: [
          {
            foreignKeyName: "bots_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "api_keys"
            referencedColumns: ["id"]
          },
        ]
      }
      deployed_strategies: {
        Row: {
          created_at: string
          deployed_at: string
          id: string
          last_signal_at: string | null
          name: string
          performance_metrics: Json | null
          status: string
          strategy_config: Json
          symbol: string
          total_signals: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deployed_at?: string
          id?: string
          last_signal_at?: string | null
          name: string
          performance_metrics?: Json | null
          status?: string
          strategy_config: Json
          symbol: string
          total_signals?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          deployed_at?: string
          id?: string
          last_signal_at?: string | null
          name?: string
          performance_metrics?: Json | null
          status?: string
          strategy_config?: Json
          symbol?: string
          total_signals?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      historical_candles: {
        Row: {
          close: number
          created_at: string
          high: number
          id: string
          interval: string
          low: number
          open: number
          symbol: string
          timestamp: number
          volume: number
        }
        Insert: {
          close: number
          created_at?: string
          high: number
          id?: string
          interval: string
          low: number
          open: number
          symbol: string
          timestamp: number
          volume: number
        }
        Update: {
          close?: number
          created_at?: string
          high?: number
          id?: string
          interval?: string
          low?: number
          open?: number
          symbol?: string
          timestamp?: number
          volume?: number
        }
        Relationships: []
      }
      ml_models: {
        Row: {
          created_at: string | null
          file_path: string | null
          framework: string
          id: string
          metrics: Json | null
          model_name: string
          model_type: string
          parameters: Json
          status: string | null
          updated_at: string | null
          version: string
        }
        Insert: {
          created_at?: string | null
          file_path?: string | null
          framework: string
          id?: string
          metrics?: Json | null
          model_name: string
          model_type: string
          parameters: Json
          status?: string | null
          updated_at?: string | null
          version: string
        }
        Update: {
          created_at?: string | null
          file_path?: string | null
          framework?: string
          id?: string
          metrics?: Json | null
          model_name?: string
          model_type?: string
          parameters?: Json
          status?: string | null
          updated_at?: string | null
          version?: string
        }
        Relationships: []
      }
      ml_predictions: {
        Row: {
          actual_value: Json | null
          confidence: number | null
          created_at: string | null
          error: number | null
          horizon: string | null
          id: string
          model_id: string | null
          prediction_type: string
          prediction_value: Json
          symbol: string
          timestamp: number
        }
        Insert: {
          actual_value?: Json | null
          confidence?: number | null
          created_at?: string | null
          error?: number | null
          horizon?: string | null
          id?: string
          model_id?: string | null
          prediction_type: string
          prediction_value: Json
          symbol: string
          timestamp: number
        }
        Update: {
          actual_value?: Json | null
          confidence?: number | null
          created_at?: string | null
          error?: number | null
          horizon?: string | null
          id?: string
          model_id?: string | null
          prediction_type?: string
          prediction_value?: Json
          symbol?: string
          timestamp?: number
        }
        Relationships: [
          {
            foreignKeyName: "ml_predictions_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "ml_models"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          average_fill_price: number | null
          bot_id: string
          canceled_at: string | null
          client_order_id: string
          created_at: string
          exchange_order_id: string | null
          fee: number | null
          fee_currency: string | null
          filled_at: string | null
          filled_quantity: number
          id: string
          order_type: Database["public"]["Enums"]["order_type"]
          price: number | null
          quantity: number
          reason: string | null
          risk_checked: boolean
          risk_flags: Json | null
          risk_score: number | null
          side: Database["public"]["Enums"]["order_side"]
          signal_strength: number | null
          slippage: number | null
          status: Database["public"]["Enums"]["order_status"]
          stop_price: number | null
          strategy_id: string | null
          submitted_at: string | null
          symbol: string
          updated_at: string
          user_id: string
        }
        Insert: {
          average_fill_price?: number | null
          bot_id: string
          canceled_at?: string | null
          client_order_id: string
          created_at?: string
          exchange_order_id?: string | null
          fee?: number | null
          fee_currency?: string | null
          filled_at?: string | null
          filled_quantity?: number
          id?: string
          order_type: Database["public"]["Enums"]["order_type"]
          price?: number | null
          quantity: number
          reason?: string | null
          risk_checked?: boolean
          risk_flags?: Json | null
          risk_score?: number | null
          side: Database["public"]["Enums"]["order_side"]
          signal_strength?: number | null
          slippage?: number | null
          status?: Database["public"]["Enums"]["order_status"]
          stop_price?: number | null
          strategy_id?: string | null
          submitted_at?: string | null
          symbol: string
          updated_at?: string
          user_id: string
        }
        Update: {
          average_fill_price?: number | null
          bot_id?: string
          canceled_at?: string | null
          client_order_id?: string
          created_at?: string
          exchange_order_id?: string | null
          fee?: number | null
          fee_currency?: string | null
          filled_at?: string | null
          filled_quantity?: number
          id?: string
          order_type?: Database["public"]["Enums"]["order_type"]
          price?: number | null
          quantity?: number
          reason?: string | null
          risk_checked?: boolean
          risk_flags?: Json | null
          risk_score?: number | null
          side?: Database["public"]["Enums"]["order_side"]
          signal_strength?: number | null
          slippage?: number | null
          status?: Database["public"]["Enums"]["order_status"]
          stop_price?: number | null
          strategy_id?: string | null
          submitted_at?: string | null
          symbol?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_bot_id_fkey"
            columns: ["bot_id"]
            isOneToOne: false
            referencedRelation: "bots"
            referencedColumns: ["id"]
          },
        ]
      }
      positions: {
        Row: {
          bot_id: string
          closed_at: string | null
          current_price: number | null
          entry_order_id: string | null
          entry_price: number
          exit_order_id: string | null
          exit_price: number | null
          id: string
          liquidation_price: number | null
          max_drawdown: number | null
          opened_at: string
          quantity: number
          realized_pnl: number | null
          side: Database["public"]["Enums"]["order_side"]
          status: Database["public"]["Enums"]["position_status"]
          stop_loss_price: number | null
          symbol: string
          take_profit_price: number | null
          total_fees: number | null
          unrealized_pnl: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          bot_id: string
          closed_at?: string | null
          current_price?: number | null
          entry_order_id?: string | null
          entry_price: number
          exit_order_id?: string | null
          exit_price?: number | null
          id?: string
          liquidation_price?: number | null
          max_drawdown?: number | null
          opened_at?: string
          quantity: number
          realized_pnl?: number | null
          side: Database["public"]["Enums"]["order_side"]
          status?: Database["public"]["Enums"]["position_status"]
          stop_loss_price?: number | null
          symbol: string
          take_profit_price?: number | null
          total_fees?: number | null
          unrealized_pnl?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          bot_id?: string
          closed_at?: string | null
          current_price?: number | null
          entry_order_id?: string | null
          entry_price?: number
          exit_order_id?: string | null
          exit_price?: number | null
          id?: string
          liquidation_price?: number | null
          max_drawdown?: number | null
          opened_at?: string
          quantity?: number
          realized_pnl?: number | null
          side?: Database["public"]["Enums"]["order_side"]
          status?: Database["public"]["Enums"]["position_status"]
          stop_loss_price?: number | null
          symbol?: string
          take_profit_price?: number | null
          total_fees?: number | null
          unrealized_pnl?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "positions_bot_id_fkey"
            columns: ["bot_id"]
            isOneToOne: false
            referencedRelation: "bots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "positions_entry_order_id_fkey"
            columns: ["entry_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "positions_exit_order_id_fkey"
            columns: ["exit_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      rl_agent_state: {
        Row: {
          action_taken: Json | null
          agent_name: string
          agent_type: string
          created_at: string | null
          cumulative_reward: number | null
          episode: number
          id: string
          portfolio_value: number | null
          reward: number | null
          state_snapshot: Json
          timestamp: number
        }
        Insert: {
          action_taken?: Json | null
          agent_name: string
          agent_type: string
          created_at?: string | null
          cumulative_reward?: number | null
          episode: number
          id?: string
          portfolio_value?: number | null
          reward?: number | null
          state_snapshot: Json
          timestamp: number
        }
        Update: {
          action_taken?: Json | null
          agent_name?: string
          agent_type?: string
          created_at?: string | null
          cumulative_reward?: number | null
          episode?: number
          id?: string
          portfolio_value?: number | null
          reward?: number | null
          state_snapshot?: Json
          timestamp?: number
        }
        Relationships: []
      }
      sentiment_data: {
        Row: {
          confidence: number | null
          created_at: string | null
          id: string
          model_used: string
          raw_data: Json | null
          sentiment_score: number
          source: string
          symbol: string
          timestamp: number
          trend: string | null
          volume: number | null
        }
        Insert: {
          confidence?: number | null
          created_at?: string | null
          id?: string
          model_used: string
          raw_data?: Json | null
          sentiment_score: number
          source: string
          symbol: string
          timestamp: number
          trend?: string | null
          volume?: number | null
        }
        Update: {
          confidence?: number | null
          created_at?: string | null
          id?: string
          model_used?: string
          raw_data?: Json | null
          sentiment_score?: number
          source?: string
          symbol?: string
          timestamp?: number
          trend?: string | null
          volume?: number | null
        }
        Relationships: []
      }
      test_runs: {
        Row: {
          created_at: string
          id: string
          results_json: Json
          run_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          results_json: Json
          run_id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          results_json?: Json
          run_id?: string
          user_id?: string
        }
        Relationships: []
      }
      trading_sessions: {
        Row: {
          created_at: string
          ended_at: string | null
          id: string
          mode: string
          nav: number | null
          pnl: number | null
          pnl_percentage: number | null
          started_at: string | null
          starting_nav: number | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          ended_at?: string | null
          id?: string
          mode?: string
          nav?: number | null
          pnl?: number | null
          pnl_percentage?: number | null
          started_at?: string | null
          starting_nav?: number | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          ended_at?: string | null
          id?: string
          mode?: string
          nav?: number | null
          pnl?: number | null
          pnl_percentage?: number | null
          started_at?: string | null
          starting_nav?: number | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "trader" | "viewer"
      bot_event_type:
        | "start"
        | "stop"
        | "pause"
        | "resume"
        | "tick"
        | "order"
        | "fill"
        | "error"
        | "heartbeat"
        | "config_change"
        | "risk_alert"
      bot_mode: "paper" | "live"
      bot_status: "stopped" | "running" | "paused" | "error"
      order_side: "buy" | "sell"
      order_status:
        | "pending"
        | "submitted"
        | "partial"
        | "filled"
        | "canceled"
        | "rejected"
        | "expired"
      order_type:
        | "market"
        | "limit"
        | "stop_loss"
        | "take_profit"
        | "stop_limit"
      position_status: "open" | "closed" | "liquidated"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "trader", "viewer"],
      bot_event_type: [
        "start",
        "stop",
        "pause",
        "resume",
        "tick",
        "order",
        "fill",
        "error",
        "heartbeat",
        "config_change",
        "risk_alert",
      ],
      bot_mode: ["paper", "live"],
      bot_status: ["stopped", "running", "paused", "error"],
      order_side: ["buy", "sell"],
      order_status: [
        "pending",
        "submitted",
        "partial",
        "filled",
        "canceled",
        "rejected",
        "expired",
      ],
      order_type: ["market", "limit", "stop_loss", "take_profit", "stop_limit"],
      position_status: ["open", "closed", "liquidated"],
    },
  },
} as const

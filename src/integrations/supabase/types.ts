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
          created_at: string
          end_timestamp: number
          final_capital: number
          id: string
          initial_capital: number
          interval: string
          losing_trades: number
          max_drawdown: number
          name: string
          profit_factor: number | null
          sharpe_ratio: number | null
          sortino_ratio: number | null
          start_timestamp: number
          status: string
          strategy_config: Json
          symbol: string
          total_return: number
          total_trades: number
          win_rate: number
          winning_trades: number
        }
        Insert: {
          avg_loss?: number | null
          avg_win?: number | null
          created_at?: string
          end_timestamp: number
          final_capital: number
          id?: string
          initial_capital: number
          interval: string
          losing_trades: number
          max_drawdown: number
          name: string
          profit_factor?: number | null
          sharpe_ratio?: number | null
          sortino_ratio?: number | null
          start_timestamp: number
          status?: string
          strategy_config: Json
          symbol: string
          total_return: number
          total_trades: number
          win_rate: number
          winning_trades: number
        }
        Update: {
          avg_loss?: number | null
          avg_win?: number | null
          created_at?: string
          end_timestamp?: number
          final_capital?: number
          id?: string
          initial_capital?: number
          interval?: string
          losing_trades?: number
          max_drawdown?: number
          name?: string
          profit_factor?: number | null
          sharpe_ratio?: number | null
          sortino_ratio?: number | null
          start_timestamp?: number
          status?: string
          strategy_config?: Json
          symbol?: string
          total_return?: number
          total_trades?: number
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const

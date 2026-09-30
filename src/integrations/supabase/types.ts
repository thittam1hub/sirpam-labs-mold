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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      contact_messages: {
        Row: {
          age_confirmed: boolean
          created_at: string
          email: string
          id: string
          message: string
          name: string
        }
        Insert: {
          age_confirmed?: boolean
          created_at?: string
          email: string
          id?: string
          message: string
          name: string
        }
        Update: {
          age_confirmed?: boolean
          created_at?: string
          email?: string
          id?: string
          message?: string
          name?: string
        }
        Relationships: []
      }
      credit_balances: {
        Row: {
          balance: number
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      credit_holds: {
        Row: {
          action: string
          allocations: Json
          cost: number
          created_at: string
          free_month: string | null
          from_free: number
          id: string
          settled_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          action: string
          allocations?: Json
          cost: number
          created_at?: string
          free_month?: string | null
          from_free?: number
          id?: string
          settled_at?: string | null
          status?: string
          user_id: string
        }
        Update: {
          action?: string
          allocations?: Json
          cost?: number
          created_at?: string
          free_month?: string | null
          from_free?: number
          id?: string
          settled_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      credit_ledger: {
        Row: {
          created_at: string
          delta: number
          expires_at: string | null
          id: string
          kind: string | null
          reason: string
          reference: string | null
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          delta: number
          expires_at?: string | null
          id?: string
          kind?: string | null
          reason: string
          reference?: string | null
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          delta?: number
          expires_at?: string | null
          id?: string
          kind?: string | null
          reason?: string
          reference?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      credit_lots: {
        Row: {
          amount: number
          created_at: string
          expires_at: string | null
          id: string
          kind: string
          reference: string | null
          remaining: number
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          expires_at?: string | null
          id?: string
          kind: string
          reference?: string | null
          remaining: number
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          expires_at?: string | null
          id?: string
          kind?: string
          reference?: string | null
          remaining?: number
          user_id?: string
        }
        Relationships: []
      }
      credit_packs: {
        Row: {
          active: boolean
          best: boolean
          created_at: string
          credits: number
          id: string
          inr: number
          name: string
          sort: number
          usd_emerging: number
          usd_standard: number
          usd_value: number
        }
        Insert: {
          active?: boolean
          best?: boolean
          created_at?: string
          credits: number
          id: string
          inr: number
          name: string
          sort?: number
          usd_emerging: number
          usd_standard: number
          usd_value: number
        }
        Update: {
          active?: boolean
          best?: boolean
          created_at?: string
          credits?: number
          id?: string
          inr?: number
          name?: string
          sort?: number
          usd_emerging?: number
          usd_standard?: number
          usd_value?: number
        }
        Relationships: []
      }
      deleted_referral_emails: {
        Row: {
          created_at: string
          email_hash: string
        }
        Insert: {
          created_at?: string
          email_hash: string
        }
        Update: {
          created_at?: string
          email_hash?: string
        }
        Relationships: []
      }
      gallery_items: {
        Row: {
          best_settings: string | null
          created_at: string
          currency: string | null
          id: string
          material: string | null
          notes: string | null
          photo_paths: string[]
          price_paid: number | null
          rating: number | null
          size_x_mm: number | null
          size_y_mm: number | null
          size_z_mm: number | null
          source: string | null
          stl_name: string | null
          stl_size: string | null
          title: string
          user_id: string
        }
        Insert: {
          best_settings?: string | null
          created_at?: string
          currency?: string | null
          id?: string
          material?: string | null
          notes?: string | null
          photo_paths?: string[]
          price_paid?: number | null
          rating?: number | null
          size_x_mm?: number | null
          size_y_mm?: number | null
          size_z_mm?: number | null
          source?: string | null
          stl_name?: string | null
          stl_size?: string | null
          title: string
          user_id?: string
        }
        Update: {
          best_settings?: string | null
          created_at?: string
          currency?: string | null
          id?: string
          material?: string | null
          notes?: string | null
          photo_paths?: string[]
          price_paid?: number | null
          rating?: number | null
          size_x_mm?: number | null
          size_y_mm?: number | null
          size_z_mm?: number | null
          source?: string | null
          stl_name?: string | null
          stl_size?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      monthly_usage: {
        Row: {
          free_exports: number
          month: string
          user_id: string
        }
        Insert: {
          free_exports?: number
          month: string
          user_id: string
        }
        Update: {
          free_exports?: number
          month?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          age_confirmed_at: string | null
          avatar_url: string | null
          display_name: string
          id: string
          updated_at: string
        }
        Insert: {
          age_confirmed_at?: string | null
          avatar_url?: string | null
          display_name?: string
          id: string
          updated_at?: string
        }
        Update: {
          age_confirmed_at?: string | null
          avatar_url?: string | null
          display_name?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      promo_attempts: {
        Row: {
          attempted_at: string
          user_id: string
        }
        Insert: {
          attempted_at?: string
          user_id: string
        }
        Update: {
          attempted_at?: string
          user_id?: string
        }
        Relationships: []
      }
      promo_codes: {
        Row: {
          active: boolean
          code: string
          created_at: string
          credit_valid_days: number
          credits: number
          expires_at: string | null
          max_redemptions: number | null
          redeemed_count: number
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          credit_valid_days?: number
          credits: number
          expires_at?: string | null
          max_redemptions?: number | null
          redeemed_count?: number
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          credit_valid_days?: number
          credits?: number
          expires_at?: string | null
          max_redemptions?: number | null
          redeemed_count?: number
        }
        Relationships: []
      }
      promo_redemptions: {
        Row: {
          code: string
          created_at: string
          user_id: string
        }
        Insert: {
          code: string
          created_at?: string
          user_id: string
        }
        Update: {
          code?: string
          created_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "promo_redemptions_code_fkey"
            columns: ["code"]
            isOneToOne: false
            referencedRelation: "promo_codes"
            referencedColumns: ["code"]
          },
        ]
      }
      purchases: {
        Row: {
          created_at: string
          credits: number
          currency: string
          id: string
          pack_id: string
          pack_name: string
          payment_ref: string | null
          price: number
          provider: string
          refunded_at: string | null
          region: string | null
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          credits: number
          currency?: string
          id?: string
          pack_id: string
          pack_name: string
          payment_ref?: string | null
          price: number
          provider?: string
          refunded_at?: string | null
          region?: string | null
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          credits?: number
          currency?: string
          id?: string
          pack_id?: string
          pack_name?: string
          payment_ref?: string | null
          price?: number
          provider?: string
          refunded_at?: string | null
          region?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      quote_requests: {
        Row: {
          casting_material: string | null
          contact_email: string
          contact_name: string
          created_at: string
          id: string
          maker: string
          notes: string | null
          project_path: string | null
          quantity: number
          size_class: string | null
          user_id: string
        }
        Insert: {
          casting_material?: string | null
          contact_email: string
          contact_name: string
          created_at?: string
          id?: string
          maker: string
          notes?: string | null
          project_path?: string | null
          quantity?: number
          size_class?: string | null
          user_id?: string
        }
        Update: {
          casting_material?: string | null
          contact_email?: string
          contact_name?: string
          created_at?: string
          id?: string
          maker?: string
          notes?: string | null
          project_path?: string | null
          quantity?: number
          size_class?: string | null
          user_id?: string
        }
        Relationships: []
      }
      referral_codes: {
        Row: {
          code: string
          created_at: string
          user_id: string
        }
        Insert: {
          code: string
          created_at?: string
          user_id: string
        }
        Update: {
          code?: string
          created_at?: string
          user_id?: string
        }
        Relationships: []
      }
      referrals: {
        Row: {
          created_at: string
          purchase_bonus_at: string | null
          referee_id: string
          referrer_id: string
          rewarded_at: string | null
          status: string
        }
        Insert: {
          created_at?: string
          purchase_bonus_at?: string | null
          referee_id: string
          referrer_id: string
          rewarded_at?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          purchase_bonus_at?: string | null
          referee_id?: string
          referrer_id?: string
          rewarded_at?: string | null
          status?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
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
      _action_cost: { Args: { _action: string }; Returns: number }
      _expire_lots: { Args: { _uid: string }; Returns: undefined }
      _refresh_balance: { Args: { _uid: string }; Returns: number }
      _release_hold: { Args: { _id: string; _uid: string }; Returns: boolean }
      _release_stale: { Args: { _uid: string }; Returns: undefined }
      _require_admin: { Args: never; Returns: undefined }
      _reward_referral: { Args: { _uid: string }; Returns: undefined }
      admin_adjust_credits: {
        Args: { _amount: number; _reason: string; _user: string }
        Returns: Json
      }
      admin_create_promo: {
        Args: {
          _code: string
          _credits: number
          _expires: string
          _max: number
          _valid_days: number
        }
        Returns: undefined
      }
      admin_find_user: { Args: { _email: string }; Returns: Json }
      admin_list_purchases: { Args: { _email: string }; Returns: Json }
      admin_overview: { Args: never; Returns: Json }
      admin_refund_purchase: {
        Args: { _purchase: string; _reason: string }
        Returns: Json
      }
      admin_set_promo_active: {
        Args: { _active: boolean; _code: string }
        Returns: undefined
      }
      apply_referral: { Args: { _code: string }; Returns: Json }
      capture_hold: { Args: { _id: string }; Returns: boolean }
      delete_my_account_data: { Args: never; Returns: undefined }
      ensure_credit_account: { Args: never; Returns: undefined }
      get_credit_status: { Args: never; Returns: Json }
      get_referral_info: { Args: never; Returns: Json }
      grant_credits: {
        Args: {
          _amount: number
          _kind?: string
          _reason: string
          _reference: string
          _user: string
          _valid_days?: number
        }
        Returns: undefined
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      hold_credits: { Args: { _action: string }; Returns: Json }
      record_purchase: {
        Args: {
          _currency: string
          _pack_id: string
          _payment_ref: string
          _price: number
          _provider: string
          _region: string
          _user: string
        }
        Returns: Json
      }
      redeem_promo: { Args: { _code: string }; Returns: Json }
      release_hold: { Args: { _id: string }; Returns: boolean }
      reverse_purchase: {
        Args: { _payment_ref: string; _provider: string; _reason: string }
        Returns: Json
      }
      spend_credits: { Args: { _action: string }; Returns: Json }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const

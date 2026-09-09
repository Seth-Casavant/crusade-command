export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      app_users: {
        Row: {
          created_at: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      battlefields: {
        Row: {
          asset_reference: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          asset_reference?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          asset_reference?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      campaign_updates: {
        Row: {
          actor_id: string | null
          campaign_id: string
          change_type: Database["public"]["Enums"]["campaign_update_type"]
          id: string
          mission_id: string | null
          new_revision: number
          new_values: Json
          occurred_at: string
          old_values: Json
          previous_revision: number
        }
        Insert: {
          actor_id?: string | null
          campaign_id: string
          change_type: Database["public"]["Enums"]["campaign_update_type"]
          id?: string
          mission_id?: string | null
          new_revision: number
          new_values: Json
          occurred_at?: string
          old_values: Json
          previous_revision: number
        }
        Update: {
          actor_id?: string | null
          campaign_id?: string
          change_type?: Database["public"]["Enums"]["campaign_update_type"]
          id?: string
          mission_id?: string | null
          new_revision?: number
          new_values?: Json
          occurred_at?: string
          old_values?: Json
          previous_revision?: number
        }
        Relationships: [
          {
            foreignKeyName: "campaign_updates_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_updates_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          status: Database["public"]["Enums"]["campaign_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          status?: Database["public"]["Enums"]["campaign_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          status?: Database["public"]["Enums"]["campaign_status"]
          updated_at?: string
        }
        Relationships: []
      }
      kill_team_members: {
        Row: {
          created_at: string
          discord_user_id: string
          display_name: string
          id: string
          kill_team_id: string
          mission_id: string
        }
        Insert: {
          created_at?: string
          discord_user_id: string
          display_name: string
          id?: string
          kill_team_id: string
          mission_id: string
        }
        Update: {
          created_at?: string
          discord_user_id?: string
          display_name?: string
          id?: string
          kill_team_id?: string
          mission_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kill_team_members_team_mission_fk"
            columns: ["kill_team_id", "mission_id"]
            isOneToOne: false
            referencedRelation: "kill_teams"
            referencedColumns: ["id", "mission_id"]
          },
        ]
      }
      kill_team_progress_ledger: {
        Row: {
          actor_id: string
          campaign_id: string
          campaign_revision: number
          created_at: string
          description: string | null
          event_type: Database["public"]["Enums"]["kill_team_progress_event_type"]
          id: string
          kill_team_id: string
          mission_id: string
          point_delta: number
          scoring_target_key: string | null
        }
        Insert: {
          actor_id: string
          campaign_id: string
          campaign_revision: number
          created_at?: string
          description?: string | null
          event_type: Database["public"]["Enums"]["kill_team_progress_event_type"]
          id?: string
          kill_team_id: string
          mission_id: string
          point_delta: number
          scoring_target_key?: string | null
        }
        Update: {
          actor_id?: string
          campaign_id?: string
          campaign_revision?: number
          created_at?: string
          description?: string | null
          event_type?: Database["public"]["Enums"]["kill_team_progress_event_type"]
          id?: string
          kill_team_id?: string
          mission_id?: string
          point_delta?: number
          scoring_target_key?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kill_team_progress_campaign_mission_fk"
            columns: ["campaign_id", "mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["campaign_id", "id"]
          },
          {
            foreignKeyName: "kill_team_progress_scoring_target_fk"
            columns: ["mission_id", "scoring_target_key"]
            isOneToOne: false
            referencedRelation: "mission_crusade_scoring_targets"
            referencedColumns: ["mission_id", "target_key"]
          },
          {
            foreignKeyName: "kill_team_progress_team_mission_fk"
            columns: ["kill_team_id", "mission_id"]
            isOneToOne: false
            referencedRelation: "kill_teams"
            referencedColumns: ["id", "mission_id"]
          },
        ]
      }
      kill_teams: {
        Row: {
          created_at: string
          current_checkpoint_id: string | null
          id: string
          mission_id: string
          name: string
          operational_status: Database["public"]["Enums"]["kill_team_operational_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_checkpoint_id?: string | null
          id?: string
          mission_id: string
          name: string
          operational_status?: Database["public"]["Enums"]["kill_team_operational_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_checkpoint_id?: string | null
          id?: string
          mission_id?: string
          name?: string
          operational_status?: Database["public"]["Enums"]["kill_team_operational_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "kill_teams_current_checkpoint_mission_fk"
            columns: ["mission_id", "current_checkpoint_id"]
            isOneToOne: false
            referencedRelation: "mission_battlefield_checkpoints"
            referencedColumns: ["mission_id", "id"]
          },
          {
            foreignKeyName: "kill_teams_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
        ]
      }
      live_campaign_states: {
        Row: {
          campaign_id: string
          campaign_progress: number
          current_mission_id: string | null
          last_update_id: string
          revision: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          campaign_id: string
          campaign_progress?: number
          current_mission_id?: string | null
          last_update_id?: string
          revision?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          campaign_id?: string
          campaign_progress?: number
          current_mission_id?: string | null
          last_update_id?: string
          revision?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "live_campaign_states_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: true
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_campaign_states_current_mission_campaign_fk"
            columns: ["campaign_id", "current_mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["campaign_id", "id"]
          },
        ]
      }
      mission_battlefield_checkpoints: {
        Row: {
          checkpoint_key: string
          created_at: string
          id: string
          mission_id: string
          name: string
          normalized_x: number
          normalized_y: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          checkpoint_key: string
          created_at?: string
          id?: string
          mission_id: string
          name: string
          normalized_x: number
          normalized_y: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          checkpoint_key?: string
          created_at?: string
          id?: string
          mission_id?: string
          name?: string
          normalized_x?: number
          normalized_y?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mission_battlefield_checkpoints_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
        ]
      }
      mission_crusade_scoring_targets: {
        Row: {
          created_at: string
          display_name: string
          mission_id: string
          sort_order: number
          target_key: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name: string
          mission_id: string
          sort_order?: number
          target_key: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string
          mission_id?: string
          sort_order?: number
          target_key?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mission_crusade_scoring_targets_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
        ]
      }
      mission_enemy_entries: {
        Row: {
          created_at: string
          description: string | null
          enemy_type: string | null
          id: string
          mission_id: string
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          enemy_type?: string | null
          id?: string
          mission_id: string
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          enemy_type?: string | null
          id?: string
          mission_id?: string
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mission_enemy_entries_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
        ]
      }
      missions: {
        Row: {
          battlefield_id: string | null
          campaign_id: string
          created_at: string
          description: string | null
          enemy_faction: string | null
          id: string
          mission_boss_display_name: string | null
          mission_boss_key: string | null
          name: string
          status: Database["public"]["Enums"]["mission_status"]
          updated_at: string
        }
        Insert: {
          battlefield_id?: string | null
          campaign_id: string
          created_at?: string
          description?: string | null
          enemy_faction?: string | null
          id?: string
          mission_boss_display_name?: string | null
          mission_boss_key?: string | null
          name: string
          status?: Database["public"]["Enums"]["mission_status"]
          updated_at?: string
        }
        Update: {
          battlefield_id?: string | null
          campaign_id?: string
          created_at?: string
          description?: string | null
          enemy_faction?: string | null
          id?: string
          mission_boss_display_name?: string | null
          mission_boss_key?: string | null
          name?: string
          status?: Database["public"]["Enums"]["mission_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "missions_battlefield_id_fkey"
            columns: ["battlefield_id"]
            isOneToOne: false
            referencedRelation: "battlefields"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "missions_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      objectives: {
        Row: {
          created_at: string
          description: string | null
          id: string
          mission_id: string
          sort_order: number
          status: Database["public"]["Enums"]["objective_status"]
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          mission_id: string
          sort_order?: number
          status?: Database["public"]["Enums"]["objective_status"]
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          mission_id?: string
          sort_order?: number
          status?: Database["public"]["Enums"]["objective_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "objectives_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
        ]
      }
      public_campaign_sync_signals: {
        Row: {
          campaign_id: string
          is_active: boolean
          published_at: string
          revision: number
          update_id: string
        }
        Insert: {
          campaign_id: string
          is_active: boolean
          published_at: string
          revision: number
          update_id: string
        }
        Update: {
          campaign_id?: string
          is_active?: boolean
          published_at?: string
          revision?: number
          update_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "public_campaign_sync_signals_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: true
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "public_campaign_sync_signals_update_id_fkey"
            columns: ["update_id"]
            isOneToOne: true
            referencedRelation: "campaign_updates"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      assert_mission_activation_ready: {
        Args: {
          p_battlefield_id: string
          p_campaign_id: string
          p_mission_id: string
        }
        Returns: undefined
      }
      assign_kill_team_checkpoint: {
        Args: {
          p_actor_id?: string
          p_checkpoint_id: string
          p_expected_revision: number
          p_kill_team_id: string
        }
        Returns: {
          new_revision: number
          update_id: string
        }[]
      }
      assign_moderator: { Args: { p_user_id: string }; Returns: undefined }
      create_kill_team: {
        Args: {
          p_actor_id?: string
          p_expected_revision: number
          p_members: Json
          p_mission_id: string
          p_name: string
        }
        Returns: {
          kill_team_id: string
          new_revision: number
          update_id: string
        }[]
      }
      create_mission_battlefield_checkpoint: {
        Args: {
          p_actor_id?: string
          p_checkpoint_key: string
          p_expected_revision: number
          p_mission_id: string
          p_name: string
          p_normalized_x: number
          p_normalized_y: number
          p_sort_order: number
        }
        Returns: {
          checkpoint_id: string
          new_revision: number
          update_id: string
        }[]
      }
      current_app_role: {
        Args: never
        Returns: Database["public"]["Enums"]["app_role"]
      }
      delete_kill_team: {
        Args: {
          p_actor_id?: string
          p_expected_revision: number
          p_kill_team_id: string
        }
        Returns: {
          new_revision: number
          update_id: string
        }[]
      }
      delete_mission_battlefield_checkpoint: {
        Args: {
          p_actor_id?: string
          p_checkpoint_id: string
          p_expected_revision: number
        }
        Returns: {
          new_revision: number
          update_id: string
        }[]
      }
      get_public_active_campaign: {
        Args: never
        Returns: {
          battlefield_checkpoints: Json
          battlefield_description: string
          battlefield_id: string
          battlefield_name: string
          campaign_description: string
          campaign_id: string
          campaign_name: string
          campaign_progress: number
          crusade_points: number
          crusade_scoring_targets: Json
          enemies: Json
          enemy_faction: string
          kill_teams: Json
          mission_boss: Json
          mission_description: string
          mission_id: string
          mission_name: string
          mission_status: Database["public"]["Enums"]["mission_status"]
          objectives: Json
          revision: number
          updated_at: string
        }[]
      }
      get_public_latest_sync_signal: {
        Args: never
        Returns: {
          campaign_id: string
          is_active: boolean
          published_at: string
          revision: number
          update_id: string
        }[]
      }
      get_public_sync_snapshot: { Args: never; Returns: Json }
      record_kill_team_progress: {
        Args: {
          p_actor_id?: string
          p_description?: string
          p_event_type: Database["public"]["Enums"]["kill_team_progress_event_type"]
          p_expected_revision: number
          p_kill_team_id: string
          p_point_delta: number
          p_scoring_target_key?: string
        }
        Returns: {
          ledger_entry_id: string
          new_revision: number
          update_id: string
        }[]
      }
      transition_mission_state: {
        Args: {
          p_actor_id?: string
          p_expected_revision: number
          p_mission_id: string
          p_new_status: Database["public"]["Enums"]["mission_status"]
        }
        Returns: {
          mission_state: Database["public"]["Enums"]["mission_status"]
          new_revision: number
          update_id: string
        }[]
      }
      update_campaign_live_state: {
        Args: {
          p_actor_id?: string
          p_campaign_id: string
          p_expected_revision: number
          p_new_objective_status?: Database["public"]["Enums"]["objective_status"]
          p_new_progress?: number
          p_objective_id?: string
        }
        Returns: {
          new_revision: number
          update_id: string
        }[]
      }
      update_kill_team: {
        Args: {
          p_actor_id?: string
          p_expected_revision: number
          p_kill_team_id: string
          p_members: Json
          p_name: string
        }
        Returns: {
          new_revision: number
          update_id: string
        }[]
      }
      update_kill_team_operational_status: {
        Args: {
          p_actor_id?: string
          p_expected_revision: number
          p_kill_team_id: string
          p_operational_status: Database["public"]["Enums"]["kill_team_operational_status"]
        }
        Returns: {
          new_revision: number
          update_id: string
        }[]
      }
      update_mission_battlefield_checkpoint: {
        Args: {
          p_actor_id?: string
          p_checkpoint_id: string
          p_expected_revision: number
          p_name: string
          p_normalized_x: number
          p_normalized_y: number
          p_sort_order: number
        }
        Returns: {
          new_revision: number
          update_id: string
        }[]
      }
    }
    Enums: {
      app_role: "ADMINISTRATOR" | "MODERATOR" | "PLAYER"
      campaign_status: "DRAFT" | "ACTIVE" | "COMPLETE"
      campaign_update_type:
        | "MISSION_TRANSITION"
        | "LIVE_STATE_UPDATE"
        | "KILL_TEAM_REGISTRATION"
        | "KILL_TEAM_POSITION"
        | "KILL_TEAM_OPERATIONAL_STATUS"
        | "KILL_TEAM_PROGRESS"
      kill_team_operational_status:
        | "STAGING"
        | "DEPLOYED"
        | "ADVANCING"
        | "OBJECTIVE"
        | "DELAYED"
        | "COMPLETE"
        | "WITHDRAWN"
      kill_team_progress_event_type:
        | "TERMINUS_KILL"
        | "OBJECTIVE"
        | "MISSION_COMPLETION"
        | "CORRECTION"
      mission_status: "DRAFT" | "READY" | "ACTIVE" | "COMPLETE" | "ABORTED"
      objective_status: "PENDING" | "ACTIVE" | "COMPLETE"
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
      app_role: ["ADMINISTRATOR", "MODERATOR", "PLAYER"],
      campaign_status: ["DRAFT", "ACTIVE", "COMPLETE"],
      campaign_update_type: [
        "MISSION_TRANSITION",
        "LIVE_STATE_UPDATE",
        "KILL_TEAM_REGISTRATION",
        "KILL_TEAM_POSITION",
        "KILL_TEAM_OPERATIONAL_STATUS",
        "KILL_TEAM_PROGRESS",
      ],
      kill_team_operational_status: [
        "STAGING",
        "DEPLOYED",
        "ADVANCING",
        "OBJECTIVE",
        "DELAYED",
        "COMPLETE",
        "WITHDRAWN",
      ],
      kill_team_progress_event_type: [
        "TERMINUS_KILL",
        "OBJECTIVE",
        "MISSION_COMPLETION",
        "CORRECTION",
      ],
      mission_status: ["DRAFT", "READY", "ACTIVE", "COMPLETE", "ABORTED"],
      objective_status: ["PENDING", "ACTIVE", "COMPLETE"],
    },
  },
} as const

// Database type definitions for TecBunny communication system

export interface Database {
  public: {
    Tables: {
      otp_codes: {
        Row: {
          id: string;
          email: string | null;
          phone: string | null;
          otp: string;
          otp_code: string | null;
          expires_at: string;
          type: 'signup' | 'recovery' | 'login_2fa' | 'agent_order';
          channel: 'whatsapp' | 'email' | null;
          used: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          email?: string | null;
          phone?: string | null;
          otp: string;
          otp_code?: string | null;
          expires_at: string;
          type: 'signup' | 'recovery' | 'login_2fa' | 'agent_order';
          channel?: 'whatsapp' | 'email' | null;
          used?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string | null;
          phone?: string | null;
          otp?: string;
          otp_code?: string | null;
          expires_at?: string;
          type?: 'signup' | 'recovery' | 'login_2fa' | 'agent_order';
          channel?: 'whatsapp' | 'email' | null;
          used?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      user_communication_preferences: {
        Row: {
          id: string;
          userId: string;
          preferredOTPChannel: 'whatsapp' | 'email';
          emailNotifications: boolean;
          whatsappNotifications: boolean;
          orderUpdates: boolean;
          serviceUpdates: boolean;
          securityAlerts: boolean;
          phone: string | null;
          email: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          userId: string;
          preferredOTPChannel?: 'whatsapp' | 'email';
          emailNotifications?: boolean;
          whatsappNotifications?: boolean;
          orderUpdates?: boolean;
          serviceUpdates?: boolean;
          securityAlerts?: boolean;
          phone?: string | null;
          email?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          userId?: string;
          preferredOTPChannel?: 'whatsapp' | 'email';
          emailNotifications?: boolean;
          whatsappNotifications?: boolean;
          orderUpdates?: boolean;
          serviceUpdates?: boolean;
          securityAlerts?: boolean;
          phone?: string | null;
          email?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      products: {
        Row: {
          id: string;
          name: string;
          title: string | null;
          description: string | null;
          price: number | null;
          status: string;
          popularity: number;
          rating: number;
          review_count: number | null;
          reviewCount?: number | null;
          created_at: string;
          updated_at: string;
          // ... other product fields
        };
        Insert: {
          id?: string;
          name: string;
          title?: string | null;
          description?: string | null;
          price?: number | null;
          status?: string;
          popularity?: number;
          rating?: number;
          review_count?: number | null;
          reviewCount?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          title?: string | null;
          description?: string | null;
          price?: number | null;
          status?: string;
          popularity?: number;
          rating?: number;
          review_count?: number | null;
          reviewCount?: number | null;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
  };
}

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          name: string | null
          role: 'admin' | 'comercial' | 'driver'
          credits_balance?: number
          phone?: string | null
          avatar_url?: string | null
          terms_accepted_at?: string | null
          company_name?: string | null
          company_cnpj?: string | null
          onboarding_completed?: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          email: string
          name?: string | null
          role?: 'admin' | 'comercial' | 'driver'
          credits_balance?: number
          phone?: string | null
          avatar_url?: string | null
          terms_accepted_at?: string | null
          company_name?: string | null
          company_cnpj?: string | null
          onboarding_completed?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          name?: string | null
          role?: 'admin' | 'comercial' | 'driver'
          credits_balance?: number
          phone?: string | null
          avatar_url?: string | null
          terms_accepted_at?: string | null
          company_name?: string | null
          company_cnpj?: string | null
          onboarding_completed?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      drivers: {
        Row: {
          id: string
          user_id: string | null
          name: string
          phone: string
          email: string
          cnh: string
          vehicle: string
          plate: string
          status: 'active' | 'inactive' | 'onRoute'
          location: string | null
          last_checkin: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          name: string
          phone: string
          email: string
          cnh: string
          vehicle: string
          plate: string
          status?: 'active' | 'inactive' | 'onRoute'
          location?: string | null
          last_checkin?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          name?: string
          phone?: string
          email?: string
          cnh?: string
          vehicle?: string
          plate?: string
          status?: 'active' | 'inactive' | 'onRoute'
          location?: string | null
          last_checkin?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      routes: {
        Row: {
          id: string
          freight_id: number
          driver_id: string
          origin: string
          origin_state: string
          origin_address: string | null
          destination: string
          destination_state: string
          destination_address: string | null
          vehicle: string
          plate: string
          weight: string
          estimated_delivery: string
          pickup_date: string
          status: 'pending' | 'inTransit' | 'pickedUp' | 'delivered' | 'cancelled'
          company_name: string | null
          company_responsible: string | null
          company_phone: string | null
          company_email: string | null
          company_address: string | null
          company_city: string | null
          company_state: string | null
          created_by_user_id?: string | null
          distance_km?: number | null
          nf_value?: number | null
          observation?: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          freight_id: number
          driver_id: string
          origin: string
          origin_state: string
          origin_address?: string | null
          destination: string
          destination_state: string
          destination_address?: string | null
          vehicle: string
          plate: string
          weight: string
          estimated_delivery: string
          pickup_date: string
          status?: 'pending' | 'inTransit' | 'pickedUp' | 'delivered' | 'cancelled'
          company_name?: string | null
          company_responsible?: string | null
          company_phone?: string | null
          company_email?: string | null
          company_address?: string | null
          company_city?: string | null
          company_state?: string | null
          created_by_user_id?: string | null
          distance_km?: number | null
          nf_value?: number | null
          observation?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          freight_id?: number
          driver_id?: string
          origin?: string
          origin_state?: string
          origin_address?: string | null
          destination?: string
          destination_state?: string
          destination_address?: string | null
          vehicle?: string
          plate?: string
          weight?: string
          estimated_delivery?: string
          pickup_date?: string
          status?: 'pending' | 'inTransit' | 'pickedUp' | 'delivered' | 'cancelled'
          company_name?: string | null
          company_responsible?: string | null
          company_phone?: string | null
          company_email?: string | null
          company_address?: string | null
          company_city?: string | null
          company_state?: string | null
          created_by_user_id?: string | null
          distance_km?: number | null
          nf_value?: number | null
          observation?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      checkins: {
        Row: {
          id: string
          type: 'pickup' | 'delivery'
          timestamp: string
          photo_url: string
          coords_lat: number
          coords_lng: number
          address: string | null
          distance: number | null
          freight_id: number | null
          driver_id: string | null
          route_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          type: 'pickup' | 'delivery'
          timestamp: string
          photo_url: string
          coords_lat: number
          coords_lng: number
          address?: string | null
          distance?: number | null
          freight_id?: number | null
          driver_id?: string | null
          route_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          type?: 'pickup' | 'delivery'
          timestamp?: string
          photo_url?: string
          coords_lat?: number
          coords_lng?: number
          address?: string | null
          distance?: number | null
          freight_id?: number | null
          driver_id?: string | null
          route_id?: string | null
          created_at?: string
        }
      }
      clients: {
        Row: {
          id: string
          company_name: string
          responsible: string
          whatsapp: string
          email: string
          address: string
          extension: string | null
          city: string
          neighborhood: string
          state: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          company_name: string
          responsible: string
          whatsapp: string
          email: string
          address: string
          extension?: string | null
          city: string
          neighborhood: string
          state: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          company_name?: string
          responsible?: string
          whatsapp?: string
          email?: string
          address?: string
          extension?: string | null
          city?: string
          neighborhood?: string
          state?: string
          created_at?: string
          updated_at?: string
        }
      }
      calendar_events: {
        Row: {
          id: string
          event_type: 'entrega' | 'recebimento' | 'reuniao' | 'outro'
          title: string
          description: string | null
          event_at: string
          created_by_user_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          event_type: 'entrega' | 'recebimento' | 'reuniao' | 'outro'
          title: string
          description?: string | null
          event_at: string
          created_by_user_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          event_type?: 'entrega' | 'recebimento' | 'reuniao' | 'outro'
          title?: string
          description?: string | null
          event_at?: string
          created_by_user_id?: string | null
          created_at?: string
          updated_at?: string
        }
      }
    }
  }
}


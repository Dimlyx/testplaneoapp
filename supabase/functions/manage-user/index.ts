import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Verify caller is super_admin
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
    const token = authHeader.replace('Bearer ', '')
    const { data: { user: caller }, error: authError } = await supabaseAdmin.auth.getUser(token)
    if (authError || !caller) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const { data: callerRole } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', caller.id)
      .maybeSingle()

    if (callerRole?.role !== 'super_admin') {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const body = await req.json()
    const { action, userId } = body

    if (!userId || !action) {
      return new Response(JSON.stringify({ error: 'Missing action or userId' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Prevent self-deletion
    if (action === 'delete' && userId === caller.id) {
      return new Response(JSON.stringify({ error: 'Vous ne pouvez pas supprimer votre propre compte' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    switch (action) {
      case 'update_email': {
        const { email } = body
        if (!email) {
          return new Response(JSON.stringify({ error: 'Email requis' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, { email })
        if (error) throw error
        // Also update profile
        await supabaseAdmin.from('profiles').update({ email }).eq('id', userId)
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      case 'update_password': {
        const { password } = body
        if (!password || password.length < 6) {
          return new Response(JSON.stringify({ error: 'Mot de passe requis (min. 6 caractères)' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, { password })
        if (error) throw error
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      case 'update_profile': {
        const { full_name, phone } = body
        const updates: Record<string, string | null> = {}
        if (full_name !== undefined) updates.full_name = full_name
        if (phone !== undefined) updates.phone = phone
        const { error } = await supabaseAdmin.from('profiles').update(updates).eq('id', userId)
        if (error) throw error
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      case 'delete': {
        // Get user's org to clean up related data
        const { data: userRole } = await supabaseAdmin
          .from('user_roles')
          .select('organization_id')
          .eq('user_id', userId)
          .maybeSingle()

        // Clean up notifications
        await supabaseAdmin.from('notifications').delete().eq('user_id', userId)

        // Unassign from interventions (set technician_id to null)
        await supabaseAdmin.from('interventions').update({ technician_id: null }).eq('technician_id', userId)

        // Delete user roles and profile
        await supabaseAdmin.from('user_roles').delete().eq('user_id', userId)
        await supabaseAdmin.from('profiles').delete().eq('id', userId)

        // Delete auth user
        const { error } = await supabaseAdmin.auth.admin.deleteUser(userId)
        if (error) throw error

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      default:
        return new Response(JSON.stringify({ error: 'Action inconnue' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }
  } catch (error) {
    console.error('Manage user error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

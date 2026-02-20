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

    // 1. Create demo organization
    const { data: org, error: orgError } = await supabaseAdmin
      .from('organizations')
      .insert({
        name: 'Entreprise Démo',
        slug: 'demo-' + Date.now(),
        email: 'contact@demo-planeo.fr',
        phone: '01 23 45 67 89',
        address: '12 Rue de la Paix',
        city: 'Paris',
        postal_code: '75001',
        plan: 'business',
        status: 'active',
        subscription_status: 'active',
      })
      .select()
      .single()

    if (orgError) throw new Error('Org creation failed: ' + orgError.message)

    const orgId = org.id

    // 2. Create admin user
    const adminPassword = 'DemoAdmin2024!'
    const { data: adminAuth, error: adminAuthError } = await supabaseAdmin.auth.admin.createUser({
      email: 'admin@demo-planeo.fr',
      password: adminPassword,
      email_confirm: true,
      user_metadata: { full_name: 'Sophie Dupont' }
    })
    if (adminAuthError) throw new Error('Admin user creation failed: ' + adminAuthError.message)

    await supabaseAdmin.from('profiles').upsert({
      id: adminAuth.user.id,
      email: 'admin@demo-planeo.fr',
      full_name: 'Sophie Dupont',
      organization_id: orgId,
    })
    await supabaseAdmin.from('user_roles').upsert({
      user_id: adminAuth.user.id,
      role: 'admin',
      organization_id: orgId,
    })

    // 3. Create technician user
    const techPassword = 'DemoTech2024!'
    const { data: techAuth, error: techAuthError } = await supabaseAdmin.auth.admin.createUser({
      email: 'technicien@demo-planeo.fr',
      password: techPassword,
      email_confirm: true,
      user_metadata: { full_name: 'Marc Lefevre' }
    })
    if (techAuthError) throw new Error('Tech user creation failed: ' + techAuthError.message)

    await supabaseAdmin.from('profiles').upsert({
      id: techAuth.user.id,
      email: 'technicien@demo-planeo.fr',
      full_name: 'Marc Lefevre',
      organization_id: orgId,
    })
    await supabaseAdmin.from('user_roles').upsert({
      user_id: techAuth.user.id,
      role: 'technician',
      organization_id: orgId,
    })

    // 4. Create demo clients
    const { data: clients, error: clientsError } = await supabaseAdmin
      .from('clients')
      .insert([
        {
          name: 'Martin Pierre',
          client_type: 'individual',
          address: '5 Avenue Victor Hugo',
          city: 'Lyon',
          postal_code: '69001',
          email: 'p.martin@email.fr',
          phone: '06 12 34 56 78',
          organization_id: orgId,
        },
        {
          name: 'SCI Les Fontaines',
          client_type: 'professional',
          address: '28 Rue du Commerce',
          city: 'Marseille',
          postal_code: '13001',
          email: 'contact@lesfontaines.fr',
          phone: '04 91 23 45 67',
          organization_id: orgId,
        },
        {
          name: 'Durand Famille',
          client_type: 'individual',
          address: '14 Chemin des Lilas',
          city: 'Bordeaux',
          postal_code: '33000',
          email: 'famille.durand@email.fr',
          phone: '05 56 78 90 12',
          organization_id: orgId,
        },
      ])
      .select()

    if (clientsError) throw new Error('Clients creation failed: ' + clientsError.message)

    const client1 = clients[0]
    const client2 = clients[1]
    const client3 = clients[2]

    // 5. Create demo equipment
    const { data: equipments, error: eqError } = await supabaseAdmin
      .from('equipment')
      .insert([
        {
          client_id: client1.id,
          organization_id: orgId,
          brand: 'Atlantic',
          model: 'Extensa 200',
          equipment_type: 'Chauffe-eau',
          serial_number: 'ATL-2023-00421',
          installation_date: '2021-03-15',
        },
        {
          client_id: client2.id,
          organization_id: orgId,
          brand: 'Daikin',
          model: 'Emura FTXJ25',
          equipment_type: 'Climatisation',
          serial_number: 'DAI-2022-88712',
          installation_date: '2022-06-20',
        },
        {
          client_id: client3.id,
          organization_id: orgId,
          brand: 'De Dietrich',
          model: 'MS 24 Micro',
          equipment_type: 'Chaudière',
          serial_number: 'DD-2020-55390',
          installation_date: '2020-11-08',
        },
      ])
      .select()

    if (eqError) throw new Error('Equipment creation failed: ' + eqError.message)

    // 6. Create intervention types
    const { data: intTypes, error: intTypesError } = await supabaseAdmin
      .from('intervention_types')
      .insert([
        { name: 'maintenance', label: 'Maintenance', organization_id: orgId, color: 'blue', track_journey: true },
        { name: 'depannage', label: 'Dépannage', organization_id: orgId, color: 'red', track_journey: true },
        { name: 'installation', label: 'Installation', organization_id: orgId, color: 'green', track_journey: false },
      ])
      .select()

    if (intTypesError) throw new Error('Intervention types creation failed: ' + intTypesError.message)

    const typeId = intTypes[0].id

    // 7. Create demo interventions
    const today = new Date()
    const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1)
    const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1)
    const fmt = (d: Date) => d.toISOString().split('T')[0]

    await supabaseAdmin.from('interventions').insert([
      {
        title: 'Entretien chauffe-eau - Martin Pierre',
        client_id: client1.id,
        equipment_id: equipments[0].id,
        technician_id: techAuth.user.id,
        organization_id: orgId,
        intervention_type: 'maintenance',
        status: 'planned',
        scheduled_date: fmt(tomorrow),
        scheduled_time: '09:00',
        description: 'Entretien annuel du chauffe-eau électrique.',
        intervention_address: '5 Avenue Victor Hugo',
        intervention_city: 'Lyon',
        intervention_postal_code: '69001',
        intervention_contact_name: 'Pierre Martin',
        intervention_phone: '06 12 34 56 78',
      },
      {
        title: 'Panne climatisation - SCI Les Fontaines',
        client_id: client2.id,
        equipment_id: equipments[1].id,
        technician_id: techAuth.user.id,
        organization_id: orgId,
        intervention_type: 'depannage',
        status: 'in_progress',
        scheduled_date: fmt(today),
        scheduled_time: '14:00',
        description: 'Climatisation ne refroidit plus. Vérification gaz et compresseur.',
        arrival_time: '14:10',
        intervention_address: '28 Rue du Commerce',
        intervention_city: 'Marseille',
        intervention_postal_code: '13001',
        intervention_contact_name: 'Gérance Les Fontaines',
        intervention_phone: '04 91 23 45 67',
      },
      {
        title: 'Révision chaudière - Durand',
        client_id: client3.id,
        equipment_id: equipments[2].id,
        technician_id: techAuth.user.id,
        organization_id: orgId,
        intervention_type: 'maintenance',
        status: 'completed',
        scheduled_date: fmt(yesterday),
        scheduled_time: '10:30',
        description: 'Révision annuelle chaudière gaz. Remplacement filtre et nettoyage brûleur.',
        arrival_time: '10:35',
        departure_time: '12:00',
        report: 'Révision effectuée avec succès. Remplacement du filtre à gaz et nettoyage complet du brûleur. Appareil en bon état de fonctionnement.',
        intervention_address: '14 Chemin des Lilas',
        intervention_city: 'Bordeaux',
        intervention_postal_code: '33000',
        intervention_contact_name: 'Madame Durand',
        intervention_phone: '05 56 78 90 12',
      },
      {
        title: 'Maintenance préventive - SCI Les Fontaines',
        client_id: client2.id,
        organization_id: orgId,
        intervention_type: 'maintenance',
        status: 'to_plan',
        description: 'Contrôle préventif de l\'installation de climatisation. À planifier avant l\'été.',
      },
    ])

    return new Response(
      JSON.stringify({
        success: true,
        credentials: {
          admin: { email: 'admin@demo-planeo.fr', password: adminPassword },
          technician: { email: 'technicien@demo-planeo.fr', password: techPassword },
        },
        organization: { name: 'Entreprise Démo', id: orgId },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Demo setup error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

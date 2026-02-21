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

    // 1. Cleanup existing demo data thoroughly
    // Find existing demo org(s)
    const { data: existingOrgs } = await supabaseAdmin
      .from('organizations')
      .select('id')
      .eq('email', 'contact@demo-planeo.tech')

    for (const existingOrg of existingOrgs ?? []) {
      const oid = existingOrg.id

      // Delete step completions for interventions in this org
      const { data: orgInterventions } = await supabaseAdmin
        .from('interventions')
        .select('id')
        .eq('organization_id', oid)
      const intIds = (orgInterventions ?? []).map(i => i.id)
      if (intIds.length > 0) {
        await supabaseAdmin.from('intervention_step_completions').delete().in('intervention_id', intIds)
        await supabaseAdmin.from('intervention_photos').delete().in('intervention_id', intIds)
        await supabaseAdmin.from('intervention_attachments').delete().in('intervention_id', intIds)
        await supabaseAdmin.from('intervention_equipment').delete().in('intervention_id', intIds)
        await supabaseAdmin.from('intervention_pauses').delete().in('intervention_id', intIds)
      }

      // Delete interventions, equipment, client data, etc.
      await supabaseAdmin.from('interventions').delete().eq('organization_id', oid)
      await supabaseAdmin.from('maintenance_alerts').delete().eq('organization_id', oid)
      await supabaseAdmin.from('equipment').delete().eq('organization_id', oid)
      await supabaseAdmin.from('client_contacts').delete().eq('organization_id', oid)
      await supabaseAdmin.from('client_notes').delete().eq('organization_id', oid)
      await supabaseAdmin.from('client_documents').delete().eq('organization_id', oid)
      await supabaseAdmin.from('clients').delete().eq('organization_id', oid)
      await supabaseAdmin.from('intervention_workflow_steps').delete().eq('organization_id', oid)
      await supabaseAdmin.from('intervention_types').delete().eq('organization_id', oid)
      await supabaseAdmin.from('app_settings').delete().eq('organization_id', oid)
      await supabaseAdmin.from('notifications').delete().in('user_id',
        (await supabaseAdmin.from('user_roles').select('user_id').eq('organization_id', oid)).data?.map(r => r.user_id) ?? []
      )

      // Delete user roles and profiles for this org
      const { data: orgRoles } = await supabaseAdmin
        .from('user_roles')
        .select('user_id')
        .eq('organization_id', oid)
      const userIds = (orgRoles ?? []).map(r => r.user_id)
      await supabaseAdmin.from('user_roles').delete().eq('organization_id', oid)
      for (const uid of userIds) {
        await supabaseAdmin.from('profiles').delete().eq('id', uid)
        await supabaseAdmin.auth.admin.deleteUser(uid)
      }

      // Delete org
      await supabaseAdmin.from('organizations').delete().eq('id', oid)
    }

    // Also cleanup any orphaned demo auth users
    const demoEmails = ['demo.admin@planeo.tech', 'demo.technicien@planeo.tech']
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers()
    for (const u of existingUsers?.users ?? []) {
      if (demoEmails.includes(u.email ?? '')) {
        await supabaseAdmin.from('user_roles').delete().eq('user_id', u.id)
        await supabaseAdmin.from('profiles').delete().eq('id', u.id)
        await supabaseAdmin.auth.admin.deleteUser(u.id)
      }
    }

    // 2. Create demo organization
    const { data: org, error: orgError } = await supabaseAdmin
      .from('organizations')
      .insert({
        name: 'Entreprise Démo',
        slug: 'demo-' + Date.now(),
        email: 'contact@demo-planeo.tech',
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

    // 3. Create admin user — Sophie Martin
    const adminPassword = 'DemoAdmin2024!'
    const { data: adminAuth, error: adminAuthError } = await supabaseAdmin.auth.admin.createUser({
      email: 'demo.admin@planeo.tech',
      password: adminPassword,
      email_confirm: true,
      user_metadata: { full_name: 'Sophie Martin' }
    })
    if (adminAuthError) throw new Error('Admin user creation failed: ' + adminAuthError.message)

    await supabaseAdmin.from('profiles').upsert({
      id: adminAuth.user.id,
      email: 'demo.admin@planeo.tech',
      full_name: 'Sophie Martin',
      organization_id: orgId,
    })
    await supabaseAdmin.from('user_roles').upsert({
      user_id: adminAuth.user.id,
      role: 'admin',
      organization_id: orgId,
    })

    // 4. Create technician user — Lucas Bernard
    const techPassword = 'DemoTech2024!'
    const { data: techAuth, error: techAuthError } = await supabaseAdmin.auth.admin.createUser({
      email: 'demo.technicien@planeo.tech',
      password: techPassword,
      email_confirm: true,
      user_metadata: { full_name: 'Lucas Bernard' }
    })
    if (techAuthError) throw new Error('Tech user creation failed: ' + techAuthError.message)

    await supabaseAdmin.from('profiles').upsert({
      id: techAuth.user.id,
      email: 'demo.technicien@planeo.tech',
      full_name: 'Lucas Bernard',
      organization_id: orgId,
    })
    await supabaseAdmin.from('user_roles').upsert({
      user_id: techAuth.user.id,
      role: 'technician',
      organization_id: orgId,
    })

    // 5. Create demo clients
    const { data: clients, error: clientsError } = await supabaseAdmin
      .from('clients')
      .insert([
        { name: 'Martin Pierre', client_type: 'individual', address: '5 Avenue Victor Hugo', city: 'Lyon', postal_code: '69001', email: 'p.martin@email.fr', phone: '06 12 34 56 78', organization_id: orgId },
        { name: 'SCI Les Fontaines', client_type: 'professional', address: '28 Rue du Commerce', city: 'Marseille', postal_code: '13001', email: 'contact@lesfontaines.fr', phone: '04 91 23 45 67', organization_id: orgId },
        { name: 'Durand Famille', client_type: 'individual', address: '14 Chemin des Lilas', city: 'Bordeaux', postal_code: '33000', email: 'famille.durand@email.fr', phone: '05 56 78 90 12', organization_id: orgId },
        { name: 'Restaurant Le Gourmet', client_type: 'professional', address: '8 Place Bellecour', city: 'Lyon', postal_code: '69002', email: 'contact@legourmet.fr', phone: '04 72 11 22 33', organization_id: orgId },
        { name: 'Lefebvre Jacques', client_type: 'individual', address: '22 Rue des Roses', city: 'Toulouse', postal_code: '31000', email: 'j.lefebvre@email.fr', phone: '06 98 76 54 32', organization_id: orgId },
      ])
      .select()

    if (clientsError) throw new Error('Clients creation failed: ' + clientsError.message)

    // 6. Create demo equipment
    const { data: equipments, error: eqError } = await supabaseAdmin
      .from('equipment')
      .insert([
        { client_id: clients[0].id, organization_id: orgId, brand: 'Atlantic', model: 'Extensa 200', equipment_type: 'Chauffe-eau', serial_number: 'ATL-2023-00421', installation_date: '2021-03-15' },
        { client_id: clients[1].id, organization_id: orgId, brand: 'Daikin', model: 'Emura FTXJ25', equipment_type: 'Climatisation', serial_number: 'DAI-2022-88712', installation_date: '2022-06-20' },
        { client_id: clients[2].id, organization_id: orgId, brand: 'De Dietrich', model: 'MS 24 Micro', equipment_type: 'Chaudière', serial_number: 'DD-2020-55390', installation_date: '2020-11-08' },
        { client_id: clients[3].id, organization_id: orgId, brand: 'Mitsubishi', model: 'MSZ-LN35', equipment_type: 'Climatisation', serial_number: 'MIT-2023-11200', installation_date: '2023-01-10' },
        { client_id: clients[4].id, organization_id: orgId, brand: 'Saunier Duval', model: 'ThemaPlus F25', equipment_type: 'Chaudière', serial_number: 'SD-2019-44100', installation_date: '2019-09-01' },
        { client_id: clients[0].id, organization_id: orgId, brand: 'Daikin', model: 'Altherma 3', equipment_type: 'Pompe à chaleur', serial_number: 'DAI-2024-00100', installation_date: '2024-02-15' },
      ])
      .select()

    if (eqError) throw new Error('Equipment creation failed: ' + eqError.message)

    // 7. Create intervention types
    const ts = Date.now()
    const { data: intTypes, error: intTypesError } = await supabaseAdmin
      .from('intervention_types')
      .insert([
        { name: `demo_maintenance_${ts}`, label: 'Maintenance', organization_id: orgId, color: 'blue', track_journey: true },
        { name: `demo_depannage_${ts}`, label: 'Dépannage', organization_id: orgId, color: 'red', track_journey: true },
        { name: `demo_installation_${ts}`, label: 'Installation', organization_id: orgId, color: 'green', track_journey: false },
      ])
      .select()

    if (intTypesError) throw new Error('Intervention types creation failed: ' + intTypesError.message)

    const maintenance = intTypes[0].name
    const depannage = intTypes[1].name
    const installation = intTypes[2].name
    const techId = techAuth.user.id

    // 8. Create 20 demo interventions across all statuses
    const today = new Date()
    const day = (offset: number) => {
      const d = new Date(today)
      d.setDate(today.getDate() + offset)
      return d.toISOString().split('T')[0]
    }

    const interventions = [
      // --- TO_PLAN (3) ---
      { title: 'Maintenance préventive clim - SCI Les Fontaines', client_id: clients[1].id, organization_id: orgId, intervention_type: maintenance, status: 'to_plan', technician_id: techId, description: 'Contrôle préventif climatisation avant l\'été.' },
      { title: 'Vérification chaudière - Lefebvre', client_id: clients[4].id, organization_id: orgId, intervention_type: maintenance, status: 'to_plan', technician_id: techId, description: 'Contrôle annuel chaudière gaz.' },
      { title: 'Installation PAC - Restaurant Le Gourmet', client_id: clients[3].id, organization_id: orgId, intervention_type: installation, status: 'to_plan', technician_id: techId, description: 'Nouvelle installation pompe à chaleur pour la cuisine.' },

      // --- PLANNED (5) ---
      { title: 'Entretien chauffe-eau - Martin Pierre', client_id: clients[0].id, equipment_id: equipments[0].id, technician_id: techId, organization_id: orgId, intervention_type: maintenance, status: 'planned', scheduled_date: day(1), scheduled_time: '09:00', description: 'Entretien annuel du chauffe-eau.', intervention_address: '5 Avenue Victor Hugo', intervention_city: 'Lyon', intervention_postal_code: '69001', intervention_contact_name: 'Pierre Martin', intervention_phone: '06 12 34 56 78' },
      { title: 'Révision climatisation - Restaurant Le Gourmet', client_id: clients[3].id, equipment_id: equipments[3].id, technician_id: techId, organization_id: orgId, intervention_type: maintenance, status: 'planned', scheduled_date: day(2), scheduled_time: '10:00', description: 'Révision annuelle climatisation restaurant.', intervention_address: '8 Place Bellecour', intervention_city: 'Lyon', intervention_postal_code: '69002', intervention_contact_name: 'Gérant Le Gourmet', intervention_phone: '04 72 11 22 33' },
      { title: 'Dépannage chaudière - Lefebvre', client_id: clients[4].id, equipment_id: equipments[4].id, technician_id: techId, organization_id: orgId, intervention_type: depannage, status: 'planned', scheduled_date: day(3), scheduled_time: '14:00', description: 'Chaudière qui fait du bruit, diagnostic nécessaire.', intervention_address: '22 Rue des Roses', intervention_city: 'Toulouse', intervention_postal_code: '31000', intervention_contact_name: 'Jacques Lefebvre', intervention_phone: '06 98 76 54 32' },
      { title: 'Contrôle PAC - Martin Pierre', client_id: clients[0].id, equipment_id: equipments[5].id, technician_id: techId, organization_id: orgId, intervention_type: maintenance, status: 'planned', scheduled_date: day(5), scheduled_time: '08:30', description: 'Contrôle de la pompe à chaleur récemment installée.', intervention_address: '5 Avenue Victor Hugo', intervention_city: 'Lyon', intervention_postal_code: '69001', intervention_contact_name: 'Pierre Martin', intervention_phone: '06 12 34 56 78' },
      { title: 'Installation thermostat connecté - Durand', client_id: clients[2].id, technician_id: techId, organization_id: orgId, intervention_type: installation, status: 'planned', scheduled_date: day(7), scheduled_time: '11:00', description: 'Installation thermostat Netatmo.', intervention_address: '14 Chemin des Lilas', intervention_city: 'Bordeaux', intervention_postal_code: '33000', intervention_contact_name: 'Madame Durand', intervention_phone: '05 56 78 90 12' },

      // --- IN_PROGRESS (3) ---
      { title: 'Panne climatisation - SCI Les Fontaines', client_id: clients[1].id, equipment_id: equipments[1].id, technician_id: techId, organization_id: orgId, intervention_type: depannage, status: 'in_progress', scheduled_date: day(0), scheduled_time: '14:00', arrival_time: '14:10', description: 'Climatisation ne refroidit plus.', intervention_address: '28 Rue du Commerce', intervention_city: 'Marseille', intervention_postal_code: '13001', intervention_contact_name: 'Gérance Les Fontaines', intervention_phone: '04 91 23 45 67' },
      { title: 'Réparation fuite - Martin Pierre', client_id: clients[0].id, equipment_id: equipments[0].id, technician_id: techId, organization_id: orgId, intervention_type: depannage, status: 'in_progress', scheduled_date: day(0), scheduled_time: '09:00', arrival_time: '09:15', description: 'Fuite détectée au niveau du chauffe-eau.', intervention_address: '5 Avenue Victor Hugo', intervention_city: 'Lyon', intervention_postal_code: '69001', intervention_contact_name: 'Pierre Martin', intervention_phone: '06 12 34 56 78' },
      { title: 'Mise en service clim - Restaurant Le Gourmet', client_id: clients[3].id, equipment_id: equipments[3].id, technician_id: techId, organization_id: orgId, intervention_type: installation, status: 'in_progress', scheduled_date: day(0), scheduled_time: '16:00', arrival_time: '16:05', description: 'Mise en service après installation nouvelle unité.', intervention_address: '8 Place Bellecour', intervention_city: 'Lyon', intervention_postal_code: '69002', intervention_contact_name: 'Gérant Le Gourmet', intervention_phone: '04 72 11 22 33' },

      // --- COMPLETED (4) ---
      { title: 'Révision chaudière - Durand', client_id: clients[2].id, equipment_id: equipments[2].id, technician_id: techId, organization_id: orgId, intervention_type: maintenance, status: 'completed', scheduled_date: day(-1), scheduled_time: '10:30', arrival_time: '10:35', departure_time: '12:00', report: 'Révision effectuée. Remplacement filtre à gaz et nettoyage brûleur. Appareil en bon état.', intervention_address: '14 Chemin des Lilas', intervention_city: 'Bordeaux', intervention_postal_code: '33000', intervention_contact_name: 'Madame Durand', intervention_phone: '05 56 78 90 12' },
      { title: 'Dépannage urgent clim - SCI Les Fontaines', client_id: clients[1].id, equipment_id: equipments[1].id, technician_id: techId, organization_id: orgId, intervention_type: depannage, status: 'completed', scheduled_date: day(-3), scheduled_time: '08:00', arrival_time: '08:10', departure_time: '10:30', report: 'Remplacement du compresseur défectueux. Test OK.', intervention_address: '28 Rue du Commerce', intervention_city: 'Marseille', intervention_postal_code: '13001', intervention_contact_name: 'Gérance Les Fontaines', intervention_phone: '04 91 23 45 67' },
      { title: 'Entretien PAC - Martin Pierre', client_id: clients[0].id, equipment_id: equipments[5].id, technician_id: techId, organization_id: orgId, intervention_type: maintenance, status: 'completed', scheduled_date: day(-5), scheduled_time: '14:00', arrival_time: '14:00', departure_time: '15:30', report: 'Nettoyage filtres, vérification pression. RAS.', intervention_address: '5 Avenue Victor Hugo', intervention_city: 'Lyon', intervention_postal_code: '69001', intervention_contact_name: 'Pierre Martin', intervention_phone: '06 12 34 56 78' },
      { title: 'Installation radiateur - Lefebvre', client_id: clients[4].id, technician_id: techId, organization_id: orgId, intervention_type: installation, status: 'completed', scheduled_date: day(-7), scheduled_time: '09:00', arrival_time: '09:10', departure_time: '13:00', report: 'Installation de 3 radiateurs électriques Atlantic. Mise en service OK.', intervention_address: '22 Rue des Roses', intervention_city: 'Toulouse', intervention_postal_code: '31000', intervention_contact_name: 'Jacques Lefebvre', intervention_phone: '06 98 76 54 32' },

      // --- TO_INVOICE (3) ---
      { title: 'Maintenance complète - Restaurant Le Gourmet', client_id: clients[3].id, equipment_id: equipments[3].id, technician_id: techId, organization_id: orgId, intervention_type: maintenance, status: 'to_invoice', scheduled_date: day(-2), scheduled_time: '09:00', arrival_time: '09:05', departure_time: '11:30', report: 'Maintenance complète du système de climatisation. Recharge gaz effectuée.', intervention_address: '8 Place Bellecour', intervention_city: 'Lyon', intervention_postal_code: '69002', intervention_contact_name: 'Gérant Le Gourmet', intervention_phone: '04 72 11 22 33' },
      { title: 'Remplacement thermostat - Durand', client_id: clients[2].id, equipment_id: equipments[2].id, technician_id: techId, organization_id: orgId, intervention_type: depannage, status: 'to_invoice', scheduled_date: day(-4), scheduled_time: '15:00', arrival_time: '15:10', departure_time: '16:00', report: 'Thermostat défaillant remplacé par modèle programmable.', intervention_address: '14 Chemin des Lilas', intervention_city: 'Bordeaux', intervention_postal_code: '33000', intervention_contact_name: 'Madame Durand', intervention_phone: '05 56 78 90 12' },
      { title: 'Détartrage chauffe-eau - Martin Pierre', client_id: clients[0].id, equipment_id: equipments[0].id, technician_id: techId, organization_id: orgId, intervention_type: maintenance, status: 'to_invoice', scheduled_date: day(-6), scheduled_time: '10:00', arrival_time: '10:00', departure_time: '11:30', report: 'Détartrage complet et remplacement anode. Bon fonctionnement.', intervention_address: '5 Avenue Victor Hugo', intervention_city: 'Lyon', intervention_postal_code: '69001', intervention_contact_name: 'Pierre Martin', intervention_phone: '06 12 34 56 78' },

      // --- ARCHIVED (2) ---
      { title: 'Installation clim bureau - SCI Les Fontaines', client_id: clients[1].id, equipment_id: equipments[1].id, technician_id: techId, organization_id: orgId, intervention_type: installation, status: 'archived', scheduled_date: day(-30), scheduled_time: '08:00', arrival_time: '08:00', departure_time: '17:00', report: 'Installation complète système multi-split 4 unités. Mise en service et formation utilisateur.', intervention_address: '28 Rue du Commerce', intervention_city: 'Marseille', intervention_postal_code: '13001', intervention_contact_name: 'Gérance Les Fontaines', intervention_phone: '04 91 23 45 67' },
      { title: 'Révision annuelle chaudière - Lefebvre', client_id: clients[4].id, equipment_id: equipments[4].id, technician_id: techId, organization_id: orgId, intervention_type: maintenance, status: 'archived', scheduled_date: day(-60), scheduled_time: '11:00', arrival_time: '11:00', departure_time: '12:30', report: 'Révision annuelle obligatoire. Certificat de conformité délivré.', intervention_address: '22 Rue des Roses', intervention_city: 'Toulouse', intervention_postal_code: '31000', intervention_contact_name: 'Jacques Lefebvre', intervention_phone: '06 98 76 54 32' },
    ]

    const { data: insertedInterventions, error: intError } = await supabaseAdmin.from('interventions').insert(interventions).select()
    if (intError) throw new Error('Interventions creation failed: ' + intError.message)

    // 9. Create workflow steps for each intervention type
    const demoPhotoUrl = 'https://gwqjwclvrihumhqzoikv.supabase.co/storage/v1/object/public/client-documents/demo/demo-step-photo.png'

    const workflowStepsDefs = intTypes.flatMap(type => [
      { intervention_type_id: type.id, organization_id: orgId, name: 'verification_visuelle', label: 'Vérification visuelle', description: 'Inspecter visuellement l\'équipement', step_order: 1, is_mandatory: true, requires_photo: true, requires_comment: true },
      { intervention_type_id: type.id, organization_id: orgId, name: 'controle_technique', label: 'Contrôle technique', description: 'Effectuer les mesures et contrôles techniques', step_order: 2, is_mandatory: true, requires_photo: true, requires_comment: true },
      { intervention_type_id: type.id, organization_id: orgId, name: 'nettoyage', label: 'Nettoyage', description: 'Nettoyage des composants', step_order: 3, is_mandatory: false, requires_photo: true, requires_comment: false },
      { intervention_type_id: type.id, organization_id: orgId, name: 'test_final', label: 'Test final', description: 'Vérification du bon fonctionnement après intervention', step_order: 4, is_mandatory: true, requires_photo: false, requires_comment: true },
    ])

    const { data: createdSteps, error: stepsError } = await supabaseAdmin
      .from('intervention_workflow_steps')
      .insert(workflowStepsDefs)
      .select()
    if (stepsError) throw new Error('Workflow steps creation failed: ' + stepsError.message)

    // 10. Create step completions with photos for completed/to_invoice/archived interventions
    const completedInterventions = insertedInterventions.filter(
      i => ['completed', 'to_invoice', 'archived'].includes(i.status)
    )

    const stepCompletions: any[] = []
    for (const interv of completedInterventions) {
      const matchingType = intTypes.find(t => t.name === interv.intervention_type)
      if (!matchingType) continue
      const stepsForType = createdSteps.filter(s => s.intervention_type_id === matchingType.id)
      for (const step of stepsForType) {
        const photoJson = step.requires_photo ? JSON.stringify([demoPhotoUrl]) : null
        const comments = [
          'RAS - Conforme',
          'Vérification OK, aucune anomalie détectée',
          'Intervention réalisée avec succès',
          'Nettoyage complet effectué',
        ]
        stepCompletions.push({
          intervention_id: interv.id,
          step_id: step.id,
          completed_at: new Date().toISOString(),
          completed_by: techId,
          loop_index: 0,
          photo_url: photoJson,
          comment: step.requires_comment ? comments[step.step_order - 1] || 'OK' : null,
        })
      }
    }

    if (stepCompletions.length > 0) {
      const { error: compError } = await supabaseAdmin
        .from('intervention_step_completions')
        .insert(stepCompletions)
      if (compError) throw new Error('Step completions creation failed: ' + compError.message)
    }

    // 11. Create maintenance alerts
    const maintenanceAlerts = [
      { organization_id: orgId, client_id: clients[0].id, equipment_id: equipments[0].id, title: 'Révision annuelle chauffe-eau', description: 'Contrôle annuel obligatoire du chauffe-eau Atlantic', alert_date: day(-5), recurrence: 'yearly', status: 'pending' },
      { organization_id: orgId, client_id: clients[1].id, equipment_id: equipments[1].id, title: 'Entretien climatisation été', description: 'Nettoyage filtres et vérification fluide frigorigène', alert_date: day(0), recurrence: 'yearly', status: 'pending' },
      { organization_id: orgId, client_id: clients[2].id, equipment_id: equipments[2].id, title: 'Maintenance chaudière trimestrielle', description: 'Contrôle pression, purge radiateurs', alert_date: day(7), recurrence: 'quarterly', status: 'pending' },
      { organization_id: orgId, client_id: clients[3].id, equipment_id: equipments[3].id, title: 'Vérification climatisation Mitsubishi', description: 'Contrôle performance et nettoyage unité extérieure', alert_date: day(14), recurrence: 'monthly', status: 'pending' },
      { organization_id: orgId, client_id: clients[4].id, equipment_id: equipments[4].id, title: 'Entretien annuel chaudière Saunier Duval', description: 'Révision complète avec certificat de conformité', alert_date: day(-15), recurrence: 'yearly', status: 'acknowledged' },
      { organization_id: orgId, client_id: clients[0].id, equipment_id: equipments[5].id, title: 'Contrôle pompe à chaleur', description: 'Vérification COP et état du circuit', alert_date: day(-30), recurrence: 'yearly', status: 'completed' },
    ]

    const { error: alertsError } = await supabaseAdmin.from('maintenance_alerts').insert(maintenanceAlerts)
    if (alertsError) throw new Error('Maintenance alerts creation failed: ' + alertsError.message)

    return new Response(
      JSON.stringify({
        success: true,
        credentials: {
          admin: { email: 'demo.admin@planeo.tech', password: adminPassword, name: 'Sophie Martin' },
          technician: { email: 'demo.technicien@planeo.tech', password: techPassword, name: 'Lucas Bernard' },
        },
        organization: { name: 'Entreprise Démo', id: orgId },
        stats: { clients: clients.length, equipment: equipments.length, interventions: interventions.length, maintenanceAlerts: maintenanceAlerts.length },
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

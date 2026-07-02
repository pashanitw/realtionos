-- ============================================================================
-- Industry config pack · REAL ESTATE (the current frontend, expressed as data)
-- ============================================================================
-- Everything the RelationOS UI shows for Aurum Realty is instantiated here as
-- CONFIG ROWS against the generic schema — zero real-estate tables or columns.
-- Run after db/schema.sql. Idempotent per-slug is NOT attempted; run once.
-- ============================================================================

do $pack$
declare
  v_tenant     uuid;
  v_pipeline   uuid;
  v_model      uuid;
  v_type_proj  uuid;
  v_type_unit  uuid;
  v_persona_inv uuid;
  v_rt_cab     uuid;
  v_team       uuid;
  v_role_mgr   uuid;
  v_role_agent uuid;
  v_role_tc    uuid;
  v_u_mgr      uuid;
  v_u_a1       uuid;
  v_u_a2       uuid;
  v_u_tc       uuid;
  v_m_mgr      uuid;
begin

  -- ── Tenant ────────────────────────────────────────────────────────────────
  insert into tenants (slug, name, region, industry_key, plan, currency, timezone, autonomy_level)
  values ('aurum', 'Aurum Realty', 'Hyderabad', 'real-estate', 'growth', 'INR', 'Asia/Kolkata', 2)
  returning id into v_tenant;

  -- Terminology: how the generic core reads in this vertical's UI
  insert into tenant_settings (tenant_id, key, value) values
  (v_tenant, 'terminology', '{
    "contact": "Buyer", "contacts": "Buyers",
    "deal": "Deal", "deals": "Deals",
    "appointment": "Site visit", "appointments": "Site visits",
    "catalog_item": "Property", "catalog_items": "Inventory",
    "resource": "Cab", "resources": "Fleet",
    "resource_operator": "Driver", "resource_operators": "Drivers"
  }'::jsonb),
  -- Overnight window = outside business hours → drives the Morning Brief
  (v_tenant, 'business_hours', '{"open": "09:00", "close": "22:00"}'::jsonb),
  (v_tenant, 'default_locale_currency', '{"currency": "INR", "number_format": "en-IN"}'::jsonb);

  -- ── Roles (nav gating + data scope, per the demo RBAC) ───────────────────
  insert into roles (tenant_id, key, label, data_scope, nav_items, sort_order) values
  (v_tenant, 'manager', 'Manager', 'tenant',
    '{home,worklist,leads,tasks,concierge,meetings,pipeline,inventory,logistics,broadcast,approvals,team,analytics,knowledge,settings}', 1),
  (v_tenant, 'agent', 'Sales Agent', 'own',
    '{home,worklist,leads,tasks,concierge,meetings,pipeline,inventory,knowledge}', 2),
  (v_tenant, 'telecaller', 'Telecaller', 'tenant',
    '{home,worklist,leads,concierge,logistics,knowledge}', 3);

  select id into v_role_mgr   from roles where tenant_id = v_tenant and key = 'manager';
  select id into v_role_agent from roles where tenant_id = v_tenant and key = 'agent';
  select id into v_role_tc    from roles where tenant_id = v_tenant and key = 'telecaller';

  -- ── Lead sources (the connectors screen) ─────────────────────────────────
  insert into lead_sources (tenant_id, key, label, kind, sort_order) values
  (v_tenant, '99acres',     '99acres',      'portal',   1),
  (v_tenant, 'magicbricks', 'MagicBricks',  'portal',   2),
  (v_tenant, 'housing',     'Housing.com',  'portal',   3),
  (v_tenant, 'whatsapp',    'WhatsApp',     'channel',  4),
  (v_tenant, 'ivr',         'Missed call',  'channel',  5),
  (v_tenant, 'website',     'Website',      'channel',  6),
  (v_tenant, 'walkin',      'Walk-in',      'manual',   7),
  (v_tenant, 'referral',    'Referral',     'referral', 8);

  insert into connectors (tenant_id, name, provider, source_id, channel_key, status, status_detail)
  select v_tenant, s.label || ' sync', 'portal-sync', s.id, null, 'disconnected', 'Awaiting credentials'
  from lead_sources s where s.tenant_id = v_tenant and s.kind = 'portal';
  insert into connectors (tenant_id, name, provider, channel_key, status, status_detail)
  values (v_tenant, 'WhatsApp Business', 'meta-cloud-api', 'whatsapp', 'disconnected', 'Awaiting number verification');

  -- ── The buyer journey pipeline (11 stages, tags carry the semantics) ─────
  insert into pipelines (tenant_id, entity, key, name, is_default)
  values (v_tenant, 'deal', 'buyer-journey', 'Buyer Journey', true)
  returning id into v_pipeline;

  insert into pipeline_stages
    (tenant_id, pipeline_id, key, label, sort_order, probability, tags, require_note_on_entry, sla_hours, is_terminal)
  values
  (v_tenant, v_pipeline, 'new-enquiry',          'New Enquiry',          1,   5, '{}',                              true,  24,  false),
  (v_tenant, v_pipeline, 'qualified',            'Qualified',            2,  15, '{qualified}',                     true,  72,  false),
  (v_tenant, v_pipeline, 'site-visit-scheduled', 'Site Visit Scheduled', 3,  30, '{qualified,visit,milestone}',     true,  96,  false),
  (v_tenant, v_pipeline, 'site-visit-completed', 'Site Visit Completed', 4,  40, '{qualified,visit,milestone}',     true,  96,  false),
  (v_tenant, v_pipeline, 'unit-selected',        'Unit Selected',        5,  55, '{qualified,visit}',               true,  120, false),
  (v_tenant, v_pipeline, 'booking-amount-paid',  'Booking Amount Paid',  6,  70, '{qualified,visit,booked,milestone}', true, null, false),
  (v_tenant, v_pipeline, 'booking-confirmed',    'Booking Confirmed',    7,  80, '{qualified,visit,booked}',        true, null, false),
  (v_tenant, v_pipeline, 'agreement-signed',     'Agreement Signed',     8,  90, '{qualified,visit,booked,milestone}', true, null, false),
  (v_tenant, v_pipeline, 'loan-sanction',        'Loan Sanction',        9,  95, '{qualified,visit,booked}',        true, null, false),
  (v_tenant, v_pipeline, 'registration',         'Registration',        10,  98, '{qualified,visit,booked,milestone}', true, null, false),
  (v_tenant, v_pipeline, 'handover',             'Handover',            11, 100, '{qualified,visit,booked,won,milestone}', true, null, true);

  -- ── Catalog shape: Project → Unit ────────────────────────────────────────
  insert into catalog_item_types (tenant_id, key, label_singular, label_plural, sort_order)
  values (v_tenant, 'project', 'Project', 'Projects', 1)
  returning id into v_type_proj;

  insert into catalog_item_types
    (tenant_id, key, label_singular, label_plural, parent_type_id, availability_labels, sort_order)
  values (v_tenant, 'unit', 'Unit', 'Units', v_type_proj,
    '{"available": "Available", "held": "Blocked", "committed": "Booked", "closed": "Sold"}'::jsonb, 2)
  returning id into v_type_unit;

  -- Project attributes
  insert into field_definitions
    (tenant_id, entity, catalog_item_type_id, key, label, data_type, options, use_in_matching, sort_order) values
  (v_tenant, 'catalog_item', v_type_proj, 'builder',           'Builder',          'text',   null, false, 1),
  (v_tenant, 'catalog_item', v_type_proj, 'rera_no',           'RERA No.',         'text',   null, false, 2),
  (v_tenant, 'catalog_item', v_type_proj, 'locality',          'Locality',         'select',
    '{"choices": ["Kokapet","Gachibowli","Narsingi","Tellapur","Kondapur","Manikonda","Financial District","Nanakramguda"]}'::jsonb, true, 3),
  (v_tenant, 'catalog_item', v_type_proj, 'possession_status', 'Possession',       'select',
    '{"choices": ["ready","under-construction"]}'::jsonb, true, 4),
  (v_tenant, 'catalog_item', v_type_proj, 'possession_date',   'Possession date',  'text',   null, false, 5),
  (v_tenant, 'catalog_item', v_type_proj, 'amenities',         'Amenities',        'multiselect', '{"choices": []}'::jsonb, false, 6),
  (v_tenant, 'catalog_item', v_type_proj, 'towers',            'Towers',           'number', null, false, 7);

  -- Unit attributes
  insert into field_definitions
    (tenant_id, entity, catalog_item_type_id, key, label, data_type, options, unit, use_in_matching, sort_order) values
  (v_tenant, 'catalog_item', v_type_unit, 'tower',            'Tower',        'text',   null, null,   false, 1),
  (v_tenant, 'catalog_item', v_type_unit, 'bhk_config',       'Configuration','select',
    '{"choices": ["1BHK","2BHK","3BHK","4BHK","Villa","Plot"]}'::jsonb, null, true, 2),
  (v_tenant, 'catalog_item', v_type_unit, 'carpet_area_sqft', 'Carpet area',  'number', null, 'sqft', false, 3),
  (v_tenant, 'catalog_item', v_type_unit, 'floor',            'Floor',        'number', null, null,   false, 4),
  (v_tenant, 'catalog_item', v_type_unit, 'facing',           'Facing',       'select',
    '{"choices": ["East","West","North","South","North-East","South-East"]}'::jsonb, null, true, 5);

  -- ── Buyer fields (the profile chips + Buyer Intelligence, Stage 2) ───────
  -- Qualifying fields: the AI must capture these before the buyer is 'qualified'.
  insert into field_definitions
    (tenant_id, entity, key, label, data_type, options, is_qualifying, ai_capture, use_in_matching, match_against, is_merge_tag, sort_order) values
  (v_tenant, 'contact', 'bhk_config',    'Configuration', 'select',
    '{"choices": ["1BHK","2BHK","3BHK","4BHK","Villa","Plot"]}'::jsonb,          true,  true, true,  'bhk_config',        true,  1),
  (v_tenant, 'contact', 'locality_prefs','Locality preferences', 'multiselect',
    '{"choices": ["Kokapet","Gachibowli","Narsingi","Tellapur","Kondapur","Manikonda","Financial District","Nanakramguda"]}'::jsonb,
                                                                                  true,  true, true,  'locality',          true,  2),
  (v_tenant, 'contact', 'possession',    'Possession', 'select',
    '{"choices": ["ready","under-construction","either"]}'::jsonb,                true,  true, true,  'possession_status', false, 3),
  (v_tenant, 'contact', 'loan_status',   'Loan status', 'select',
    '{"choices": ["not needed","pre-approved","in process","needs help"]}'::jsonb, false, true, false, null,               false, 4);
  -- (budget is a promoted fixed column: contacts.budget_min / budget_max)

  -- Buyer-intelligence fields (evolving profile; AI-captured with provenance)
  insert into field_definitions
    (tenant_id, entity, key, label, data_type, options, ai_capture, show_in_profile, is_merge_tag, sort_order) values
  (v_tenant, 'contact', 'preferred_floor',     'Preferred floor',       'text',   null, true, true, false, 10),
  (v_tenant, 'contact', 'facing_pref',         'Facing preference',     'text',   null, true, true, false, 11),
  (v_tenant, 'contact', 'family',              'Family',                'text',   null, true, true, false, 12),
  (v_tenant, 'contact', 'office_location',     'Office',                'text',   null, true, true, false, 13),
  (v_tenant, 'contact', 'school_preference',   'School preference',     'text',   null, true, true, false, 14),
  (v_tenant, 'contact', 'urgency',             'Urgency',               'select',
    '{"choices": ["high","medium","low","exploring"]}'::jsonb,                    true, true, false, 15),
  (v_tenant, 'contact', 'decision_maker',      'Decision maker',        'text',   null, true, true, false, 16),
  (v_tenant, 'contact', 'competitor_project',  'Considering elsewhere', 'text',   null, true, true, false, 17),
  (v_tenant, 'contact', 'best_contact_window', 'Best time to contact',  'text',   null, true, true, false, 18),
  (v_tenant, 'contact', 'concerns',            'Concerns',              'multiselect', '{"choices": []}'::jsonb, true, true, false, 19);

  -- ── Scoring: the buyer-intent model (weights from lib/data/scoring.ts) ───
  insert into scoring_models (tenant_id, entity, name, version, temperature_bands, classification_rules)
  values (v_tenant, 'contact', 'Buyer intent', 1,
    '[{"label": "Hot", "min": 75}, {"label": "Warm", "min": 58}, {"label": "Cold", "min": 0}]'::jsonb,
    '{"new_within_hours": 24, "stalled_after_days_silent": 14,
      "interested_when": "appointment_scheduled", "not_interested_when": "stalled"}'::jsonb)
  returning id into v_model;

  insert into signal_definitions (tenant_id, model_id, key, label, default_weight, sort_order) values
  (v_tenant, v_model, 'budget_fit',        'Budget fit',              1.00, 1),
  (v_tenant, v_model, 'config_locality',   'Config & locality match', 0.90, 2),
  (v_tenant, v_model, 'engagement',        'Engagement',              0.70, 3),
  (v_tenant, v_model, 'site_visit_intent', 'Site-visit intent',       0.95, 4),
  (v_tenant, v_model, 'loan_readiness',    'Loan readiness',          0.55, 5);

  -- ── Personas & playbooks ─────────────────────────────────────────────────
  insert into personas (tenant_id, key, label, rules, sort_order) values
  (v_tenant, 'investor',   'Investor',   '{"loan_status": "not needed", "budget_max_gte": 25000000}'::jsonb, 1),
  (v_tenant, 'luxury',     'Luxury',     '{"bhk_config_in": ["Villa", "4BHK"]}'::jsonb,                      2),
  (v_tenant, 'first-home', 'First home', '{"bhk_config_in": ["1BHK", "2BHK"]}'::jsonb,                       3),
  (v_tenant, 'end-user',   'End-user',   '{"default": true}'::jsonb,                                          4);

  select id into v_persona_inv from personas where tenant_id = v_tenant and key = 'investor';

  insert into playbooks (tenant_id, key, name, description, persona_id, conditions, steps) values
  (v_tenant, 'hot-fast-track', 'Hot buyer fast-track',
   'High-intent buyer: call fast, send matches, lock the visit.', null,
   '{"temperature": "Hot"}'::jsonb,
   '[{"kind": "call",         "within_minutes": 15,  "label": "Call while intent is fresh"},
     {"kind": "send_matches", "within_minutes": 60,  "label": "Send top 3 matched units on WhatsApp"},
     {"kind": "book_visit",   "within_hours":   24,  "label": "Lock a site-visit slot"}]'::jsonb),
  (v_tenant, 'stalled-reengage', 'Stalled re-engagement',
   'Gone quiet: soft nudge with fresh inventory and a price hook.', null,
   '{"stalled": true}'::jsonb,
   '[{"kind": "send_message", "label": "New-inventory nudge with price hook"},
     {"kind": "wait_days",    "days": 3, "label": "Wait 3 days"},
     {"kind": "call",         "label": "Follow-up call if no reply"}]'::jsonb),
  (v_tenant, 'post-visit-close', 'Post-visit close',
   'Visited but not booked: address concerns, use loan help as lever.', null,
   '{"stage_tag": "visit", "not_stage_tag": "booked"}'::jsonb,
   '[{"kind": "send_message", "label": "Thank-you + unit hold offer"},
     {"kind": "assessment",   "type": "home_loan_eligibility", "label": "Run loan eligibility"},
     {"kind": "task",         "label": "Negotiation meeting with decision maker"}]'::jsonb);

  -- Investor persona gets its own play
  insert into playbooks (tenant_id, key, name, persona_id, conditions, steps) values
  (v_tenant, 'investor-roi', 'Investor ROI pitch', v_persona_inv, '{}'::jsonb,
   '[{"kind": "send_message", "label": "Rental-yield + appreciation snapshot for the locality"},
     {"kind": "call",         "label": "Position pre-launch inventory"}]'::jsonb);

  -- ── Lost reasons (win/loss + root-cause analytics) ───────────────────────
  insert into lost_reasons (tenant_id, key, label, sort_order) values
  (v_tenant, 'budget-mismatch',   'Budget mismatch',        1),
  (v_tenant, 'chose-competitor',  'Chose competitor',       2),
  (v_tenant, 'loan-rejected',     'Loan rejected',          3),
  (v_tenant, 'location-mismatch', 'Location did not work',  4),
  (v_tenant, 'postponed',         'Purchase postponed',     5),
  (v_tenant, 'unresponsive',      'Went unresponsive',      6);

  -- ── SLA policies (worklist overdue flags) ────────────────────────────────
  insert into sla_policies (tenant_id, name, applies, first_response_minutes, follow_up_hours, sort_order) values
  (v_tenant, 'Hot leads',       '{"temperature": "Hot"}'::jsonb,   15,  4,  1),
  (v_tenant, 'Portal leads',    '{"source_kind": "portal"}'::jsonb, 30, 24,  2),
  (v_tenant, 'Default',         '{}'::jsonb,                        60, 48,  9);

  -- ── Guardian rulebook (compliance the AI must respect, from the PRD/UI) ──
  insert into policy_rules (tenant_id, key, label, description, category, definition, severity) values
  (v_tenant, 'all-in-pricing', 'Quote all-in pricing only',
   'Never quote base price alone: base + floor-rise + 5% GST + ~6% registration.',
   'pricing', '{"require_components": ["base", "floor_rise", "gst", "registration"]}'::jsonb, 'block'),
  (v_tenant, 'no-guaranteed-returns', 'No guaranteed appreciation claims',
   'Never promise price appreciation, rental yield or resale value as guaranteed.',
   'claims', '{"forbidden_phrases": ["guaranteed returns", "assured appreciation", "guaranteed rental"]}'::jsonb, 'block'),
  (v_tenant, 'rera-disclosure', 'RERA number on first project mention',
   'The RERA registration number must accompany the first mention of any project.',
   'disclosure', '{"require_on_first_mention": "rera_no"}'::jsonb, 'warn'),
  (v_tenant, 'discount-cap', 'Discount authority cap',
   'AI may offer floor-rise waiver only; any base-price discount needs manager approval.',
   'discount', '{"ai_max": "floor_rise_waiver", "beyond_requires": "manager_approval"}'::jsonb, 'block'),
  (v_tenant, 'unit-hold-window', 'Unit hold limited to 48 hours',
   'A unit may be held without booking amount for at most 48 hours.',
   'conduct', '{"max_hold_hours": 48}'::jsonb, 'warn'),
  (v_tenant, 'consent-before-broadcast', 'Outbound only with channel consent',
   'No campaign or AI outbound on a channel without a granted consent record.',
   'data', '{"require": "contact_consents.granted"}'::jsonb, 'block');

  -- ── Field ops: cab fleet with the config-driven movement board ───────────
  insert into resource_types (tenant_id, key, label, status_flow) values
  (v_tenant, 'cab', 'Cab',
   '[{"key": "assigned",  "label": "Assigned"},
     {"key": "pickup",    "label": "Pickup"},
     {"key": "en_route",  "label": "En route"},
     {"key": "at_site",   "label": "At site"},
     {"key": "completed", "label": "Completed"}]'::jsonb)
  returning id into v_rt_cab;

  -- ── Appointment types ────────────────────────────────────────────────────
  insert into appointment_types
    (tenant_id, key, label, default_duration_min, requires_resource, resource_type_id, sort_order) values
  (v_tenant, 'site-visit',          'Site visit',          60, true,  v_rt_cab, 1),
  (v_tenant, 'follow-up-call',      'Follow-up call',      15, false, null,     2),
  (v_tenant, 'negotiation-meeting', 'Negotiation meeting', 45, false, null,     3);

  -- ── Assessments: home-loan eligibility ───────────────────────────────────
  insert into assessment_types (tenant_id, key, label, description, input_schema) values
  (v_tenant, 'home_loan_eligibility', 'Home-loan eligibility',
   'Estimates sanctionable amount from income and obligations.',
   '{"fields": [
      {"key": "monthly_income",  "type": "money"},
      {"key": "existing_emi",    "type": "money"},
      {"key": "tenure_years",    "type": "number"},
      {"key": "property_value",  "type": "money"},
      {"key": "co_applicant",    "type": "boolean"}]}'::jsonb);

  -- ── Knowledge-base taxonomy (the Knowledge module) ───────────────────────
  insert into kb_categories (tenant_id, key, label, sort_order) values
  (v_tenant, 'projects',          'Projects',           1),
  (v_tenant, 'pricing-payment',   'Pricing & Payment',  2),
  (v_tenant, 'legal-compliance',  'Legal & Compliance', 3),
  (v_tenant, 'home-loans',        'Home Loans',         4),
  (v_tenant, 'objection-handling','Objection Handling', 5),
  (v_tenant, 'process-sops',      'Process & SOPs',     6),
  (v_tenant, 'policies',          'Policies',           7);

  -- ── Demo org (optional: the three sign-in personas from the demo) ────────
  insert into users (email, name, avatar_hue) values ('rohan@aurum.in',  'Rohan Mehta',  210) returning id into v_u_mgr;
  insert into users (email, name, avatar_hue) values ('priya@aurum.in',  'Priya Sharma',  30) returning id into v_u_a1;
  insert into users (email, name, avatar_hue) values ('arjun@aurum.in',  'Arjun Reddy',  140) returning id into v_u_a2;
  insert into users (email, name, avatar_hue) values ('kavya@aurum.in',  'Kavya Nair',   320) returning id into v_u_tc;

  insert into teams (tenant_id, name, manager_user_id)
  values (v_tenant, 'Hyderabad Sales', v_u_mgr) returning id into v_team;

  insert into memberships (tenant_id, user_id, role_id, team_id, title, monthly_target) values
  (v_tenant, v_u_mgr, v_role_mgr,   v_team, 'Sales Head',    null)
  returning id into v_m_mgr;
  insert into memberships (tenant_id, user_id, role_id, team_id, title, monthly_target) values
  (v_tenant, v_u_a1,  v_role_agent, v_team, 'Senior Agent',  4),
  (v_tenant, v_u_a2,  v_role_agent, v_team, 'Agent',         3),
  (v_tenant, v_u_tc,  v_role_tc,    v_team, 'Telecaller',    null);

end $pack$;

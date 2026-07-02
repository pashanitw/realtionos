-- ============================================================================
-- Industry config pack · EDUCATION / OVERSEAS ADMISSIONS (proof of genericity)
-- ============================================================================
-- The SAME schema as real estate — not one table or column differs. Only the
-- config rows change: Buyers become Students, Units become Programs, site
-- visits become counselling sessions, loan readiness becomes document
-- readiness. Run after db/schema.sql.
-- ============================================================================

do $pack$
declare
  v_tenant    uuid;
  v_pipeline  uuid;
  v_model     uuid;
  v_type_univ uuid;
  v_type_prog uuid;
begin

  insert into tenants (slug, name, region, industry_key, plan, currency, timezone, autonomy_level)
  values ('meridian', 'Meridian Overseas Admissions', 'Bengaluru', 'education', 'growth', 'INR', 'Asia/Kolkata', 2)
  returning id into v_tenant;

  insert into tenant_settings (tenant_id, key, value) values
  (v_tenant, 'terminology', '{
    "contact": "Student", "contacts": "Students",
    "deal": "Application", "deals": "Applications",
    "appointment": "Counselling session", "appointments": "Sessions",
    "catalog_item": "Program", "catalog_items": "Programs"
  }'::jsonb),
  (v_tenant, 'business_hours', '{"open": "10:00", "close": "20:00"}'::jsonb);

  insert into roles (tenant_id, key, label, data_scope, nav_items, sort_order) values
  (v_tenant, 'manager',    'Branch Manager', 'tenant', '{home,worklist,leads,tasks,concierge,meetings,pipeline,inventory,broadcast,approvals,team,analytics,knowledge,settings}', 1),
  (v_tenant, 'counsellor', 'Counsellor',     'own',    '{home,worklist,leads,tasks,concierge,meetings,pipeline,inventory,knowledge}', 2);

  insert into lead_sources (tenant_id, key, label, kind, sort_order) values
  (v_tenant, 'website',        'Website',          'channel',  1),
  (v_tenant, 'google-ads',     'Google Ads',       'ads',      2),
  (v_tenant, 'instagram',      'Instagram',        'ads',      3),
  (v_tenant, 'education-fair', 'Education fair',   'event',    4),
  (v_tenant, 'whatsapp',       'WhatsApp',         'channel',  5),
  (v_tenant, 'walkin',         'Office walk-in',   'manual',   6),
  (v_tenant, 'referral',       'Student referral', 'referral', 7);

  -- The applicant journey (tags carry semantics exactly like real estate:
  -- 'visit' = counselled in person, 'booked' = committed money, 'won' = enrolled)
  insert into pipelines (tenant_id, entity, key, name, is_default)
  values (v_tenant, 'deal', 'applicant-journey', 'Applicant Journey', true)
  returning id into v_pipeline;

  insert into pipeline_stages
    (tenant_id, pipeline_id, key, label, sort_order, probability, tags, require_note_on_entry, is_terminal) values
  (v_tenant, v_pipeline, 'new-inquiry',         'New Inquiry',          1,   5, '{}',                                true, false),
  (v_tenant, v_pipeline, 'counselled',          'Counselled',           2,  20, '{qualified,visit,milestone}',       true, false),
  (v_tenant, v_pipeline, 'application-started', 'Application Started',  3,  35, '{qualified,visit}',                 true, false),
  (v_tenant, v_pipeline, 'documents-submitted', 'Documents Submitted',  4,  50, '{qualified,visit,milestone}',       true, false),
  (v_tenant, v_pipeline, 'offer-received',      'Offer Received',       5,  65, '{qualified,visit,milestone}',       true, false),
  (v_tenant, v_pipeline, 'fee-paid',            'Fee Paid',             6,  80, '{qualified,visit,booked,milestone}',true, false),
  (v_tenant, v_pipeline, 'visa-filed',          'Visa Filed',           7,  90, '{qualified,visit,booked}',          true, false),
  (v_tenant, v_pipeline, 'visa-approved',       'Visa Approved',        8,  97, '{qualified,visit,booked,milestone}',true, false),
  (v_tenant, v_pipeline, 'enrolled',            'Enrolled',             9, 100, '{qualified,visit,booked,won,milestone}', true, true);

  -- Catalog: University → Program (same shape as Project → Unit)
  insert into catalog_item_types (tenant_id, key, label_singular, label_plural, sort_order)
  values (v_tenant, 'university', 'University', 'Universities', 1)
  returning id into v_type_univ;

  insert into catalog_item_types
    (tenant_id, key, label_singular, label_plural, parent_type_id, availability_labels, sort_order)
  values (v_tenant, 'program', 'Program', 'Programs', v_type_univ,
    '{"available": "Open", "held": "Waitlist", "committed": "Seat blocked", "closed": "Intake closed"}'::jsonb, 2)
  returning id into v_type_prog;

  insert into field_definitions
    (tenant_id, entity, catalog_item_type_id, key, label, data_type, options, use_in_matching, sort_order) values
  (v_tenant, 'catalog_item', v_type_univ, 'country',      'Country',       'select',
    '{"choices": ["UK","USA","Canada","Australia","Germany","Ireland"]}'::jsonb, true, 1),
  (v_tenant, 'catalog_item', v_type_univ, 'qs_ranking',   'QS ranking',    'number', null, false, 2),
  (v_tenant, 'catalog_item', v_type_prog, 'degree_level', 'Degree level',  'select',
    '{"choices": ["Bachelors","Masters","MBA","PhD"]}'::jsonb, true, 1),
  (v_tenant, 'catalog_item', v_type_prog, 'intake',       'Intake',        'select',
    '{"choices": ["Jan 2027","Sep 2027","Jan 2028"]}'::jsonb, true, 2),
  (v_tenant, 'catalog_item', v_type_prog, 'ielts_min',    'IELTS minimum', 'number', null, true, 3),
  (v_tenant, 'catalog_item', v_type_prog, 'duration_months', 'Duration',   'number', null, false, 4);
  -- (tuition = the promoted catalog_items.list_price column)

  -- Student fields (qualifying + evolving intel — same machinery as buyer intel)
  insert into field_definitions
    (tenant_id, entity, key, label, data_type, options, is_qualifying, ai_capture, use_in_matching, match_against, sort_order) values
  (v_tenant, 'contact', 'target_country', 'Target country', 'multiselect',
    '{"choices": ["UK","USA","Canada","Australia","Germany","Ireland"]}'::jsonb, true,  true, true,  'country',      1),
  (v_tenant, 'contact', 'degree_level',   'Degree level',   'select',
    '{"choices": ["Bachelors","Masters","MBA","PhD"]}'::jsonb,                   true,  true, true,  'degree_level', 2),
  (v_tenant, 'contact', 'intake',         'Target intake',  'select',
    '{"choices": ["Jan 2027","Sep 2027","Jan 2028"]}'::jsonb,                    true,  true, true,  'intake',       3),
  (v_tenant, 'contact', 'ielts_score',    'IELTS score',    'number', null,      false, true, true,  'ielts_min',    4),
  (v_tenant, 'contact', 'current_education', 'Current education', 'text', null,  false, true, false, null,           5),
  (v_tenant, 'contact', 'sponsor',        'Sponsor',        'select',
    '{"choices": ["parents","education loan","self-funded","scholarship"]}'::jsonb, false, true, false, null,         6),
  (v_tenant, 'contact', 'urgency',        'Urgency',        'select',
    '{"choices": ["high","medium","low","exploring"]}'::jsonb,                   false, true, false, null,            7),
  (v_tenant, 'contact', 'competitor_consultancy', 'Considering elsewhere', 'text', null, false, true, false, null,    8),
  (v_tenant, 'contact', 'concerns',       'Concerns',       'multiselect', '{"choices": []}'::jsonb, false, true, false, null, 9);

  -- Scoring: admit-intent model (same math, different signals)
  insert into scoring_models (tenant_id, entity, name, version, temperature_bands, classification_rules)
  values (v_tenant, 'contact', 'Admit intent', 1,
    '[{"label": "Hot", "min": 75}, {"label": "Warm", "min": 55}, {"label": "Cold", "min": 0}]'::jsonb,
    '{"new_within_hours": 24, "stalled_after_days_silent": 21}'::jsonb)
  returning id into v_model;

  insert into signal_definitions (tenant_id, model_id, key, label, default_weight, sort_order) values
  (v_tenant, v_model, 'academic_fit',       'Academic fit',        1.00, 1),
  (v_tenant, v_model, 'budget_fit',         'Budget fit',          0.90, 2),
  (v_tenant, v_model, 'engagement',         'Engagement',          0.70, 3),
  (v_tenant, v_model, 'intake_urgency',     'Intake urgency',      0.85, 4),
  (v_tenant, v_model, 'document_readiness', 'Document readiness',  0.60, 5);

  insert into personas (tenant_id, key, label, rules, sort_order) values
  (v_tenant, 'scholar',       'Scholarship seeker', '{"sponsor": "scholarship"}'::jsonb,          1),
  (v_tenant, 'self-funded',   'Self-funded',        '{"sponsor_in": ["parents","self-funded"]}'::jsonb, 2),
  (v_tenant, 'loan-dependent','Loan dependent',     '{"sponsor": "education loan"}'::jsonb,       3);

  insert into lost_reasons (tenant_id, key, label, sort_order) values
  (v_tenant, 'chose-competitor', 'Chose another consultancy', 1),
  (v_tenant, 'visa-rejected',    'Visa rejected',             2),
  (v_tenant, 'budget',           'Could not fund',            3),
  (v_tenant, 'deferred',         'Deferred intake',           4),
  (v_tenant, 'unresponsive',     'Went unresponsive',         5);

  insert into sla_policies (tenant_id, name, applies, first_response_minutes, follow_up_hours, sort_order) values
  (v_tenant, 'Hot inquiries', '{"temperature": "Hot"}'::jsonb, 15, 24, 1),
  (v_tenant, 'Default',       '{}'::jsonb,                     60, 72, 9);

  -- Appointments: no field-ops resources needed — resource_types simply stays
  -- empty for this tenant (Logistics module hides itself; nav is role config).
  insert into appointment_types (tenant_id, key, label, default_duration_min, sort_order) values
  (v_tenant, 'counselling-session', 'Counselling session', 45, 1),
  (v_tenant, 'mock-interview',      'Mock interview',      30, 2),
  (v_tenant, 'document-review',     'Document review',     30, 3);

  insert into assessment_types (tenant_id, key, label, description, input_schema) values
  (v_tenant, 'scholarship_eligibility', 'Scholarship eligibility',
   'Estimates scholarship fit from academics and profile.',
   '{"fields": [
      {"key": "gpa",             "type": "number"},
      {"key": "ielts_score",     "type": "number"},
      {"key": "work_experience", "type": "number"},
      {"key": "target_country",  "type": "text"}]}'::jsonb),
  (v_tenant, 'education_loan_eligibility', 'Education-loan eligibility',
   'Sanctionable amount from co-applicant income and collateral.',
   '{"fields": [
      {"key": "coapplicant_income", "type": "money"},
      {"key": "collateral_value",   "type": "money"},
      {"key": "loan_amount",        "type": "money"}]}'::jsonb);

  insert into policy_rules (tenant_id, key, label, description, category, definition, severity) values
  (v_tenant, 'no-visa-guarantee', 'Never guarantee visa outcomes',
   'Visa approval may never be promised or implied as certain.',
   'claims', '{"forbidden_phrases": ["guaranteed visa", "100% visa", "assured admission"]}'::jsonb, 'block'),
  (v_tenant, 'full-fee-disclosure', 'Disclose all fees up front',
   'Tuition quotes must include service fees, application fees and living-cost estimates.',
   'pricing', '{"require_components": ["tuition", "service_fee", "application_fee"]}'::jsonb, 'warn'),
  (v_tenant, 'consent-before-broadcast', 'Outbound only with channel consent',
   'No campaign or AI outbound on a channel without a granted consent record.',
   'data', '{"require": "contact_consents.granted"}'::jsonb, 'block');

  insert into kb_categories (tenant_id, key, label, sort_order) values
  (v_tenant, 'universities',      'Universities & Programs', 1),
  (v_tenant, 'visas',             'Visas & Compliance',      2),
  (v_tenant, 'scholarships',      'Scholarships & Funding',  3),
  (v_tenant, 'test-prep',         'Test Prep',               4),
  (v_tenant, 'objection-handling','Objection Handling',      5),
  (v_tenant, 'process-sops',      'Process & SOPs',          6);

end $pack$;

-- ============================================================================
-- DEV sample inventory for the Aurum (real-estate) tenant — operational data
-- so the MCP tools have something to list/match. NOT part of the config pack.
-- ============================================================================

do $inv$
declare
  v_tenant uuid;
  v_proj_t uuid;
  v_unit_t uuid;
  v_p1 uuid;
  v_p2 uuid;
begin
  select id into v_tenant from tenants where slug = 'aurum';
  select id into v_proj_t from catalog_item_types where tenant_id = v_tenant and key = 'project';
  select id into v_unit_t from catalog_item_types where tenant_id = v_tenant and key = 'unit';

  insert into catalog_items (tenant_id, type_id, name, attributes) values
  (v_tenant, v_proj_t, 'Aurum Heights',
   '{"builder": "Aurum Realty", "rera_no": "P02400005678", "locality": "Kokapet",
     "possession_status": "under-construction", "possession_date": "Dec 2027",
     "amenities": ["Clubhouse", "Pool", "Gym"], "towers": 3}'::jsonb)
  returning id into v_p1;

  insert into catalog_items (tenant_id, type_id, name, attributes) values
  (v_tenant, v_proj_t, 'Aurum Lakeview',
   '{"builder": "Aurum Realty", "rera_no": "P02400009012", "locality": "Narsingi",
     "possession_status": "ready", "possession_date": "Ready",
     "amenities": ["Clubhouse", "Park"], "towers": 2}'::jsonb)
  returning id into v_p2;

  insert into catalog_items (tenant_id, type_id, parent_id, name, code, list_price, currency, availability, attributes) values
  (v_tenant, v_unit_t, v_p1, 'Aurum Heights · A-1204', 'A-1204', 13800000, 'INR', 'available',
   '{"tower": "A", "bhk_config": "3BHK", "carpet_area_sqft": 1580, "floor": 12, "facing": "East"}'::jsonb),
  (v_tenant, v_unit_t, v_p1, 'Aurum Heights · B-0704', 'B-0704', 12900000, 'INR', 'available',
   '{"tower": "B", "bhk_config": "3BHK", "carpet_area_sqft": 1495, "floor": 7, "facing": "West"}'::jsonb),
  (v_tenant, v_unit_t, v_p1, 'Aurum Heights · C-1801', 'C-1801', 21500000, 'INR', 'available',
   '{"tower": "C", "bhk_config": "4BHK", "carpet_area_sqft": 2210, "floor": 18, "facing": "North-East"}'::jsonb),
  (v_tenant, v_unit_t, v_p2, 'Aurum Lakeview · T1-0502', 'T1-0502', 9500000, 'INR', 'available',
   '{"tower": "T1", "bhk_config": "2BHK", "carpet_area_sqft": 1130, "floor": 5, "facing": "East"}'::jsonb),
  (v_tenant, v_unit_t, v_p2, 'Aurum Lakeview · T2-0903', 'T2-0903', 14200000, 'INR', 'available',
   '{"tower": "T2", "bhk_config": "3BHK", "carpet_area_sqft": 1610, "floor": 9, "facing": "South-East"}'::jsonb),
  (v_tenant, v_unit_t, v_p2, 'Aurum Lakeview · T2-1101', 'T2-1101', 14800000, 'INR', 'committed',
   '{"tower": "T2", "bhk_config": "3BHK", "carpet_area_sqft": 1610, "floor": 11, "facing": "East"}'::jsonb);
end $inv$;

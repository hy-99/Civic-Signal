insert into categories (name, slug, base_severity, icon, color)
values
  ('Road Hazard', 'road_hazard', 25, 'triangle-alert', '#f4c95d'),
  ('Pothole', 'pothole', 20, 'circle-dot', '#f4c95d'),
  ('Traffic Obstruction', 'traffic_obstruction', 35, 'cone', '#f28a3d'),
  ('Flooding', 'flooding', 40, 'waves', '#f28a3d'),
  ('Fire / Smoke', 'fire_smoke', 45, 'flame', '#ef5c5c'),
  ('Power Outage', 'power_outage', 25, 'zap', '#f4c95d'),
  ('Broken Streetlight', 'broken_streetlight', 15, 'lamp', '#f4c95d'),
  ('Trash / Sanitation', 'trash_sanitation', 10, 'trash', '#94a8bc'),
  ('Unsafe Sidewalk', 'unsafe_sidewalk', 20, 'footprints', '#f4c95d'),
  ('Fallen Tree', 'fallen_tree', 30, 'tree-pine', '#f28a3d'),
  ('Building / Structure Concern', 'building_structure_concern', 35, 'building-2', '#f28a3d'),
  ('Public Event Crowding', 'public_event_crowding', 30, 'users', '#f28a3d'),
  ('School Area Concern', 'school_area_concern', 25, 'school', '#f28a3d'),
  ('Public Disturbance', 'public_disturbance', 35, 'message-alert', '#f28a3d'),
  ('Unauthorized Vending Concern', 'unauthorized_vending', 20, 'store', '#f4c95d'),
  ('Crowd Safety', 'crowd_safety', 30, 'users-round', '#f28a3d'),
  ('Weather Damage', 'weather_damage', 30, 'cloud-rain-wind', '#f28a3d'),
  ('Other', 'other', 10, 'map-pin', '#8395a7')
on conflict (slug) do nothing;

insert into source_feeds (name, url, source_type, default_city, default_latitude, default_longitude, trust_level, is_active, keywords)
values
  ('North Lake City Alerts', 'https://example.org/city-alerts.xml', 'city_alert', 'North Lake', 37.7749, -122.4194, 85, true, '{"closure","maintenance","alert"}'),
  ('Bay Weather Advisory Feed', 'https://example.org/weather.xml', 'weather', 'North Lake', 37.7749, -122.4194, 80, true, '{"rain","wind","warning"}');

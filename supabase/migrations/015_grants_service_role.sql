-- 015: el rol de servicio (edge functions) no tenía permiso sobre el schema
-- mandados ("permission denied for schema mandados", 42501). Sin esto el
-- webhook de pagos nunca pudo marcar pedidos como pagados.
grant usage on schema mandados to service_role;
grant all on all tables in schema mandados to service_role;
grant all on all sequences in schema mandados to service_role;
grant execute on all functions in schema mandados to service_role;
alter default privileges in schema mandados grant all on tables to service_role;
alter default privileges in schema mandados grant all on sequences to service_role;
alter default privileges in schema mandados grant execute on functions to service_role;

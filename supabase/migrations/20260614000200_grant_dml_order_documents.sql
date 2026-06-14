-- order_documents / order_document_versions were created via raw migration and
-- only received the default REFERENCES/TRIGGER/TRUNCATE grants, causing
-- "permission denied for table order_documents" from the authenticated app role.
-- Mirror the DML grants the other public tables (e.g. orders) have.
GRANT SELECT, INSERT, UPDATE, DELETE ON order_documents TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON order_document_versions TO anon, authenticated;

-- Run with psql against AWS after migration. No credentials or shopper records are selected.
BEGIN READ ONLY;
SELECT current_database(), current_user, ssl, version, cipher
  FROM pg_stat_ssl WHERE pid = pg_backend_pid();
SHOW max_connections;
SELECT COUNT(*) AS open_connections FROM pg_stat_activity WHERE datname = current_database();
SELECT status, source_verified, is_expired, COUNT(*) AS count FROM deals GROUP BY 1,2,3 ORDER BY 1,2,3;
SELECT COUNT(*) AS duplicate_asin_groups FROM (SELECT asin FROM deals GROUP BY asin HAVING COUNT(*) > 1) duplicates;
SELECT provider, SUM(request_count) AS month_requests, SUM(blocked_count) AS month_blocked
  FROM provider_request_usage WHERE usage_date >= DATE_TRUNC('month', CURRENT_DATE)::date GROUP BY provider;
SELECT job_key, TO_TIMESTAMP(last_claimed_at) AS last_claimed,
  TO_TIMESTAMP(last_succeeded_at) AS last_succeeded, TO_TIMESTAMP(next_due_at) AS next_due
  FROM maintenance_job_state ORDER BY job_key;
COMMIT;

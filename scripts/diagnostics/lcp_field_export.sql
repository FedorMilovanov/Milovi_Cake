-- Read-only BigQuery Standard SQL. Replace PROJECT_ID, PROPERTY_ID and end date.
-- Start 20261026: the merge was 26 Oct UTC / 27 Oct Moscow; GA4 property timezone is unknown.
-- Use GA4 Daily events_* (completed dates only), not incomplete intraday tables.
-- Export result to CSV OUTSIDE the repository; no URL, user ID, cookie or IP columns.
-- This is only the consented web_vital_lcp sample, not all real users / CrUX.
SELECT
  event_date,
  COALESCE(
    (SELECT p.value.int_value FROM UNNEST(event_params) AS p WHERE p.key = 'lcp_ms' LIMIT 1),
    (SELECT SAFE_CAST(p.value.double_value AS INT64) FROM UNNEST(event_params) AS p WHERE p.key = 'lcp_ms' LIMIT 1)
  ) AS lcp_ms,
  (SELECT p.value.string_value FROM UNNEST(event_params) AS p WHERE p.key = 'lcp_page' LIMIT 1) AS lcp_page,
  (SELECT p.value.string_value FROM UNNEST(event_params) AS p WHERE p.key = 'lcp_viewport' LIMIT 1) AS lcp_viewport,
  (SELECT p.value.string_value FROM UNNEST(event_params) AS p WHERE p.key = 'lcp_consent' LIMIT 1) AS lcp_consent,
  (SELECT p.value.string_value FROM UNNEST(event_params) AS p WHERE p.key = 'lcp_element' LIMIT 1) AS lcp_element,
  (SELECT p.value.string_value FROM UNNEST(event_params) AS p WHERE p.key = 'lcp_release' LIMIT 1) AS lcp_release
FROM `PROJECT_ID.analytics_PROPERTY_ID.events_*`
WHERE _TABLE_SUFFIX BETWEEN '20261026' AND 'YYYYMMDD'
  AND event_name = 'web_vital_lcp';

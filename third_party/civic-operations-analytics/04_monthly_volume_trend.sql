-- Monthly request volume and breach rate, to separate "we got more
-- complaints" from "we got worse at handling them."
SELECT
    strftime('%Y-%m', created_date)                 AS month,
    COUNT(*)                                         AS requests,
    ROUND(100.0 * SUM(sla_breached) / COUNT(*), 1)   AS sla_breach_pct
FROM service_requests
GROUP BY month
ORDER BY month;

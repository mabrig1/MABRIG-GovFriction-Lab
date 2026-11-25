-- Requests per city/borough and each area's SLA breach rate, to find
-- where service delivery is falling behind demand rather than just
-- where volume is highest.
SELECT
    city,
    COUNT(*)                                       AS total_requests,
    ROUND(100.0 * SUM(sla_breached) / COUNT(*), 1)  AS sla_breach_pct
FROM service_requests
WHERE city != 'Unknown'
GROUP BY city
ORDER BY sla_breach_pct DESC;

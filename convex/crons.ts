import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

/**
 * Daily 03:00 UTC — expire custom-access grants whose `expiresAt` has
 * passed. Read-time gates (`userHasFullAccess`, `getMyAccess`) already
 * block expired grants the instant their expiry passes; this cron
 * provides the audit-trail closure (appends a `"system:expiry"` entry
 * to `customAccessHistory`) and keeps `subscription.customAccess` from
 * accumulating stale rows.
 *
 * 03:00 UTC chosen to land outside both UK / India peak hours, so any
 * brief contention with the daily expiry batch falls on quiet traffic.
 */
crons.cron(
  "expire custom access grants",
  "0 3 * * *",
  internal.users.expireStaleCustomAccessGrants,
  {}
);

/**
 * Hourly — delete presence rows from studentViewSessions whose lastSeen
 * is older than 5 minutes. Read-time gates already skip stale sessions,
 * so this is housekeeping only.
 */
crons.interval(
  "clean up stale student-view sessions",
  { hours: 1 },
  internal.studentViewSessions.cleanupStaleSessions,
  {}
);

export default crons;

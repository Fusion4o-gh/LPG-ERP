const endpoint = process.env.BACKUP_RUN_DUE_URL;
const cookie = process.env.BACKUP_SESSION_COOKIE;
if (!endpoint || !cookie) {
  console.error("Set BACKUP_RUN_DUE_URL and BACKUP_SESSION_COOKIE before running the scheduled backup.");
  process.exit(2);
}
const response = await fetch(endpoint, { method: "POST", headers: { cookie, accept: "application/json" } });
const body = await response.text();
console.log(body);
if (!response.ok) process.exit(1);

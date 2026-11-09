/**
 * Barangay Bantug KK Profiling — Google Sheets backend.
 * Paste this into Extensions > Apps Script of your Google Sheet, then deploy as a Web app
 * (Execute as: Me, Who has access: Anyone). See README.md.
 */

const SHEET_NAME = "KK Profiles";
const HEADERS = [
  "Timestamp", "Last Name", "First Name", "Middle Name", "Suffix", "Birthday", "Age", "Sex",
  "Contact Number", "Civil Status", "Youth Classification", "Registered Voter", "Purok"
];
const CACHE_KEY = "masterlist_v1";

function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME);
    sh.appendRow(HEADERS);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, HEADERS.length).setFontWeight("bold");
    sh.getRange("F:F").setNumberFormat("@"); // birthday as text (yyyy-mm-dd)
    sh.getRange("I:I").setNumberFormat("@"); // keep leading 0 in phone numbers
  }
  return sh;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

const norm_ = (v) => String(v || "").toLowerCase().replace(/[^a-z0-9ñ]/g, "");
const key_ = (last, first, bday) => [norm_(last), norm_(first), normDate_(bday)].join("|");

function normDate_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, Session.getScriptTimeZone(), "yyyy-MM-dd");
  return String(v || "").trim();
}

// Stops spreadsheet formula injection (e.g. a name starting with "=").
function safe_(v) {
  const s = String(v == null ? "" : v).trim().slice(0, 100);
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

function displayName_(last, first, middle, suffix) {
  const mi = String(middle || "").trim() ? " " + String(middle).trim()[0].toUpperCase() + "." : "";
  const sfx = String(suffix || "").trim() ? " " + String(suffix).trim() : "";
  return String(last).trim().toUpperCase() + ", " + String(first).trim() + mi + sfx;
}

/** GET ?action=list — public masterlist: name and purok only. */
function doGet(e) {
  try {
    const cache = CacheService.getScriptCache();
    const hit = cache.get(CACHE_KEY);
    if (hit) return ContentService.createTextOutput(hit).setMimeType(ContentService.MimeType.JSON);

    const values = getSheet_().getDataRange().getValues().slice(1);
    const rows = values
      .filter((r) => r[1] && r[2])
      .map((r) => ({ name: displayName_(r[1], r[2], r[3], r[4]), purok: String(r[12]) }));
    const out = JSON.stringify({ ok: true, rows: rows });
    if (out.length < 90000) cache.put(CACHE_KEY, out, 60); // cache 1 minute to handle many visitors
    return ContentService.createTextOutput(out).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

/**
 * Admin: returns all details. The password lives in Project Settings > Script Properties
 * (ADMIN_PASSWORD), never in the website code. Too many wrong tries locks it for 10 minutes.
 */
function adminData_(d) {
  const props = PropertiesService.getScriptProperties();
  const real = props.getProperty("ADMIN_PASSWORD");
  if (!real) return { ok: false, error: "Admin password is not set up yet (Script Properties > ADMIN_PASSWORD)." };

  const cache = CacheService.getScriptCache();
  const fails = Number(cache.get("admin_fails") || 0);
  if (fails >= 8) return { ok: false, locked: true, error: "Too many wrong passwords. Try again in 10 minutes." };
  if (String(d.password || "") !== real) {
    cache.put("admin_fails", String(fails + 1), 600);
    return { ok: false, badPassword: true, error: "Wrong password." };
  }
  cache.remove("admin_fails");

  const tz = Session.getScriptTimeZone();
  const fmt = (v, p) => (v instanceof Date ? Utilities.formatDate(v, tz, p) : String(v == null ? "" : v));
  const rows = getSheet_().getDataRange().getValues().slice(1)
    .filter((r) => r[1] && r[2])
    .map((r) => {
      let phone = String(r[8] == null ? "" : r[8]).replace(/^'/, "");
      if (/^9\d{9}$/.test(phone)) phone = "0" + phone; // restore leading 0 if Sheets dropped it
      return {
        timestamp: fmt(r[0], "yyyy-MM-dd HH:mm"), lastName: String(r[1]), firstName: String(r[2]),
        middleName: String(r[3]), suffix: String(r[4]), birthday: fmt(r[5], "yyyy-MM-dd"), age: String(r[6]),
        sex: String(r[7]).toUpperCase(), contact: phone, civilStatus: String(r[9]),
        youthClass: String(r[10]), voter: String(r[11]), purok: String(r[12])
      };
    });
  return { ok: true, rows: rows };
}

/** POST — new registration (or admin request). Rejects the same person (last + first name + birthday) twice. */
function doPost(e) {
  let d;
  try { d = JSON.parse(e.postData.contents); } catch (err) { return json_({ ok: false, error: "Bad request" }); }
  if (d.action === "admin") return json_(adminData_(d));

  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000); // one write at a time, so two people submitting at once don't clash

    const required = ["lastName", "firstName", "birthday", "sex", "civilStatus", "youthClass", "voter", "purok"];
    for (const f of required) if (!String(d[f] || "").trim()) return json_({ ok: false, error: "Missing " + f });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d.birthday)) return json_({ ok: false, error: "Bad birthday" });
    if (d.contact && !/^09\d{9}$/.test(d.contact)) return json_({ ok: false, error: "Bad contact number" });

    const sh = getSheet_();
    const existing = sh.getDataRange().getValues().slice(1);
    const k = key_(d.lastName, d.firstName, d.birthday);
    if (existing.some((r) => key_(r[1], r[2], r[5]) === k)) return json_({ ok: false, duplicate: true });

    const b = new Date(d.birthday + "T00:00:00");
    const now = new Date();
    let age = now.getFullYear() - b.getFullYear();
    if (now.getMonth() < b.getMonth() || (now.getMonth() === b.getMonth() && now.getDate() < b.getDate())) age--;

    sh.appendRow([
      now, safe_(d.lastName), safe_(d.firstName), safe_(d.middleName), safe_(d.suffix),
      d.birthday, age, safe_(d.sex), d.contact ? "'" + d.contact : "", safe_(d.civilStatus),
      safe_(d.youthClass), safe_(d.voter), safe_(d.purok)
    ]);
    CacheService.getScriptCache().remove(CACHE_KEY);
    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

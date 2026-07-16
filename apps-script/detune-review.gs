/*
 * detune-review.gs — server half of the private theme review tool.
 *
 * This belongs in its OWN standalone Apps Script project, NOT the one that serves the public
 * manifest. A deployment has a single "Who has access" setting: the manifest must stay "Anyone"
 * so the gallery can fetch it, while this must be "Only myself". Same project = same doGet =
 * you can't have both. Keeping them separate also means a mistake here can never take the public
 * gallery down.
 *
 * Setup: see README.md next to this file.
 *
 * Auth model: deployed as "Execute as: Me" + "Who has access: Only myself", so Google's own login
 * is the gate. There is no password, and nothing secret lives in this file or in the page.
 */

// The spreadsheet holding submissions. Copy it out of the Sheet's URL:
// https://docs.google.com/spreadsheets/d/<THIS_PART>/edit
var SHEET_ID = "PASTE_YOUR_SHEET_ID_HERE";
// Leave blank to use the first tab.
var SHEET_NAME = "";

// Header names we accept for each column, lowercased. The first one found wins, so this survives
// the Form renaming its own columns.
var COLS = {
  name: ["name", "theme name"],
  author: ["author", "author handle", "creator"],
  code: ["code", "share code", "theme code"],
  approved: ["approved", "approve"],
  rejected: ["rejected", "reject"],
  created: ["createdat", "created at", "timestamp", "date"],
  id: ["id"]
};

function doGet() {
  return HtmlService.createHtmlOutputFromFile("detune-review")
    .setTitle("Detune — Review themes")
    .addMetaTag("viewport", "width=device-width, initial-scale=1");
}

// ---- sheet plumbing ----

function sheet_() {
  var ss;
  if (SHEET_ID && SHEET_ID.indexOf("PASTE_") !== 0) ss = SpreadsheetApp.openById(SHEET_ID);
  else ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error("No spreadsheet. Set SHEET_ID at the top of detune-review.gs.");
  var sh = SHEET_NAME ? ss.getSheetByName(SHEET_NAME) : ss.getSheets()[0];
  if (!sh) throw new Error('No tab named "' + SHEET_NAME + '".');
  return sh;
}

function headerMap_(sh) {
  var width = Math.max(1, sh.getLastColumn());
  var row = sh.getRange(1, 1, 1, width).getValues()[0];
  var map = {};
  for (var i = 0; i < row.length; i++) {
    var key = String(row[i]).trim().toLowerCase();
    if (key) map[key] = i;   // 0-based
  }
  return map;
}

function colIndex_(map, names) {
  for (var i = 0; i < names.length; i++) {
    if (names[i] in map) return map[names[i]];
  }
  return -1;
}

/**
 * Reject needs somewhere to record itself. If there's no Rejected column we append one at the far
 * right — the only structural change that can't shift the columns the manifest script reads.
 */
function ensureRejectedCol_(sh, map) {
  var idx = colIndex_(map, COLS.rejected);
  if (idx >= 0) return idx;
  var col = sh.getLastColumn() + 1;
  sh.getRange(1, col).setValue("Rejected");
  return col - 1;
}

function truthy_(v) {
  if (v === true) return true;
  var s = String(v).trim().toLowerCase();
  return s === "true" || s === "yes" || s === "y" || s === "1" || s === "approved" || s === "x";
}

function isoOf_(v) {
  if (v instanceof Date) return v.toISOString();
  if (!v) return "";
  var d = new Date(v);
  return isNaN(d.getTime()) ? String(v) : d.toISOString();
}

// ---- API called from the page via google.script.run ----

/**
 * Every pending submission: not approved and not rejected. Rows are addressed by their real sheet
 * row number, not the manifest's derived "row-N" id — that's the only handle that can't drift.
 */
function getPending() {
  return listRows_(function (approved, rejected) { return !approved && !rejected; });
}

/** Already-live themes, so one can be pulled back down if it turns out to be a problem. */
function getApproved() {
  return listRows_(function (approved, rejected) { return approved && !rejected; });
}

function listRows_(want) {
  var sh = sheet_();
  var map = headerMap_(sh);
  var cName = colIndex_(map, COLS.name);
  var cCode = colIndex_(map, COLS.code);
  var cAppr = colIndex_(map, COLS.approved);
  if (cName < 0 || cCode < 0 || cAppr < 0) {
    return {
      ok: false,
      error: "Couldn't find the required columns. Found headers: [" + Object.keys(map).join(", ") +
             "]. Needs a Name, Code and Approved column.",
      items: []
    };
  }
  var cAuthor = colIndex_(map, COLS.author);
  var cRej = colIndex_(map, COLS.rejected);
  var cCreated = colIndex_(map, COLS.created);

  var last = sh.getLastRow();
  if (last < 2) return { ok: true, items: [] };
  var values = sh.getRange(2, 1, last - 1, sh.getLastColumn()).getValues();

  var items = [];
  for (var i = 0; i < values.length; i++) {
    var r = values[i];
    var approved = truthy_(r[cAppr]);
    var rejected = cRej >= 0 ? truthy_(r[cRej]) : false;
    if (!want(approved, rejected)) continue;
    var code = String(r[cCode] || "").trim();
    if (!code) continue;
    items.push({
      row: i + 2,                       // real sheet row
      name: String(r[cName] || ""),
      author: cAuthor >= 0 ? String(r[cAuthor] || "") : "",
      code: code,
      createdAt: cCreated >= 0 ? isoOf_(r[cCreated]) : "",
      approved: approved
    });
  }
  // Newest first — you'll want to clear the fresh ones.
  items.sort(function (a, b) { return (b.createdAt || "").localeCompare(a.createdAt || ""); });
  return { ok: true, items: items };
}

function setApproved(row, value) {
  var sh = sheet_();
  var map = headerMap_(sh);
  var c = colIndex_(map, COLS.approved);
  if (c < 0) throw new Error("No Approved column found.");
  guardRow_(sh, row);
  sh.getRange(row, c + 1).setValue(value ? true : false);
  return { ok: true };
}

function setRejected(row) {
  var sh = sheet_();
  var map = headerMap_(sh);
  var cRej = ensureRejectedCol_(sh, map);
  var cAppr = colIndex_(map, COLS.approved);
  guardRow_(sh, row);
  sh.getRange(row, cRej + 1).setValue(true);
  // A rejected theme must never also be live.
  if (cAppr >= 0) sh.getRange(row, cAppr + 1).setValue(false);
  return { ok: true };
}

/** Clean up a sloppy submission instead of rejecting it. */
function saveMeta(row, name, author) {
  var sh = sheet_();
  var map = headerMap_(sh);
  var cName = colIndex_(map, COLS.name);
  var cAuthor = colIndex_(map, COLS.author);
  guardRow_(sh, row);
  if (cName >= 0) sh.getRange(row, cName + 1).setValue(String(name || "").slice(0, 24));
  if (cAuthor >= 0 && author != null) sh.getRange(row, cAuthor + 1).setValue(String(author).slice(0, 24));
  return { ok: true };
}

function guardRow_(sh, row) {
  row = Number(row);
  if (!row || row < 2 || row > sh.getLastRow()) throw new Error("Bad row: " + row);
}

/** Run this once from the editor to check the wiring before deploying. */
function testSetup() {
  var sh = sheet_();
  var map = headerMap_(sh);
  var pending = getPending();
  Logger.log("Sheet: %s / tab %s", sh.getParent().getName(), sh.getName());
  Logger.log("Headers: %s", JSON.stringify(Object.keys(map)));
  Logger.log("Pending: %s", pending.ok ? pending.items.length : "ERROR " + pending.error);
  Logger.log("Approved: %s", getApproved().items.length);
}

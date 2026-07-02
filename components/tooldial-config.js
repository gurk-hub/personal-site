/*
 * tooldial-config.js — owner-supplied endpoints for the Tool Dial community theme system.
 * Filled in from the Google Form / Apps Script setup. Pages still degrade gracefully if any
 * value is blank.
 *
 * Note: the SAVE_* values exist for completeness, but the WEBSITE never posts saves — "liking"
 * a theme only happens in the app when a user actually saves it. The website shows the aggregated
 * `saves` count from the manifest read-only.
 */
window.TOOLDIAL_CONFIG = {
    // --- Community manifest (approved themes feed) ---
    MANIFEST_URL: "https://script.google.com/macros/s/AKfycbyJgBrBYk-fOWh9eP3157OBDrzmoYeK4diWxI5ilGHpnNcsJXmine3VeW-C7YQTPLFZzA/exec",
    MANIFEST_FORMAT: "json",   // "json" | "csv"  (CSV is the CORS fallback)

    // --- Submission Google Form ---
    FORM_ACTION_URL: "https://docs.google.com/forms/d/e/1FAIpQLSdtkugCLn5aXf19Z4odveFhUdK8cK6vkgAO4n9XGkMD53hi2Q/formResponse",
    FORM_ENTRY_NAME: "entry.698936853",     // Theme name
    FORM_ENTRY_AUTHOR: "entry.1834145052",  // Author handle
    FORM_ENTRY_CODE: "entry.207531774",     // Share code
    FORM_ENTRY_HONEYPOT: "entry.1315374345",// Honeypot ("leave empty")

    // --- Report Google Form (used by the modal's Report action) ---
    REPORT_FORM_ACTION_URL: "https://docs.google.com/forms/d/e/1FAIpQLSf7AoGQUcASt2Ueh3T1hDbkeRiyIzA5hATVPwzkUctpU3Tc-g/formResponse",
    REPORT_ENTRY_THEMEID: "entry.1217694563",
    REPORT_ENTRY_REASON: "entry.706120599",

    // --- Save-count ("heart") Google Form — app-only; the website does NOT post here ---
    SAVE_FORM_ACTION_URL: "https://docs.google.com/forms/d/e/1FAIpQLSe4aDk061J1yj9nQawkAtqyB21Q2HsCVr2BTfdnjJiuD7kdLg/formResponse",
    SAVE_ENTRY_THEMEID: "entry.800616080",
    SAVE_ENTRY_DELTA: "entry.1774061155",
    SAVE_ENTRY_INSTALL: "entry.1509129131",

    // --- Deep links ("Open in app"), optional ---
    APP_DEEPLINK_SCHEME: "detune",
};

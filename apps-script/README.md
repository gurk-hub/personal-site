# Detune — private theme review tool

A page that lists every **unapproved** submission with a live preview, and lets you Approve /
Reject / rename it. Writes straight back to the submissions Sheet.

Only your Google account can open it. There is no password anywhere — the gate is the
deployment's access setting, so there's nothing to leak and nothing secret in this repo.

## Why it's a separate Apps Script project

An Apps Script deployment has exactly **one** "Who has access" setting. The manifest deployment
must stay **Anyone** (the public gallery fetches it from the browser); this must be **Only myself**.
One project can't be both, so the review tool gets its own project and its own URL. It also means a
mistake in here can never take the public gallery down.

## Setup (once, ~5 minutes)

1. Go to <https://script.google.com> → **New project**. Name it `Detune Review`.
2. Delete the stub `Code.gs` and add the two files from this folder:
   - **`detune-review.gs`** — paste as a script file named `detune-review` (or `Code`; the name
     doesn't matter for `.gs`).
   - **`detune-review.html`** — ⚠️ add via **＋ → HTML** and name it exactly **`detune-review`**
     (no `.html` — Apps Script adds that). The name must match `createHtmlOutputFromFile` in the
     `.gs`, or you'll get "file not found".
3. At the top of `detune-review.gs`, set `SHEET_ID` to the id in your Sheet's URL:
   `https://docs.google.com/spreadsheets/d/`**`<this part>`**`/edit`
   (Leave `SHEET_NAME` blank to use the first tab.)
4. Run the `testSetup` function once from the editor. Approve the permission prompt (it asks for
   Sheets access; it's your own script). Check **Execution log** — it prints the headers it found
   and how many rows are pending. If it can't find the columns, it lists what it *did* find.
5. **Deploy → New deployment → Web app**:
   - Execute as: **Me**
   - Who has access: **Only myself**  ← this is the entire security model, don't set it to Anyone
6. Open the Web app URL. Bookmark it.

## Using it

- **Pending** tab: submissions that are neither approved nor rejected.
- **Approve** → sets `Approved` to TRUE. It shows up in the public gallery on its next load.
- **Reject** → sets `Rejected` to TRUE (and forces `Approved` false). The row stays in the Sheet;
  it just stops appearing in Pending.
- **Save name** → writes a cleaned name/author back, for sanitising a sloppy submission instead of
  rejecting it. Capped at 24 chars, matching the site's own rule.
- **Live** tab: already-approved themes, with **Unapprove** to pull one back down.
- Tap a preview to flip between the home screen and the dial.

## What it needs in the Sheet

Columns are found **by header name**, case-insensitively, so column order doesn't matter:

| Purpose | Accepted headers | Required |
|---|---|---|
| Name | `Name`, `Theme name` | yes |
| Code | `Code`, `Share code`, `Theme code` | yes |
| Approved | `Approved`, `Approve` | yes |
| Author | `Author`, `Author handle`, `Creator` | no |
| Rejected | `Rejected`, `Reject` | no — **auto-created** |
| Submitted | `createdAt`, `Timestamp`, `Date` | no |

If there's no **Rejected** column, the first Reject appends one at the far right. That's the only
structural change it ever makes, and appending can't shift the columns your manifest script reads.

## Gotchas

- **Editing the script isn't enough — you must re-Deploy** (Deploy → Manage deployments → edit →
  New version) for changes to take effect. Same trap as the manifest script.
- Rows are addressed by their **real sheet row number**, read fresh on each load. If you insert or
  delete rows in the Sheet while the page is open, hit **Refresh** before acting, or you could
  approve the wrong row.
- The page loads the renderer from `https://gurkis.dev/components/...?v=16`. When you bump the
  site's `?v=`, bump it in `detune-review.html` too or you'll review themes with a stale renderer.
- **Don't request a new `?v=` URL until Porkbun has finished deploying.** Its CDN caches assets for
  30 days and keys on the full query string, so a fetch during the deploy window pins the *old*
  bytes to the *new* URL for a month, and no amount of hard-refreshing fixes it — only another
  version bump does. Wait, then verify.
- A code that won't decode shows as a red "Code won't decode" card instead of being hidden — that
  means the app and the site disagree on the format, which is exactly what review should catch.

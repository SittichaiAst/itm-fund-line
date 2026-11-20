# Decision Record — Cohort Payment LIFF (v1)

Source SRS: `gemini-code-1795102413032.md`  
Status: agreed via grill session; this doc overrides the SRS where they conflict.

## Product decisions

| ID | Decision |
|---|---|
| Scope | Member LIFF (bind + submit + history) + treasurer actions in Google Sheet |
| Stack | LIFF + GAS + Sheets + Drive (hardened; not replaced) |
| Multi-cohort | One LIFF + one GAS deployment + one Sheet + one Drive folder per cohort |
| Infra now | OA/LIFF may be missing; ship code + mock first |
| Treasurer UX | Sheet custom menu: Approve / Reject… / Unbind / Sync Drive share |
| Slip access | Drive files private; share viewers = treasurer emails from `Config` |
| API auth | Verify LINE ID token on member actions; no public approve API |
| Wrong bind | Unbind only via Sheet menu |
| Bank account | `Config` sheet tab (editable without redeploy) |
| Notify | No chat message on successful submit; Messaging API push on **Reject** only |
| History | Member sees own transactions (Pending / Approved / Rejected + reason) |
| Duplicates | Allow; treasurer filters manually |
| Secrets | Script Properties only (never in Sheet) |
| Dev mock | `?mock=1` + `MOCK_PASSWORD` in Script Properties |

## Out of scope (v1)

- Treasurer LIFF page
- `liff.sendMessages` after submit
- Automatic duplicate blocking
- Auto-provision new cohort Sheet/LIFF
- Cohort-wide payment leaderboard for members

## Schema (beyond SRS)

### `Members` (unchanged headers)

`member_id`, `full_name`, `nickname`, `line_user_id`, `line_display_name`, `bound_at`, `total_paid`

`total_paid` may be a Sheet formula or maintained by GAS on approve; prefer GAS rewrite on Approve to avoid fragile formulas.

### `Transactions`

| Column | Name |
|---|---|
| A | `transaction_id` |
| B | `member_id` |
| C | `full_name` |
| D | `line_user_id` |
| E | `transfer_datetime` |
| F | `amount` |
| G | `slip_url` |
| H | `note` |
| I | `status` (`Pending` / `Approved` / `Rejected`) |
| J | `submitted_at` |
| K | `reject_reason` |
| L | `reviewed_at` |
| M | `reviewed_by` |

### `Config` (key / value)

| key | value |
|---|---|
| `bank_name` | … |
| `account_no` | … |
| `account_name` | … |
| `treasurer_emails` | comma-separated Google accounts |

## Script Properties (secrets / IDs)

| Key | Purpose |
|---|---|
| `SHEET_ID` | Spreadsheet ID |
| `DRIVE_FOLDER_ID` | Slip folder ID |
| `LINE_CHANNEL_ID` | Channel ID for ID token verify |
| `LINE_CHANNEL_ACCESS_TOKEN` | Messaging API push on Reject |
| `MOCK_PASSWORD` | Required when `mock=1` |
| `LIFF_ID` | Optional; documented for deployers |

## API actions (member / LIFF → GAS POST `text/plain` JSON)

- `checkUser` — bound member + bank config, or unbound + available members
- `bindUser`
- `submitPayment`
- `getMyTransactions`

Every non-mock call must include `id_token`. Mock calls must include `mock: true`, `mock_password`, and a stable fake `line_user_id`.

## Setup checklist (per cohort)

1. Create Google Sheet from `sheets/*.csv` headers; paste member rows into `Members`.
2. Fill `Config` (`bank_*`, `treasurer_emails`).
3. Create Drive folder for slips; note folder ID.
4. Create Apps Script bound to the Sheet (or standalone with Sheet ID); paste `Code.gs`.
5. Set Script Properties listed above.
6. Deploy Web App: **Execute as Me**, **Who has access: Anyone**.
7. Host `index.html` on GitHub Pages (repo root); create LINE OA + Messaging API + LINE Login LIFF; Endpoint URL = Pages URL.
8. Put LIFF ID into `index.html` `APP_CONFIG.liffId` and push.
9. Put GAS Web App URL into `index.html` `APP_CONFIG.gasUrl` and push. `LINE_CHANNEL_ID` = LINE Login channel ID.
10. Share Sheet (Editor) only with treasurers — never with all members.
11. Run menu **กองทุนรุ่น → Sync Drive share**.
12. Smoke test with `?mock=1` then with real LIFF.

## Conflicts vs original SRS

- Slip files are **not** “Anyone with link”.
- Success path does **not** call `liff.sendMessages`.
- Transactions include review columns; Config + history screens are required.
- Treasurer workflow lives in Sheet menus, not only manual cell edits.

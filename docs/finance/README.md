# Expense inventory — status

Date: 2026-11-17. Only sources I could actually read are listed.

## Sources checked
| Source | Access | Result |
| --- | --- | --- |
| Google Drive folder "2025년09월가계부" (September 2025 household ledger) | Connected (read) | 5 sheets: 식비, 생필품, 교통비, 교육/자기계발, 쇼핑/의류. Only 식비 (17 rows) and 생필품 (2 rows) contain records. The other three are empty. |
| Gmail (receipts, invoices, app-store and subscription emails) | Connector exists, **not connected** | Needs your approval to install and sign in. Not accessed. |
| App Store / Google Play purchase history | No connector | Needs a manual export from your account, or a connector you approve. Not accessed. |
| Bank and card statements | No connector | Needs an exported CSV or PDF from your bank, uploaded by you. Not accessed. |
| Recurring bills, AI/software/hosting/domain/cloud subscriptions | No source yet | Cannot be identified without one of the sources above. **No recurring payment has been identified.** |

## Result
- **Recurring payments found: 0.** Nothing in the accessible data shows a subscription, so no monthly or annual totals are calculated.
- **September 2025 food and daily-goods records:** 19 rows, 102,280 KRW total in the sheets. Of this, 76,340 KRW is marked verified and 25,740 KRW is marked for your review (missing item names, a possibly shifted amount column, and a member fee).
- **Duplicate check:** no duplicate charges were found. The same item (미쯔, 700 KRW) appears on two dates, and it is kept as two purchases.
- **Missing data:** most rows have no payment method. Those are left blank, not guessed.

## Categories
Every row is currently "Other personal expenses". No AI, software, hosting, communication, housing, or business records exist in the accessible data, so those categories are empty. The mapping is in `expense-inventory-2025-09.csv`.

## Not done yet, and why
- **Import into OWNER'S OFFICE:** the live app requires the passcode, which I can't use from here without a secure handoff. The CSV is ready. Options are in the message accompanying this commit.
- **Recurring subscriptions:** need Gmail or a bank/App Store export. Nothing was cancelled, paid, or inferred.

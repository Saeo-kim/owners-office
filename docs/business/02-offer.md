# The offer — private business dashboard setup (remote, fixed scope)

## One-line description
A private, passcode-protected business dashboard for a one-person business (income, expenses, projects, and tasks), installed on the customer's own Cloudflare account and set up with their real starting data, delivered remotely in writing with no meetings.

## Why this offer
- It uses the existing product (OWNER'S OFFICE) and its tests, so there is nothing new to build before the first order.
- The scope is fixed and small, so the first delivery can be done in a few days.
- Delivery is written and remote. No interviews or meetings are required.
- Startup cost is near zero if the customer's Cloudflare account is used (Cloudflare's free tier covers this app's expected use, but confirm current limits before quoting).

## Tiers (hypothesis — to test, not market-verified)

| Tier | Price (KRW, VAT not included) | Includes | Not included |
| --- | --- | --- | --- |
| Basic | ₩150,000 | Install on the customer's Cloudflare account, passcode setup, category setup for their business, import of up to 50 starting records from a spreadsheet, a 2-page written guide (Korean), one round of fixes within 7 days | Custom features, integrations with banks or payment services, hosting fees |
| Standard | ₩300,000 | Everything in Basic, plus import of up to 300 records, business-specific project and expense categories, a short iPhone install guide with screenshots, one round of changes within 14 days | Custom features beyond the existing screens, bank integrations, ongoing support after 14 days |

Pricing basis: the scope is much smaller than the admin-dashboard projects listed at ₩6M–8M or the page-building packages at ₩550k–₩5.5M. The tiers are an initial guess to be tested with the first listing and adjusted based on responses. No market data supports these exact numbers.

## Deliverables (per order)
1. The app running on the customer's Cloudflare Worker, with a passcode only they know.
2. Their starting data imported (up to the tier limit), with a summary showing row counts so they can check it.
3. Written guide in Korean: how to log in, add income and expenses, and add to the iPhone home screen.
4. A short handover checklist: where the data lives, how to back it up (the app has a backup export), and what the app does not do.

## Delivery steps (remote, no meetings)
1. Customer completes an order form (see the sales kit) with: business type, what they want to track, approximate number of records, and their preferred tier.
2. Confirm scope and price in writing. No work starts before the customer confirms and pays.
3. Customer creates or provides access to a Cloudflare account through a method they choose. Credentials are never sent to us in chat or documents (see the security rules below).
4. Install, configure, import starting data, and test on an iPhone-sized browser view.
5. Send the guide and checklist. Record the completed work in the tracker.

## Sample
- samples/sample-dashboard.png and samples/sample-finance.png are screenshots of the real app with DEMO data. The DEMO banner is visible in both images. These are not customer results.

## Known issues to fix before the first delivery
1. **Demo numbers are labeled "실제" (actual).** In the finance and dashboard screens, values that come from DEMO rows show the "실제" badge. This is a product bug: the badge must not claim actual data for DEMO rows. Fix before any customer sees a sample without the banner context.
2. The Korean UI is the only language. The customer is assumed to read Korean.
3. Access is a single shared passcode. There are no separate user accounts.
4. The app needs an internet connection. Offline, only the cached screens open.

## Security and data rules for every order
- Customer data stays in the customer's own Cloudflare account.
- Passcodes, API tokens, and bank details are never written into chat, documents, or the repository. They are entered only into the platform's secure forms.
- No customer name or contact details are stored in this repository.

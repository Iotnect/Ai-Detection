# Daily MBS report email

The existing backend can generate a PDF and send it through authenticated SMTP
at 07:00 Asia/Kuala_Lumpur each day. No browser or Vercel page needs to stay open.
The scheduler checks once per minute; startup after 07:00 catches up yesterday's
report. It does not backfill older missed days automatically.

The reporting interval is the previous Malaysian calendar day, inclusive of
midnight and exclusive of the next midnight. It queries stored WATER_LEVEL events
for the client identified by REPORT_CAMERA_CODE (default MBS-KDN-C1), and lists
only RISING/DANGER alerts. Normal readings contribute to coverage statistics.
The query is paginated. A database error stops the send; an empty successful query
produces an explicit NO DATA report. Demo replay is never queried or stored.

## Setup

1. Keep `REPORT_ENABLED=false` while configuring/testing.
2. Apply `supabase/migrations/202611100001_daily_report_deliveries.sql` in the
   Supabase SQL Editor. This creates the private delivery ledger and claim RPC.
3. Deploy this backend version using `backend/Dockerfile`. It includes the PNG
   logo asset, PDFKit, Nodemailer and the daily-report command.
4. Set Railway backend Variables (keep real passwords only in Railway):

```dotenv
REPORT_ENABLED=false
REPORT_CAMERA_CODE=MBS-KDN-C1
SMTP_HOST=mail.iotnect.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=tech@iotnect.com
SMTP_PASS=YOUR_MAILBOX_PASSWORD
REPORT_FROM="NeoVision <tech@iotnect.com>"
REPORT_RECIPIENTS=YOUR_PERSONAL_EMAIL
```

Existing SUPABASE_URL and SUPABASE_SECRET_KEY are reused. REPORT_CLIENT_ID can
pin the client UUID; it is mandatory if multiple clients have the same camera code.
All report readings are filtered by the resolved client, never across clients.

## Personal-email test

In a Railway backend shell, the runtime working directory is `/app`:

```sh
# Default: yesterday's PDF preview only, no email.
npm run report:daily
# Explicit date, optional.
npm run report:daily -- --date=2026-11-09
# Sends to the configured REPORT_RECIPIENTS, including during disabled scheduling.
npm run report:daily -- --send
```

After checking the PDF in the personal mailbox, set:

```dotenv
REPORT_RECIPIENTS=zahid@mbs.gov.my,fadzli@mbs.gov.my
REPORT_ENABLED=true
```

Deploy the variable changes. If enabled after 07:00, it attempts yesterday's
report immediately. There is no Railway cron service to create; the backend
must remain running. SMTP requires Railway Pro or above and a provider that
allows connections from Railway: https://docs.railway.com/networking/outbound-networking

## Delivery behaviour

Each client/date/recipient has one atomic claim in daily_report_deliveries.
Recipients receive separate messages so a partial send cannot resend another
recipient's PDF. Sent claims survive process restarts and multiple replicas.
Failures before message submission can retry after ten minutes, up to three
claimed attempts. Connectivity/verification failures are retried every ten
minutes by the scheduler without claiming a message.

SMTP acceptance is not proof of inbox delivery. An interrupted DATA phase or
a failed receipt write is ambiguous: status becomes unknown (or remains sending
if the database is unavailable), and the system does not resend automatically.
Review SMTP/cPanel delivery logs before an operator resets that specific row to
failed. The same review applies to sending rows left behind after a crash.
No endpoint exposes report sending to public/dashboard users.

The backend logs report date, recipient and delivery outcome, never SMTP passwords
or Supabase secrets. Actual connection and mailbox delivery require testing in
Railway with the configured credentials; local previews cannot establish that.

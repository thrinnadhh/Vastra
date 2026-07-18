---
sprint: 9
ticket: S9-06
status: implemented
---

# S9-06 merchant operational controls

Admins can inspect a merchant's operational profile and issue narrow pause, suspend and restore commands. Every write is permission-gated, idempotent, transactional and audited. Restoring a merchant never silently reopens shops; restored shops return to `TEMPORARILY_CLOSED` with online orders disabled until the merchant explicitly reopens them.

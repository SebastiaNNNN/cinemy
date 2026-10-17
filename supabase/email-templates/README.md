# Cinemy confirmation email

Subject: `Confirm your Cinemy account`

First configure **Authentication → Emails → SMTP Settings** with an SMTP provider, verified sender address, host, port, username, and password. The hosted Supabase dashboard currently requires custom SMTP before it allows editing email subjects and bodies. Then open **Authentication → Emails → Templates → Confirm sign up**. Replace the subject with the line above and the HTML body with the contents of [`confirm-signup.html`](./confirm-signup.html), then save. The `{{ .ConfirmationURL }}` placeholder must remain intact; Supabase replaces it with the recipient's unique confirmation link.

This template uses a styled text wordmark instead of an image, so the Cinemy logo remains visible when email clients block remote images. Editing this repository does not automatically change the hosted Supabase template. The sender name and address come from the custom SMTP settings, not from this HTML file.

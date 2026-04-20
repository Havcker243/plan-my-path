# Supabase Email Templates

Use these in Supabase Dashboard -> Authentication -> Email Templates.

Keep the Supabase variables exactly as written. Supabase replaces them when the email is sent.

## Confirm Signup

Subject:

```text
Confirm your FiskGrad account
```

Body:

```html
<h2>Confirm your FiskGrad account</h2>

<p>Welcome to FiskGrad.</p>

<p>
  Confirm your Fisk student email so we can open your academic planning workspace.
  FiskGrad is limited to Fisk student accounts, so this step helps protect student academic information.
</p>

<p>
  <a href="{{ .ConfirmationURL }}">Confirm my email</a>
</p>

<p>
  After confirming, you will be sent back to FiskGrad to finish setting up your plan.
</p>

<p>
  If you did not create a FiskGrad account, you can ignore this email.
</p>
```

## Invite User

Subject:

```text
You have been invited to FiskGrad
```

Body:

```html
<h2>You have been invited to FiskGrad</h2>

<p>
  You have been invited to join FiskGrad, a degree planning workspace for Fisk students.
</p>

<p>
  Use the link below to accept the invite and create your account.
</p>

<p>
  <a href="{{ .ConfirmationURL }}">Accept invite</a>
</p>

<p>
  Use your Fisk student email when setting up your account.
</p>

<p>
  If you were not expecting this invite, you can ignore this email.
</p>
```

## Reset Password

Subject:

```text
Reset your FiskGrad password
```

Body:

```html
<h2>Reset your FiskGrad password</h2>

<p>
  We received a request to reset the password for your FiskGrad account.
</p>

<p>
  Click the link below to choose a new password.
</p>

<p>
  <a href="{{ .ConfirmationURL }}">Reset password</a>
</p>

<p>
  If you did not request this, you can ignore this email. Your password will stay the same.
</p>
```

## Change Email Address

Subject:

```text
Confirm your new FiskGrad email
```

Body:

```html
<h2>Confirm your new FiskGrad email</h2>

<p>
  You requested to change the email address on your FiskGrad account.
</p>

<p>
  Confirm this new email address to finish the change.
</p>

<p>
  <a href="{{ .ConfirmationURL }}">Confirm new email</a>
</p>

<p>
  FiskGrad is limited to Fisk student emails, so the new address must end in <strong>@my.fisk.edu</strong>.
</p>

<p>
  If you did not request this change, secure your account and contact support.
</p>
```

## Reauthentication

Subject:

```text
Your FiskGrad security code
```

Body:

```html
<h2>Your FiskGrad security code</h2>

<p>
  Use this code to continue with your secure FiskGrad account action:
</p>

<p style="font-size: 24px; font-weight: bold; letter-spacing: 4px;">
  {{ .Token }}
</p>

<p>
  This code is used to confirm it is really you. Do not share it with anyone.
</p>

<p>
  If you did not request this code, you can ignore this email.
</p>
```

## Supabase Redirect URLs

Add these URLs in Supabase Authentication URL settings.

Local development:

```text
http://localhost:3000/auth/callback
```

Production:

```text
https://your-vercel-domain.vercel.app/auth/callback
```

Also set the site URL to the app domain:

```text
http://localhost:3000
```

or, in production:

```text
https://your-vercel-domain.vercel.app
```

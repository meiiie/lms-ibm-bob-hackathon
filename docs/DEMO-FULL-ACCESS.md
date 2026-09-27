# Full demo role capabilities

On 27 September 2026 the owner requested removing the extra limitations imposed
on the shared demo. This supersedes the earlier restricted-demo policy. Work is
Codex continuation, not new IBM Bob session evidence.

## Behavior

- Student, teacher, organization administrator and system administrator use the
  normal LMS permissions for their roles. The demo request filter only waits for
  bootstrap to commit; it no longer blocks account changes, uploads, settings,
  payment configuration, integrations or other endpoint groups.
- Spring authentication, role checks, ownership, organization boundaries, file
  validation and normal workflow rules still apply. A learner is not an admin.
- Profiles and passwords can be changed; teachers can author courses; managers
  can manage their organization; system admins can manage users and settings.
- Registration uses the normal LMS flow. The original known seed credentials
  remain disabled; no old account was given a public/default password.
- Bootstrap is one-time, recorded in `admin_settings` as `demo.bootstrap.v1`.
  Existing hosted accounts are adopted without resetting them. Later deploys
  preserve changed passwords, profiles, newly created users, settings and progress,
  even if the original seed course has been changed or removed.
- Uploads are enabled with a 50 MB per-file and 52 MB request default. Normal file
  type and role validation applies. `/app/uploads` is backed by Railway volume
  `5799edf5-6fc4-4f80-a929-dee78ad86050`, within the current trial allowance.
  This is bounded demo storage, not unlimited video hosting.

## External services

Permissions and provider configuration are separate. ChatGPT/Wiii, mail, payment
gateways, Google OAuth, document conversion and video workers are not activated
merely by removing an API block. Environment settings can now configure them
without the demo startup guard refusing to run.

The current hosted service keeps those integrations unconfigured. Resend can be
selected with `DEMO_EMAIL_DELIVERY=resend`, a valid `RESEND_API_KEY` and verified
sender; its disabled adapter does not deliver email. Email-dependent recovery
therefore needs the provider, while direct profile/password updates and admin
user management work without it. Do not claim an email was delivered from an API
success alone. Google redirect OAuth also needs compatible redirect proxy behavior;
the current Pages proxy blocks external redirects. The demo image does not contain
ffmpeg or document-conversion services. No payment provider or paid upgrade was added.

The [Railway volume reference](https://docs.railway.com/volumes/reference) explains
trial capacity, mounted-volume ownership and brief deployment downtime. The image
entrypoint prepares the root-owned mount, then runs Java as UID 1001. Existing
assets and PostgreSQL data are not deleted by deployment.
Do not roll the backend back to the older restricted-demo initializer after users
start editing accounts: that code resets passwords/settings and disables new users
on startup. Prefer a forward fix; review account/database effects before a rollback.

## Verification and handoff

The old deployment reproduced `demo_restricted` for a no-change profile update
through genuine UI login for all four roles. This is the before-change baseline.
116 focused backend tests passed for the request filter, initialization/adoption,
restart preservation and configuration/email provider selection. The new Docker
CI probe executes the real entrypoint with a root-owned volume and verifies writes
as UID 1001. Local Docker was unavailable; this check runs in CI.

Hosted acceptance command sequence (private credentials and state stay ignored):

```powershell
python -X utf8 scripts/verify-demo-writes.py --phase baseline --output .tools/demo-writes-baseline
python -X utf8 scripts/verify-demo-writes.py --phase write --output .tools/demo-writes-release
# Restart the isolated backend, wait for successful health, then:
python -X utf8 scripts/verify-demo-writes.py --phase verify-restart --output .tools/demo-writes-release
python -X utf8 scripts/verify-demo-roles.py --output .tools/demo-roles-full-access
```

The write runner edits/restores real profile forms, creates/updates/removes a new
teacher draft, saves organization and system settings, and creates one disposable
learner and synthetic PDF. The restart phase checks the new account, changed
password and uploaded file, removes its stored bytes and blocks only that disposable
learner. The existing file-delete API retains attachment metadata; hard-deleting
an uploader with that reference fails its database foreign key. This existing
attachment-lifecycle limitation is recorded rather than hidden by the test. No
direct database purge is performed. Preserve SAF-101
and existing learner progress. These representative checks do not certify every
historical LMS feature or an unconfigured external provider. Final run IDs and
hosted results are recorded in the full-access PR delivery notes.

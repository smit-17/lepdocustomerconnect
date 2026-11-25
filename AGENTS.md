<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

<!-- AGENT-MEMORY:BEGIN -->
- LEPDO screens live in src/lepdo (ported from the original React Router app); routes in src/routes are thin wrappers. Why: keep the original code recognisable.
- src/lepdo/router.tsx shims Link/NavLink/useNavigate/useParams onto TanStack Router. Why: no react-router-dom allowed.
- src/lepdo/lib/supabase.ts re-exports the shared client untyped; hand-written row types live in src/lepdo/lib/types.ts.
- Customer data is read only through portal_* security-definer functions; customers have no direct table access.
- Invitations run through the inviteUser server function (src/lepdo/lib/invite.functions.ts), not an edge function.
- Public signup creates customer profiles or pending seller requests; staff invitations and seller approvals remain administrator-controlled. Why: public registration must not grant operational privileges.
- Production sign-in has no demo credentials or provisioning endpoints. Why: shared demo access must not grant production privileges.
- Customer uploads and approvals use authenticated portal RPCs with ownership validation; KYC uses private storage. Why: customers must never write staff records directly.
- Order journey ordering uses journey_position while legacy position stays immutable; feedback is optional and excluded from progress. Why: extend existing orders without losing history.
- Staff workflow controls live inside their corresponding progress steps; admin step edits use validated RPCs, insertion assigns a unique custom key and immutable legacy position, and removal sets journey_position to zero. Why: keep controls contextual and preserve historical records.
- Customer approvals are versioned rows in order_approvals, decided only via portal_decide_approval; shipping is gated on the final_invoice step. Why: keep an auditable revision trail.
- Terms acceptance references published database versions and records server timestamps. Why: keep consent tied to the exact approved wording.
- Invoice-step controls use the shared workflow mapping and existing document upload/stage-update paths. Why: keep invoice amounts, file types and progress aligned without bypassing access rules.
<!-- AGENT-MEMORY:END -->
- Destructive history actions use an admin-validated transactional RPC and authenticated server function; storage cleanup uses only returned order file paths. Why: preserve customer records and delete dependent order rows atomically.
- Order action visibility shares one workflow predicate; order lists load completed handovers in one batched query. Why: match detail and list controls without per-row requests.
- Step editing uses stage progress and a persisted admin configuration override, enforced by a shared database guard in all four step RPCs. Why: disabling the switch must block open editors and direct requests too.
- Public customer shares bind revocable per-order tokens to the original customer, use an allowlisted read-only RPC and reuse portal view components with private sections hidden; refresh every five seconds. Why: share customer orders without changing authenticated access or exposing personal, financial or file data.
- Generate customer tracking URLs through the shared validated URL helper, never the browser origin. Why: preview access restrictions must not affect customer links.
- Workflow definitions use stable stage/field keys and per-order ui_schema; administrator RPCs apply universal templates by type or individual snapshots independently of the legacy running-order switch. Why: preserve status, timestamps, detail values and historical records when definitions change.
- Empty business fields use safe defaults or unconfirmed drafts; blank orders use a per-executive unassigned customer, while authentication, ownership and received-payment checks remain enforced. Why: allow incomplete records without weakening access or balances.
- Account email changes use Auth confirmation and profiles derive email only from the canonical Auth identity; signed-in password changes require the current password. Why: prevent unverified identity changes while preserving recovery links.
- Administrator password changes send Auth recovery links to canonical emails; the public reset route reuses the existing password screen. Why: require mailbox approval without storing pending passwords.
- Authoritative roles live in protected user_roles; profiles.role is a legacy projection. is_super_admin gates seller requests; is_admin includes both administrator levels. Staff customer/order RLS uses assignment predicates, not is_operator. Why: enforce hierarchy without global seller data access.
- Super Admin settings retain an Admin directory using the shared team-management controls alongside their own account section. Why: managing administrators must not replace personal Super Admin settings.
- Seller registration uses a rate-limited server function creating confirmed but Auth-banned pending accounts; only admin approval enables password login. Why: bypass seller mailbox confirmation without changing other authentication.
- Seller directory reads use the authenticated admin-only RPC without Auth administration or login-state repairs; explicit account actions own activation. Why: listing must not mutate accounts or require privileged deployment credentials.
- Seller approval, edits, deactivation and permanent deletion run through admin-checked security-definer RPCs that also update Auth login access; self-hosted seller signup falls back to ordinary signup kept pending until approval. Other self-hosted privileged account/history actions forward to the fixed Cloud account-actions endpoint. Why: seller management must work on Vercel without managed credentials or Lovable publishing.
- Permanent seller deletion removes Auth, profile, role and request; business foreign keys and author reads use name-only profile_history, synchronized from profiles, and a privileged RPC releases seller file ownership without moving or deleting files. Why: preserve work and attribution without retaining a login account.

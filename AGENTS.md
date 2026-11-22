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
- The first account ever created becomes admin (handle_new_user trigger); signup is disabled, accounts come from invites or Cloud > Users.
- Demo buttons use ordinary password sign-in against pre-created accounts; never add a public provisioning endpoint. Why: demo access must not expose privileged account creation.
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

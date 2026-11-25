import { useEffect, useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Send, UserRound } from 'lucide-react';
import { Avatar, Badge, Button, Card, Drawer, EmptyState, Field, Input, PageHeader, PageLoader, Select, Tabs, Toggle } from '../../components/ui';
import { PortalStatusBadge } from '../../components/OrderBits';
import { useToast } from '../../components/Toast';
import { keys, run, sendInvite, updateTeamEmail, useCustomers, useSettings } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { AVATAR_BUCKET, supabase } from '../../lib/supabase';
import { errorMessage, fmtDate, timeAgo } from '../../lib/format';
import { CURRENCIES } from '../../lib/workflows';
import type { Role } from '../../lib/types';
import { WorkflowEditor } from '../../components/WorkflowEditor';
import { workflowDefinition, type WorkflowDefinition } from '../../lib/workflow-editor';
import type { OrderType } from '../../lib/types';
import ResetHistoryButton from '../../components/ResetHistoryButton';
import { passwordChangeError } from '../../lib/account';
import SellerRequests from '../../components/SellerRequests';
import { directoryRoleVisible } from '../../lib/seller-access';

type Tab = 'company' | 'team' | 'invitations' | 'account' | 'super' | 'configuration' | 'sellers';

interface DirRow {
  id: string; email: string; full_name: string; role: Role; is_active: boolean; customer_id: string | null; customer_name: string | null;
  job_title: string | null; phone: string | null; whatsapp: string | null; photo_url: string | null; created_at: string; last_sign_in_at: string | null;
}

function useDirectory(enabled: boolean) {
  return useQuery({ queryKey: keys.directory, queryFn: () => run<DirRow[]>(supabase.rpc('admin_user_directory')), enabled });
}

export default function SettingsPage() {
  const { isAdmin, isSuperAdmin, isOperator, profile } = useAuth();
  const [tab, setTab] = useState<Tab>('company');
  const items = isAdmin
    ? [{ value: 'company' as Tab, label: 'Company Profile' }, { value: 'team' as Tab, label: 'Team Members' }, { value: 'invitations' as Tab, label: 'User Invitations' }, { value: 'account' as Tab, label: 'Admin' }, ...(isSuperAdmin ? [{ value: 'super' as Tab, label: 'Super Admin' }] : []), { value: 'configuration' as Tab, label: 'Configuration' }, ...(isSuperAdmin ? [{ value: 'sellers' as Tab, label: 'Seller Requests' }] : [])]
    : profile?.role === 'seller' ? [{ value: 'company' as Tab, label: 'Company Profile' }, { value: 'configuration' as Tab, label: 'Configuration' }] : [{ value: 'company' as Tab, label: 'Company Profile' }, { value: 'account' as Tab, label: 'Account Settings' }];
  return (
    <>
      <PageHeader title="Settings" />
      <div className="mb-6 overflow-x-auto"><Tabs value={tab} onChange={setTab} items={items} /></div>
      {tab === 'company' && <CompanyProfile />}
      {tab === 'team' && isAdmin && <TeamMembers />}
      {tab === 'invitations' && isAdmin && <Invitations />}
      {tab === 'account' && profile?.role !== 'seller' && (isSuperAdmin ? <TeamMembers key="administrators" administratorsOnly /> : <AccountSettings />)}
      {tab === 'super' && isSuperAdmin && <AccountSettings />}
      {tab === 'configuration' && isOperator && <Configuration />}
      {tab === 'sellers' && isSuperAdmin && <SellerRequests />}
    </>
  );
}

function Configuration() {
  const { isAdmin } = useAuth();
  const settings = useSettings();
  const qc = useQueryClient();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  async function change(checked: boolean) {
    if (busy || !settings.data) return;
    setBusy(true);
    try {
      const { error } = await supabase.from('app_settings').update({ edit_running_order_steps: checked }).eq('id', 1);
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: keys.settings });
      toast.success('Configuration saved');
    } catch (error) { toast.error(errorMessage(error)); }
    finally { setBusy(false); }
  }
  if (settings.isLoading) return <PageLoader />;
  return <section className="max-w-2xl">
    <h2 className="mb-4 text-lg font-semibold text-brand-indigo">Configuration</h2>
    <fieldset disabled={busy || !settings.data}>
      <Toggle checked={settings.data?.edit_running_order_steps ?? false} onChange={change} label="Edit steps while order running" />
    </fieldset>
    {isAdmin && <UniversalWorkflows />}
  </section>;
}

function UniversalWorkflows() {
  const [type, setType] = useState<OrderType>('diamond');
  const qc = useQueryClient();
  const workflow = useQuery({ queryKey: ['workflow-template', type], queryFn: async () => workflowDefinition.parse(await run<WorkflowDefinition>(supabase.rpc('admin_get_workflow', { p_type: type }))) });
  async function persist(definition: WorkflowDefinition | null, reset = false) {
    const { error } = await supabase.rpc('admin_save_workflow', { p_type: type, p_definition: definition, p_reset: reset });
    if (error) throw error;
    await qc.invalidateQueries();
  }
  return <section className="mt-8 border-t border-border pt-6">
    <h2 className="mb-4 text-lg font-semibold text-brand-indigo">Universal Edit Steps</h2>
    <div className="mb-5"><Tabs value={type} onChange={setType} items={[{ value: 'diamond', label: 'Diamond' }, { value: 'jewellery', label: 'Jewelry' }]} /></div>
    {workflow.isLoading ? <PageLoader /> : workflow.error ? <p className="text-destructive">{errorMessage(workflow.error)}</p> : workflow.data && <WorkflowEditor key={`${type}-${workflow.dataUpdatedAt}`} initial={workflow.data} onSave={d => persist(d)} onReset={() => persist(null, true)} />}
  </section>;
}

/* ================================================================ Company */
function CompanyProfile() {
  const { isOperator } = useAuth();
  const { data, isLoading } = useSettings();
  const qc = useQueryClient();
  const toast = useToast();
  const [f, setF] = useState({ company_name: '', tagline: '', email: '', phone: '', whatsapp: '', website: '', address: '', default_currency: 'USD', team_sees_all: false });
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (data) setF({ company_name: data.company_name, tagline: data.tagline || '', email: data.email || '', phone: data.phone || '', whatsapp: data.whatsapp || '', website: data.website || '', address: data.address || '', default_currency: data.default_currency, team_sees_all: data.team_sees_all });
  }, [data]);
  if (isLoading) return <PageLoader />;
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }));

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.from('app_settings').update({
      company_name: f.company_name.trim(), tagline: f.tagline.trim() || null, email: f.email.trim() || null, phone: f.phone.trim() || null,
      whatsapp: f.whatsapp.trim() || null, website: f.website.trim() || null, address: f.address.trim() || null, default_currency: f.default_currency, team_sees_all: f.team_sees_all,
    }).eq('id', 1);
    setBusy(false);
    if (error) return toast.error(errorMessage(error));
    qc.invalidateQueries({ queryKey: keys.settings });
    qc.invalidateQueries();
    toast.success('Company profile saved');
  }

  return (
    <Card className="max-w-2xl" title="Company Profile">
      <form onSubmit={save} className="space-y-4">
        <fieldset disabled={!isOperator} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Company name"><Input value={f.company_name} onChange={set('company_name')} maxLength={120} /></Field>
            <Field label="Tagline"><Input value={f.tagline} onChange={set('tagline')} maxLength={200} /></Field>
            <Field label="Email"><Input type="email" value={f.email} onChange={set('email')} /></Field>
            <Field label="Phone"><Input value={f.phone} onChange={set('phone')} /></Field>
            <Field label="WhatsApp"><Input value={f.whatsapp} onChange={set('whatsapp')} /></Field>
            <Field label="Website"><Input value={f.website} onChange={set('website')} placeholder="https://" /></Field>
          </div>
          <Field label="Address"><Input value={f.address} onChange={set('address')} maxLength={500} /></Field>
          <Field label="Default currency for new orders">
            <Select value={f.default_currency} onChange={set('default_currency')} className="max-w-[140px]">{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</Select>
          </Field>
        </fieldset>
        {isOperator ? <Button type="submit" variant="primary" loading={busy}>Save</Button> : <p className="text-xs text-slate-500">Only administrators can change company settings.</p>}
      </form>
    </Card>
  );
}

/* =================================================================== Team */
function statusOf(r: DirRow) {
  if (!r.is_active) return <Badge tone="red">Deactivated</Badge>;
  if (r.last_sign_in_at) return <Badge tone="green">Active</Badge>;
  return <Badge tone="blue">Invited</Badge>;
}

function TeamMembers({ administratorsOnly = false }: { administratorsOnly?: boolean }) {
  const { profile, isSuperAdmin } = useAuth();
  const dir = useDirectory(true);
  const qc = useQueryClient();
  const toast = useToast();
  const defaultRole = administratorsOnly ? 'admin' : 'team';
  const [inv, setInv] = useState({ full_name: '', email: '', phone: '', role: defaultRole as 'team' | 'admin' });
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState<DirRow | null>(null);
  const staff = (dir.data || []).filter((r) => directoryRoleVisible(r.role, isSuperAdmin, administratorsOnly));

  const refresh = () => { qc.invalidateQueries({ queryKey: keys.directory }); qc.invalidateQueries({ queryKey: keys.staff }); };

  async function invite(e: FormEvent) {
    e.preventDefault();
    if (!inv.email.trim()) return toast.error('An email address is needed to send an invitation.');
    setBusy('invite');
    try {
      const r = await sendInvite({ kind: 'team', email: inv.email.trim().toLowerCase(), full_name: inv.full_name.trim(), ...(inv.phone.trim() ? { phone: inv.phone.trim() } : {}), role: inv.role });
      toast.success(`Invitation ${r.status === 'resent' ? 're-sent' : 'sent'} to ${r.email}`);
      setInv({ full_name: '', email: '', phone: '', role: defaultRole });
      refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function update(r: DirRow, patch: Partial<Pick<DirRow, 'role' | 'is_active'>>) {
    setBusy(r.id);
    const { error } = await supabase.from('profiles').update(patch).eq('id', r.id);
    setBusy(null);
    if (error) return toast.error(errorMessage(error));
    refresh();
    toast.success('Team member updated');
  }

  async function resend(r: DirRow) {
    setBusy(r.id);
    try {
      await sendInvite({ kind: 'team', email: r.email, full_name: r.full_name, role: r.role === 'admin' ? 'admin' : 'team' });
      toast.success(`Sign-in link sent to ${r.email}`);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <Card title={administratorsOnly ? 'Invite an admin' : 'Invite a team member'} className="max-w-4xl">
        <form onSubmit={invite} className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_1fr_130px_auto] sm:items-end">
          <Field label="Full name"><Input value={inv.full_name} onChange={(e) => setInv({ ...inv, full_name: e.target.value })} /></Field>
          <Field label="Email"><Input type="email" value={inv.email} onChange={(e) => setInv({ ...inv, email: e.target.value })} /></Field>
          <Field label="Phone number"><Input type="tel" value={inv.phone} onChange={(e) => setInv({ ...inv, phone: e.target.value })} placeholder="+91 …" maxLength={40} /></Field>
          <Field label="Role"><Select value={inv.role} onChange={(e) => setInv({ ...inv, role: e.target.value as 'team' | 'admin' })}><option value="team">Team member</option><option value="admin">Admin</option></Select></Field>
          <Button type="submit" variant="primary" icon={<Send className="h-4 w-4" />} loading={busy === 'invite'}>Invite</Button>
        </form>
      </Card>

      <Card title={`${administratorsOnly ? 'Admins' : 'Team Members'} (${staff.length})`} bodyClass="p-0">
        {dir.isLoading ? <PageLoader /> : (
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead><tr><th>Name</th><th>Role</th><th>Status</th><th>Contact shown to customers</th><th className="text-right">Actions</th></tr></thead>
              <tbody>
                {staff.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <div className="flex items-center gap-3">
                        <Avatar name={r.full_name || r.email} url={r.photo_url} size="sm" />
                        <div><p className="font-medium text-slate-800">{r.full_name || '—'}{r.id === profile?.id && <span className="ml-1 text-xs text-slate-400">(you)</span>}</p><p className="text-xs text-slate-500">{r.email}</p></div>
                      </div>
                    </td>
                    <td>
                      {r.role === 'seller' || r.role === 'super_admin' ? <Badge>{r.role === 'super_admin' ? 'Super Admin' : 'Executive'}</Badge> : <Select value={r.role} disabled={r.id === profile?.id || busy === r.id} onChange={(e) => update(r, { role: e.target.value as Role })} className="h-8 w-32 text-[13px]">
                        <option value="team">Team member</option><option value="admin">Admin</option>
                      </Select>}
                    </td>
                    <td>{statusOf(r)}<p className="mt-0.5 text-xs text-slate-400">{r.last_sign_in_at ? `last seen ${timeAgo(r.last_sign_in_at)}` : `invited ${fmtDate(r.created_at)}`}</p></td>
                    <td className="text-xs text-slate-600">{r.job_title && <p>{r.job_title}</p>}{r.phone && <p>{r.phone}</p>}{r.whatsapp && <p>WhatsApp {r.whatsapp}</p>}{!r.job_title && !r.phone && !r.whatsapp && <span className="text-slate-400">Email only</span>}</td>
                    <td className="whitespace-nowrap text-right">{r.role !== 'super_admin' && <>
                      <Button size="sm" variant="ghost" icon={<Pencil className="h-3.5 w-3.5" />} onClick={() => setEditing(r)}>Edit</Button>
                      {r.role !== 'seller' && !r.last_sign_in_at && r.is_active && <Button size="sm" variant="ghost" loading={busy === r.id} onClick={() => resend(r)}>Resend</Button>}
                      {r.role !== 'seller' && r.id !== profile?.id && (r.is_active
                        ? <Button size="sm" variant="ghost" className="text-red-700" disabled={busy === r.id} onClick={() => update(r, { is_active: false })}>Deactivate</Button>
                        : <Button size="sm" variant="ghost" disabled={busy === r.id} onClick={() => update(r, { is_active: true })}>Activate</Button>)}
                      </>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <ContactDrawer row={editing} onClose={() => setEditing(null)} />
    </div>
  );
}

/** Admin edits an executive's contact card (what customers see). */
function ContactDrawer({ row, onClose }: { row: DirRow | null; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [f, setF] = useState({ full_name: '', email: '', job_title: '', phone: '', whatsapp: '' });
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (row) setF({ full_name: row.full_name, email: row.email, job_title: row.job_title || '', phone: row.phone || '', whatsapp: row.whatsapp || '' }); }, [row]);
  async function save(e: FormEvent) {
    e.preventDefault();
    if (!row) return;
    const email = f.email.trim().toLowerCase();
    setBusy(true);
    if (email && email !== row.email.toLowerCase()) {
      try { await updateTeamEmail(row.id, email); } catch (err) { setBusy(false); return toast.error(errorMessage(err)); }
    }
    const { error } = await supabase.from('profiles').update({ full_name: f.full_name.trim(), job_title: f.job_title.trim() || null, phone: f.phone.trim() || null, whatsapp: f.whatsapp.trim() || null }).eq('id', row.id);
    setBusy(false);
    if (error) return toast.error(errorMessage(error));
    qc.invalidateQueries({ queryKey: keys.directory });
    qc.invalidateQueries({ queryKey: keys.staff });
    toast.success('Team member saved');
    onClose();
  }
  return (
    <Drawer open={!!row} onClose={onClose} title="Edit team member" subtitle={row?.email}
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" type="submit" form="contact-form" loading={busy}>Save</Button></>}>
      <form id="contact-form" onSubmit={save} className="space-y-4">
        <Field label="Full name"><Input value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} maxLength={120} /></Field>
        <Field label="Email" hint={row?.role === 'seller' ? undefined : 'Changing this changes the address they sign in with.'}><Input type="email" disabled={row?.role === 'seller'} value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
        <Field label="Job title"><Input value={f.job_title} onChange={(e) => setF({ ...f, job_title: e.target.value })} placeholder="e.g. Client Relationship Manager" maxLength={120} /></Field>
        <Field label="Phone"><Input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} placeholder="+91 …" /></Field>
        <Field label="WhatsApp" hint="Customers get a one-tap WhatsApp button."><Input value={f.whatsapp} onChange={(e) => setF({ ...f, whatsapp: e.target.value })} placeholder="+91 …" /></Field>
        <p className="text-xs text-slate-500">Team members can upload their own photo under Account Settings.</p>
      </form>
    </Drawer>
  );
}

/* ============================================================ Invitations */
function Invitations() {
  const dir = useDirectory(true);
  const customers = useCustomers('');
  const qc = useQueryClient();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const portalUsers = (dir.data || []).filter((r) => r.role === 'customer');
  const notInvited = (customers.data || []).filter((c) => c.portal_status === 'not_invited');

  async function invite(customerId: string, email?: string) {
    setBusy(customerId + (email || ''));
    try {
      const r = await sendInvite({ kind: 'customer', customer_id: customerId, email });
      toast.success(`${r.status === 'resent' ? 'Sign-in link re-sent' : 'Invitation sent'} to ${r.email}`);
      qc.invalidateQueries({ queryKey: keys.directory });
      qc.invalidateQueries({ queryKey: ['customers'] });
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function setActive(r: DirRow, is_active: boolean) {
    setBusy(r.id);
    const { error } = await supabase.from('profiles').update({ is_active }).eq('id', r.id);
    setBusy(null);
    if (error) return toast.error(errorMessage(error));
    qc.invalidateQueries({ queryKey: keys.directory });
    qc.invalidateQueries({ queryKey: ['customers'] });
    toast.success(is_active ? 'Portal access restored' : 'Portal access disabled');
  }

  return (
    <div className="space-y-6">
      <Card title={`Customers not yet invited (${notInvited.length})`} bodyClass="p-0">
        {notInvited.length === 0 ? <EmptyState title="Every customer has been invited." /> : (
          <ul className="divide-y divide-slate-100">
            {notInvited.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5">
                <div className="min-w-0 flex-1"><p className="font-medium text-slate-800">{c.name}</p><p className="text-xs text-slate-500">{c.email} · {c.country}</p></div>
                <Button size="sm" icon={<Send className="h-3.5 w-3.5" />} loading={busy === c.id} onClick={() => invite(c.id)}>Send Invitation</Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title={`Customer portal users (${portalUsers.length})`} bodyClass="p-0">
        {dir.isLoading ? <PageLoader /> : portalUsers.length === 0 ? <EmptyState icon={<UserRound className="h-5 w-5" />} title="No customer portal users yet." /> : (
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead><tr><th>User</th><th>Customer</th><th>Status</th><th className="text-right">Actions</th></tr></thead>
              <tbody>
                {portalUsers.map((r) => (
                  <tr key={r.id}>
                    <td><p className="font-medium text-slate-800">{r.full_name || '—'}</p><p className="text-xs text-slate-500">{r.email}</p></td>
                    <td>{r.customer_name || <span className="text-orange-700">Not linked</span>}</td>
                    <td><PortalStatusBadge status={!r.is_active ? 'disabled' : r.last_sign_in_at ? 'active' : 'invited'} /><p className="mt-0.5 text-xs text-slate-400">{r.last_sign_in_at ? `last seen ${timeAgo(r.last_sign_in_at)}` : `invited ${fmtDate(r.created_at)}`}</p></td>
                    <td className="whitespace-nowrap text-right">
                      {r.customer_id && r.is_active && <Button size="sm" variant="ghost" loading={busy === r.customer_id + r.email} onClick={() => { if (r.customer_id) invite(r.customer_id, r.email); }}>Resend link</Button>}
                      {r.is_active
                        ? <Button size="sm" variant="ghost" className="text-red-700" disabled={busy === r.id} onClick={() => setActive(r, false)}>Disable</Button>
                        : <Button size="sm" variant="ghost" disabled={busy === r.id} onClick={() => setActive(r, true)}>Enable</Button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

/* ================================================================ Account */
function AccountSettings() {
  const { profile, refreshProfile, session, isAdmin } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const [f, setF] = useState({ full_name: '', job_title: '', phone: '', whatsapp: '' });
  const [email, setEmail] = useState('');
  const [emailNotice, setEmailNotice] = useState<string | null>(null);
  const [pw, setPw] = useState({ current: '', a: '', b: '' });
  const [busy, setBusy] = useState<string | null>(null);
  useEffect(() => { if (profile) setF({ full_name: profile.full_name, job_title: profile.job_title || '', phone: profile.phone || '', whatsapp: profile.whatsapp || '' }); }, [profile]);
  useEffect(() => { setEmail(session?.user.email || ''); }, [session?.user.email]);
  if (!profile) return null;

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!profile || busy) return;
    setBusy('profile');
    const address = email.trim().toLowerCase();
    const { data: verified, error: authError } = await supabase.auth.getUser();
    if (authError || !verified.user) { setBusy(null); return toast.error('Please sign in again.'); }
    if (address !== verified.user.email?.toLowerCase()) {
      const { error: emailError } = await supabase.auth.updateUser({ email: address }, { emailRedirectTo: `${window.location.origin}/login` });
      if (emailError) { setBusy(null); return toast.error(emailError.message); }
      setEmailNotice('Confirm the email change using the links sent to your current and new email addresses. Your current login remains active until confirmation is complete.');
    }
    const { error } = await supabase.from('profiles').update({ full_name: f.full_name.trim(), job_title: f.job_title.trim() || null, phone: f.phone.trim() || null, whatsapp: f.whatsapp.trim() || null }).eq('id', profile.id);
    setBusy(null);
    if (error) return toast.error(errorMessage(error));
    await refreshProfile();
    qc.invalidateQueries({ queryKey: keys.staff });
    toast.success('Profile saved');
  }

  async function uploadPhoto(file: File | undefined) {
    if (!file || !profile) return;
    if (file.size > 2 * 1024 * 1024) return toast.error('Photo must be under 2 MB.');
    setBusy('photo');
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z]/g, '');
    const path = `${profile.id}/${crypto.randomUUID()}.${ext}`;
    const up = await supabase.storage.from(AVATAR_BUCKET).upload(path, file, { contentType: file.type });
    if (up.error) { setBusy(null); return toast.error(errorMessage(up.error)); }
    const signed = await supabase.storage.from(AVATAR_BUCKET).createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
    if (signed.error || !signed.data) { setBusy(null); return toast.error(errorMessage(signed.error)); }
    const url = signed.data.signedUrl;
    const { error } = await supabase.from('profiles').update({ photo_url: url }).eq('id', profile.id);
    setBusy(null);
    if (error) return toast.error(errorMessage(error));
    await refreshProfile();
    qc.invalidateQueries({ queryKey: keys.staff });
    toast.success('Photo updated');
  }

  async function changePassword(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (isAdmin) {
      setBusy('pw');
      const { data: verified, error: verificationError } = await supabase.auth.getUser();
      if (verificationError || !verified.user?.email) { setBusy(null); return toast.error('Please sign in again.'); }
      const { error } = await supabase.auth.resetPasswordForEmail(verified.user.email, { redirectTo: `${window.location.origin}/reset-password` });
      setBusy(null);
      if (error) return toast.error(error.message);
      return toast.success('A password change link has been sent to your existing email address.');
    }
    const validation = passwordChangeError(pw.current, pw.a, pw.b);
    if (validation) return toast.error(validation);
    setBusy('pw');
    const { error } = await supabase.auth.updateUser({ password: pw.a, current_password: pw.current });
    setBusy(null);
    if (error) return toast.error(error.message);
    setPw({ current: '', a: '', b: '' });
    toast.success('Password changed');
  }

  return (
    <div className="grid max-w-4xl grid-cols-1 gap-6 lg:grid-cols-[1.4fr_1fr]">
      <Card title="My profile">
        <div className="mb-5 flex items-center gap-4">
          <Avatar name={profile.full_name || profile.email} url={profile.photo_url} size="lg" />
          <label className="cursor-pointer text-sm font-medium text-brand-indigo hover:underline">
            {busy === 'photo' ? 'Uploading…' : profile.photo_url ? 'Change photo' : 'Upload professional photo'}
            <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => uploadPhoto(e.target.files?.[0])} />
          </label>
        </div>
        <form onSubmit={save} className="space-y-4">
          <Field label="Full name"><Input value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} maxLength={120} /></Field>
          <Field label="Email"><Input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
          {emailNotice && <p role="status" className="text-sm text-muted-foreground">{emailNotice}</p>}
          <Field label="Job title" hint="Shown to your customers."><Input value={f.job_title} onChange={(e) => setF({ ...f, job_title: e.target.value })} maxLength={120} /></Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Phone"><Input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
            <Field label="WhatsApp"><Input value={f.whatsapp} onChange={(e) => setF({ ...f, whatsapp: e.target.value })} /></Field>
          </div>
          <Button type="submit" variant="primary" loading={busy === 'profile'}>Save profile</Button>
        </form>
      </Card>
      <Card title="Change password">
        <form onSubmit={changePassword} className="space-y-4">
          {!isAdmin && <>
          <Field label="Current password"><Input type="password" autoComplete="current-password" required value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} /></Field>
          <Field label="New password"><Input type="password" autoComplete="new-password" value={pw.a} onChange={(e) => setPw({ ...pw, a: e.target.value })} /></Field>
          <Field label="Confirm password"><Input type="password" autoComplete="new-password" value={pw.b} onChange={(e) => setPw({ ...pw, b: e.target.value })} /></Field>
          </>}
          <Button type="submit" loading={busy === 'pw'}>{isAdmin ? 'Send password change link' : 'Update password'}</Button>
        </form>
        <div className="mt-6"><ResetHistoryButton /></div>
      </Card>
    </div>
  );
}

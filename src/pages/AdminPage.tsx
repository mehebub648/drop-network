import GuidedForm from '../components/GuidedForm';
import Select from '../components/Select';
import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import {
  Activity,
  AlertTriangle,
  BadgeCheck,
  BookOpenText,
  Building2,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  ClipboardList,
  Clock3,
  Database,
  HeartPulse,
  LayoutDashboard,
  LockKeyhole,
  MessageSquare,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Server,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Smartphone,
  Trash2,
  UserCheck,
  UserCog,
  Users,
  X,
  XCircle
} from 'lucide-react';
import { api, type AdminCommunityPost, type CommunityPostStatus } from '../lib/api';
import ModalPortal from '../components/ModalPortal';
import { useSearchParams } from 'react-router';

type Capability =
  | 'DASHBOARD'
  | 'MODERATE_CONTENT'
  | 'SUSPEND_MEMBER'
  | 'VIEW_USERS'
  | 'EDIT_USERS'
  | 'REVOKE_SESSIONS'
  | 'MANAGE_SUPPORT'
  | 'MANAGE_ORGANIZATIONS'
  | 'VIEW_AUDIT'
  | 'MANAGE_SMS'
  | 'MANAGE_STAFF'
  | 'MANAGE_SYSTEM';

type StaffRole = 'MODERATOR' | 'ADMIN' | 'SUPERADMIN';

type AdminViewer = {
  id: string;
  name: string;
  phone: string;
  staff_role?: StaffRole;
};

type Overview = {
  viewer?: { staff_role?: StaffRole; capabilities?: Capability[] };
  counts: Record<string, number>;
  reports?: AdminRecord[];
  tickets?: AdminRecord[];
  system?: Record<string, string | number | boolean | null | undefined>;
};

type AdminRecord = {
  id: string;
  [key: string]: any;
};

type ContactReportData = {
  items: AdminRecord[];
  aggregations: Record<string, Record<string, number>>;
  states: Record<string, { suspended: boolean; suspended_at?: string; suspension_count?: number }>;
};

type TabId = 'overview' | 'members' | 'requests' | 'community' | 'reports' | 'support' | 'organizations' | 'claims' | 'audit' | 'messavo' | 'system';

type SmsProvider = {
  id: string;
  name: string;
  base_url: string;
  priority: number;
  enabled: boolean;
  deleted_at?: string;
  has_api_token: boolean;
  created_at: string;
  updated_at: string;
};

type EditorState =
  | { kind: 'member'; record: AdminRecord }
  | { kind: 'request'; record: AdminRecord }
  | { kind: 'post'; record: AdminCommunityPost }
  | { kind: 'comment'; record: AdminRecord; requestId: string }
  | { kind: 'provider'; record?: SmsProvider };

type DialogState = {
  title: string;
  description: string;
  confirmLabel: string;
  tone?: 'default' | 'danger';
  reasonLabel?: string;
  reasonRequired?: boolean;
  onConfirm: (reason: string) => Promise<void>;
};

const roleCapabilities: Record<StaffRole, Capability[]> = {
  MODERATOR: ['DASHBOARD', 'MODERATE_CONTENT', 'SUSPEND_MEMBER', 'VIEW_USERS'],
  ADMIN: ['DASHBOARD', 'MODERATE_CONTENT', 'SUSPEND_MEMBER', 'VIEW_USERS', 'EDIT_USERS', 'REVOKE_SESSIONS', 'MANAGE_SUPPORT', 'MANAGE_ORGANIZATIONS', 'VIEW_AUDIT', 'MANAGE_SMS'],
  SUPERADMIN: ['DASHBOARD', 'MODERATE_CONTENT', 'SUSPEND_MEMBER', 'VIEW_USERS', 'EDIT_USERS', 'REVOKE_SESSIONS', 'MANAGE_SUPPORT', 'MANAGE_ORGANIZATIONS', 'VIEW_AUDIT', 'MANAGE_SMS', 'MANAGE_STAFF', 'MANAGE_SYSTEM']
};

const tabs: Array<{ id: TabId; label: string; icon: typeof LayoutDashboard; capability?: Capability; countKey?: string }> = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'members', label: 'Members', icon: Users, capability: 'VIEW_USERS' },
  { id: 'requests', label: 'Requests', icon: HeartPulse, capability: 'MODERATE_CONTENT', countKey: 'active_requests' },
  { id: 'community', label: 'Community', icon: BookOpenText, capability: 'MODERATE_CONTENT' },
  { id: 'reports', label: 'Reports', icon: ShieldAlert, capability: 'MODERATE_CONTENT', countKey: 'open_reports' },
  { id: 'support', label: 'Support', icon: ClipboardList, capability: 'MANAGE_SUPPORT', countKey: 'open_tickets' },
  { id: 'organizations', label: 'Partners', icon: Building2, capability: 'MANAGE_ORGANIZATIONS', countKey: 'pending_organizations' },
  { id: 'claims', label: 'Claims', icon: UserCheck, capability: 'MANAGE_ORGANIZATIONS', countKey: 'pending_directory_claims' },
  { id: 'audit', label: 'Activity', icon: LockKeyhole, capability: 'VIEW_AUDIT' },
  { id: 'messavo', label: 'Messavo SMS', icon: Smartphone, capability: 'MANAGE_SMS' },
  { id: 'system', label: 'System', icon: Server }
];

const countLabels: Record<string, string> = {
  users: 'Members',
  verified_users: 'Verified members',
  suspended_users: 'Suspended',
  registered_donors: 'Registered donors',
  available_donors: 'Available donors',
  total_requests: 'All requests',
  active_requests: 'Active requests',
  open_reports: 'Open reports',
  open_tickets: 'Open tickets',
  confirmed_donations: 'Confirmed donations',
  failed_follow_up_reminders: 'Failed follow-up reminders',
  disputed_donations: 'Disputed donations',
  verified_organizations: 'Verified partners',
  pending_organizations: 'Partner reviews',
  pending_directory_claims: 'Profile claims'
};

export default function AdminPage({ user, onOtpBypassChange }: { user: AdminViewer; onOtpBypassChange: (enabled: boolean) => void }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get('section') as TabId | null;
  const auditUserFilter = searchParams.get('user') || '';
  const [activeTab, setActiveTab] = useState<TabId>(requestedTab && tabs.some(tab => tab.id === requestedTab) ? requestedTab : 'overview');
  const [overview, setOverview] = useState<Overview | null>(null);
  const [members, setMembers] = useState<AdminRecord[]>([]);
  const [requests, setRequests] = useState<AdminRecord[]>([]);
  const [communityPosts, setCommunityPosts] = useState<AdminCommunityPost[]>([]);
  const [organizations, setOrganizations] = useState<AdminRecord[]>([]);
  const [claims, setClaims] = useState<AdminRecord[]>([]);
  const [auditEvents, setAuditEvents] = useState<AdminRecord[]>([]);
  const [smsProviders, setSmsProviders] = useState<SmsProvider[]>([]);
  const [contactReports, setContactReports] = useState<ContactReportData>({ items: [], aggregations: {}, states: {} });
  const [userSearch, setUserSearch] = useState('');
  const [requestStatus, setRequestStatus] = useState('');
  const [communityStatus, setCommunityStatus] = useState<'' | Extract<CommunityPostStatus, 'PUBLISHED' | 'HIDDEN'>>('');
  const [auditSearch, setAuditSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const contentRef = useRef<HTMLElement>(null);
  const focusNewSectionRef = useRef(false);

  const capabilities = useMemo(() => {
    const resolved = overview?.viewer?.capabilities;
    return new Set<Capability>(resolved?.length ? resolved : user.staff_role ? roleCapabilities[user.staff_role] : []);
  }, [overview?.viewer?.capabilities, user.staff_role]);
  const can = (capability: Capability) => capabilities.has(capability);

  const visibleTabs = tabs.filter(tab => !tab.capability || can(tab.capability));

  const loadOverview = async () => {
    const next = await api.getAdminOverview();
    const normalized: Overview = {
      ...next,
      counts: next.counts || {},
      reports: next.reports || [],
      tickets: next.tickets || []
    };
    setOverview(normalized);
    return normalized;
  };

  const loadCommunityPosts = async (reportedPostIds: string[] = []) => {
    const allPosts = await api.getAdminCommunityPosts();
    const unique = new Map<string, AdminCommunityPost>();
    allPosts.forEach(post => unique.set(post.id, post));
    const missingIds = [...new Set(reportedPostIds)].filter(id => id && !unique.has(id));
    const missingResults = await Promise.allSettled(missingIds.map(id => api.getAdminCommunityPost(id)));
    missingResults.forEach(result => {
      if (result.status === 'fulfilled') {
        unique.set(result.value.id, result.value);
        return;
      }
      const status = (result.reason as Error & { status?: number })?.status;
      if (status !== 404) throw result.reason;
    });
    setCommunityPosts(
      [...unique.values()].sort((left, right) => new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime())
    );
  };

  const loadTab = async (tab: TabId) => {
    setLoading(true);
    setError('');
    try {
      if (tab === 'overview' || tab === 'support' || tab === 'system') {
        await loadOverview();
      } else if (tab === 'reports') {
        const [next, contactData] = await Promise.all([loadOverview(), api.getAdminCallReports()]);
        setContactReports({ items: contactData.items || [], aggregations: contactData.aggregations || {}, states: contactData.states || {} });
        const reportedPostIds = (next.reports || [])
          .filter(report => report.target_type === 'POST')
          .map(report => String(report.target_id || ''))
          .filter(Boolean);
        await loadCommunityPosts(reportedPostIds);
      } else if (tab === 'members') {
        setMembers(await api.getAdminUsers(userSearch, { include_deleted: true }));
      } else if (tab === 'requests') {
        setRequests(await api.getAdminRequests());
      } else if (tab === 'community') {
        await loadCommunityPosts();
      } else if (tab === 'organizations') {
        setOrganizations(await api.getAdminOrganizations());
      } else if (tab === 'claims') {
        const result = await api.getDirectoryClaims();
        setClaims(result.claims || []);
      } else if (tab === 'audit') {
        setAuditEvents(await api.getAuditLog({ limit: 250, ...(auditUserFilter ? { user_id: auditUserFilter } : {}) }));
      } else if (tab === 'messavo') {
        setSmsProviders(await api.getAdminSmsProviders());
      }
    } catch (caught: any) {
      setError(caught.message || 'Could not load this administration area.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadTab(activeTab);
  }, [activeTab, auditUserFilter]);

  useEffect(() => {
    const next = searchParams.get('section') as TabId | null;
    if (next && tabs.some(tab => tab.id === next) && next !== activeTab) setActiveTab(next);
    if (!next && activeTab !== 'overview') setActiveTab('overview');
  }, [searchParams]);

  useEffect(() => {
    if (!focusNewSectionRef.current) return;
    const frame = window.requestAnimationFrame(() => {
      const heading = contentRef.current?.querySelector<HTMLElement>('h2');
      if (!heading) return;
      heading.tabIndex = -1;
      heading.focus({ preventScroll: true });
      heading.scrollIntoView({ behavior: 'auto', block: 'start' });
      focusNewSectionRef.current = false;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activeTab, loading]);

  const selectTab = (tab: TabId) => {
    if (tab === activeTab) return;
    focusNewSectionRef.current = true;
    const next = new URLSearchParams(searchParams);
    if (tab === 'overview') next.delete('section');
    else next.set('section', tab);
    setSearchParams(next);
  };

  const refresh = () => loadTab(activeTab);

  const run = async (key: string, action: () => Promise<unknown>, successMessage: string) => {
    setBusy(key);
    setError('');
    setNotice('');
    try {
      await action();
      setNotice(successMessage);
      await refresh();
    } catch (caught: any) {
      setError(caught.message || 'The update could not be completed.');
    } finally {
      setBusy('');
    }
  };

  const openAction = (next: DialogState) => setDialog(next);

  const contactReportAction = (donorRef: string, action: 'SUSPEND' | 'RESTORE' | 'RESOLVE_DISPUTE', disputeId?: string) => {
    openAction({
      title: action === 'SUSPEND' ? 'Suppress this donor from search?' : action === 'RESTORE' ? 'Restore this donor?' : 'Resolve this dispute?',
      description: 'The reason is protected in the audit trail. Existing call evidence is retained.',
      confirmLabel: action === 'SUSPEND' ? 'Suppress donor' : action === 'RESTORE' ? 'Restore donor' : 'Resolve dispute',
      tone: action === 'SUSPEND' ? 'danger' : 'default',
      reasonLabel: 'Staff review note',
      reasonRequired: true,
      onConfirm: reason => run(`contact-${donorRef}-${action}`, () => api.moderateContactReports({ donor_ref: donorRef, action, note: reason, dispute_id: disputeId }), 'Contact report state updated.')
    });
  };

  const submitMemberSearch = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      setMembers(await api.getAdminUsers(userSearch, { include_deleted: true }));
    } catch (caught: any) {
      setError(caught.message || 'Could not search members.');
    } finally {
      setLoading(false);
    }
  };

  const moveProvider = (index: number, direction: -1 | 1) => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= smsProviders.length) return;
    const reordered = [...smsProviders];
    [reordered[index], reordered[nextIndex]] = [reordered[nextIndex], reordered[index]];
    const moving = smsProviders[index];
    moderationAction(
      `Move ${moving.name} to priority ${nextIndex + 1}?`,
      'Save priority order',
      'default',
      reason => api.rankAdminSmsProviders(reordered.filter(provider => !provider.deleted_at).map(provider => provider.id), reason),
      'SMS fallback priority updated.'
    );
  };

  const saveEditor = async (values: Record<string, unknown>) => {
    if (!editor) return;
    setBusy('editor');
    setError('');
    try {
      if (editor.kind === 'member') {
        await api.updateAdminUser(editor.record.id, values);
      } else if (editor.kind === 'request') {
        const { reason, ...changes } = values;
        await api.moderateAdminRequest(editor.record.id, { action: 'UPDATE', changes, reason: String(reason || '') });
      } else if (editor.kind === 'post') {
        const { reason, ...changes } = values;
        await api.mutateAdminCommunityPost(editor.record.id, { action: 'UPDATE', changes, reason: String(reason || '') });
      } else if (editor.kind === 'comment') {
        await api.moderateAdminComment(editor.requestId, editor.record.id, { action: 'UPDATE', text: String(values.text || ''), reason: String(values.reason || '') });
      } else if (editor.record) {
        await api.updateAdminSmsProvider(editor.record.id, values as any);
      } else {
        await api.createAdminSmsProvider(values as any);
      }
      setNotice(editor.kind === 'provider' ? 'SMS provider saved.' : 'Record updated.');
      setEditor(null);
      await refresh();
    } catch (caught: any) {
      setError(caught.message || 'The update could not be saved.');
      throw caught;
    } finally {
      setBusy('');
    }
  };

  const filteredRequests = requests.filter(request => !requestStatus || request.status === requestStatus);
  const filteredCommunityPosts = communityPosts.filter(post => !communityStatus || post.status === communityStatus);
  const communityById = new Map(communityPosts.map(post => [post.id, post]));
  const filteredAudit = auditEvents.filter(event => {
    const query = auditSearch.trim().toLowerCase();
    return !query || [event.summary, event.category, event.action, event.target_type, event.target_id, event.actor_id]
      .some(value => String(value || '').toLowerCase().includes(query));
  });
  const undoneAuditEventIds = new Set(
    auditEvents
      .filter(event => event.action === 'ADMIN_ACTION_UNDONE')
      .map(event => String(event.metadata?.original_event_id || ''))
      .filter(Boolean)
  );

  return (
    <div className="admin-shell">
      <header className="admin-hero">
        <div>
          <div className="eyebrow"><ShieldCheck className="h-4 w-4" /> Protected operations</div>
          <h1>Administration center</h1>
          <p>Review network activity, protect members, resolve queues, and inspect every privileged change from one role-aware workspace.</p>
        </div>
        <div className="admin-identity">
          <span className="admin-avatar" aria-hidden="true">{initials(user.name)}</span>
          <div>
            <strong>{user.name}</strong>
            <span>{overview?.viewer?.staff_role || user.staff_role || 'Staff'}</span>
          </div>
          <button className="icon-button" onClick={() => void refresh()} aria-label="Refresh current view" title="Refresh">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </header>

      <div className="admin-layout">
        <aside className="admin-sidebar" aria-label="Administration sections">
          <div className="admin-sidebar-label">Workspace</div>
          <nav>
            {visibleTabs.map(tab => {
              const Icon = tab.icon;
              const hasOverviewCount = Boolean(
                tab.countKey
                && overview
                && Object.prototype.hasOwnProperty.call(overview.counts, tab.countKey)
              );
              const count = hasOverviewCount && tab.countKey
                ? Number(overview!.counts[tab.countKey])
                : undefined;
              return (
                <button
                  key={tab.id}
                  onClick={() => selectTab(tab.id)}
                  className={activeTab === tab.id ? 'is-active' : ''}
                  aria-current={activeTab === tab.id ? 'page' : undefined}
                  aria-label={`${tab.label}${count === undefined ? '' : `, ${count} item${count === 1 ? '' : 's'}`}${activeTab === tab.id ? ', current section' : ''}`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{tab.label}</span>
                  {count !== undefined && <span className="admin-nav-count" aria-hidden="true">{count}</span>}
                </button>
              );
            })}
          </nav>
          <div className="admin-access-card">
            <LockKeyhole className="h-5 w-5" />
            <strong>Least-privilege access</strong>
            <p>You only see controls allowed for your assigned staff role.</p>
          </div>
        </aside>

        <main ref={contentRef} className="admin-content">
          {error && <div role="alert" className="alert alert-error"><AlertTriangle className="h-5 w-5" />{error}</div>}
          {notice && <div role="status" className="alert alert-success"><CheckCircle2 className="h-5 w-5" />{notice}</div>}
          {loading && !overview ? <LoadingState /> : (
            <>
              {activeTab === 'overview' && overview && (
                <OverviewPanel
                  overview={overview}
                  can={can}
                  onNavigate={selectTab}
                />
              )}

              {activeTab === 'members' && (
                <section>
                  <PanelHeader
                    eyebrow="People and access"
                    title="Member management"
                    description="Find accounts, inspect donor state, suspend unsafe access, revoke sessions, and manage staff hierarchy."
                  />
                  <GuidedForm onSubmit={submitMemberSearch} className="admin-filter-bar">
                    <label className="search-field">
                      <Search className="h-4 w-4" />
                      <span className="sr-only">Search members</span>
                      <input value={userSearch} onChange={event => setUserSearch(event.target.value)} placeholder="Search name or Bangladesh phone" />
                    </label>
                    <button className="button button-primary" disabled={loading}>Search members</button>
                  </GuidedForm>
                  {loading ? <LoadingRows /> : members.length === 0 ? (
                    <EmptyState icon={Users} title="No members found" description="Try a broader name or phone search." />
                  ) : (
                    <div className="admin-record-list">
                      {members.map(member => {
                        const targetIsStaff = Boolean(member.staff_role);
                        const canTouchTarget = member.id !== user.id && (user.staff_role === 'SUPERADMIN' || !targetIsStaff);
                        return (
                          <article key={member.id} className="admin-record">
                            <div className="record-primary">
                              <span className="admin-avatar admin-avatar-small" aria-hidden="true">{initials(member.name)}</span>
                              <div>
                                <div className="record-title-row">
                                  <h3>{member.name}</h3>
                                  <StatusBadge value={member.deleted_at ? 'DELETED' : member.account_status || 'ACTIVE'} />
                                  {member.staff_role && <StatusBadge value={member.staff_role} tone="purple" />}
                                  {member.is_verified && <span className="verified-label"><BadgeCheck className="h-3.5 w-3.5" /> Verified phone</span>}
                                </div>
                                <p>{member.phone} · Joined {formatDate(member.created_at)}</p>
                                <div className="record-facts">
                                  <span>{member.donor_profile?.blood_group || 'No donor profile'}</span>
                                  <span>{member.donor_profile?.location?.area_name || 'No district'}</span>
                                  <span>{humanize(member.donor_profile?.availability_status || 'NOT_AVAILABLE')}</span>
                                </div>
                                {member.suspension_reason && <p className="record-note">Reason: {member.suspension_reason}</p>}
                              </div>
                            </div>
                            <div className="record-actions">
                              {can('VIEW_AUDIT') && (
                                <button className="button button-secondary" onClick={() => {
                                  const next = new URLSearchParams(searchParams);
                                  next.set('section', 'audit');
                                  next.set('user', member.id);
                                  setSearchParams(next);
                                }}>Activity</button>
                              )}
                              {can('EDIT_USERS') && canTouchTarget && !member.deleted_at && (
                                <button className="button button-secondary" onClick={() => setEditor({ kind: 'member', record: member })}>
                                  <Pencil className="h-3.5 w-3.5" /> Edit
                                </button>
                              )}
                              {can('REVOKE_SESSIONS') && member.id !== user.id && !member.deleted_at && (
                                <button
                                  className="button button-secondary"
                                  disabled={busy === `sessions-${member.id}`}
                                  onClick={() => openAction({
                                    title: `Sign ${member.name} out everywhere?`,
                                    description: 'Every active session for this member will be revoked. Their password is not changed.',
                                    confirmLabel: 'Revoke sessions',
                                    reasonLabel: 'Operational reason',
                                    reasonRequired: true,
                                    onConfirm: reason => run(`sessions-${member.id}`, () => api.revokeAdminUserSessions(member.id, reason), 'Member sessions revoked.')
                                  })}
                                >
                                  Revoke sessions
                                </button>
                              )}
                              {can('SUSPEND_MEMBER') && canTouchTarget && !member.deleted_at && (
                                <button
                                  className={`button ${member.account_status === 'SUSPENDED' ? 'button-secondary' : 'button-danger'}`}
                                  disabled={busy === `status-${member.id}`}
                                  onClick={() => {
                                    const reactivating = member.account_status === 'SUSPENDED';
                                    openAction({
                                      title: reactivating ? `Reactivate ${member.name}?` : `Suspend ${member.name}?`,
                                      description: reactivating
                                        ? 'The member will be able to sign in again. Donor availability must still be reconfirmed.'
                                        : 'Active sessions will be revoked and the donor will be removed from available matches.',
                                      confirmLabel: reactivating ? 'Reactivate member' : 'Suspend member',
                                      tone: reactivating ? 'default' : 'danger',
                                      reasonLabel: reactivating ? 'Reactivation note' : 'Suspension reason',
                                      reasonRequired: true,
                                      onConfirm: reason => run(
                                        `status-${member.id}`,
                                        () => api.updateAdminUser(member.id, {
                                          account_status: reactivating ? 'ACTIVE' : 'SUSPENDED',
                                          suspension_reason: reactivating ? '' : reason,
                                          reason
                                        }),
                                        reactivating ? 'Member reactivated.' : 'Member suspended.'
                                      )
                                    });
                                  }}
                                >
                                  {member.account_status === 'SUSPENDED' ? 'Reactivate' : 'Suspend'}
                                </button>
                              )}
                              {can('MANAGE_STAFF') && member.id !== user.id && !member.deleted_at && (
                                <StaffRoleControl
                                  value={member.staff_role || ''}
                                  disabled={busy === `role-${member.id}`}
                                  onChange={nextRole => openAction({
                                    title: `Change staff access for ${member.name}?`,
                                    description: nextRole
                                      ? `This assigns the ${nextRole.toLowerCase()} role and its protected capabilities.`
                                      : 'This removes access to the administration center.',
                                    confirmLabel: nextRole ? 'Assign staff role' : 'Remove staff access',
                                    tone: nextRole ? 'default' : 'danger',
                                    reasonLabel: 'Reason for access change',
                                    reasonRequired: true,
                                    onConfirm: reason => run(
                                      `role-${member.id}`,
                                      () => api.updateAdminUser(member.id, { staff_role: nextRole || null, reason }),
                                      'Staff access updated.'
                                    )
                                  })}
                                />
                              )}
                              {can('EDIT_USERS') && canTouchTarget && (member.deleted_at ? (
                                <button
                                  className="button button-secondary"
                                  onClick={() => openAction({
                                    title: `Restore ${member.name}?`,
                                    description: 'The account will be available again. Existing sessions stay revoked until the member signs in.',
                                    confirmLabel: 'Restore account',
                                    reasonLabel: 'Reason for restoring',
                                    reasonRequired: true,
                                    onConfirm: reason => run(`restore-user-${member.id}`, () => api.restoreAdminUser(member.id, reason), 'Member restored.')
                                  })}
                                ><RotateCcw className="h-3.5 w-3.5" /> Restore</button>
                              ) : (
                                <button
                                  className="button button-danger"
                                  onClick={() => openAction({
                                    title: `Delete ${member.name}?`,
                                    description: 'This soft-deletes the account, revokes active sessions, and keeps the action reversible from this workspace.',
                                    confirmLabel: 'Delete account',
                                    tone: 'danger',
                                    reasonLabel: 'Reason for deletion',
                                    reasonRequired: true,
                                    onConfirm: reason => run(`delete-user-${member.id}`, () => api.deleteAdminUser(member.id, reason), 'Member deleted.')
                                  })}
                                ><Trash2 className="h-3.5 w-3.5" /> Delete</button>
                              ))}
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  )}
                </section>
              )}

              {activeTab === 'requests' && (
                <section>
                  <PanelHeader
                    eyebrow="Content operations"
                    title="Blood request review"
                    description="Inspect active and historical requests, then record a reasoned moderation decision."
                  />
                  <div className="admin-filter-bar">
                    <label className="select-field">
                      <SlidersHorizontal className="h-4 w-4" />
                      <span className="sr-only">Filter request status</span>
                      <Select value={requestStatus} onChange={event => setRequestStatus(event.target.value)}>
                        <option value="">All statuses</option>
                        {['DRAFT', 'ACTIVE', 'PARTIALLY_FULFILLED', 'FULFILLED', 'CANCELLED', 'EXPIRED', 'REJECTED'].map(status => <option key={status}>{status}</option>)}
                      </Select>
                    </label>
                    <span className="filter-count">{filteredRequests.length} visible request{filteredRequests.length === 1 ? '' : 's'}</span>
                  </div>
                  {loading ? <LoadingRows /> : filteredRequests.length === 0 ? (
                    <EmptyState icon={HeartPulse} title="No requests in this view" description="Change the status filter or refresh the queue." />
                  ) : (
                    <div className="admin-record-list">
                      {filteredRequests.map(request => (
                        <article key={request.id} className="admin-record">
                          <div className="blood-mark">{request.blood_group}</div>
                          <div className="record-primary record-primary-grow">
                            <div>
                              <div className="record-title-row">
                                <h3>{request.hospital_name || 'Hospital not supplied'}</h3>
                                <StatusBadge value={request.deleted_at ? 'DELETED' : request.status} />
                              </div>
                              <p>{humanize(request.blood_component || 'WHOLE_BLOOD')} · {request.location?.area_name || 'Unknown district'} · Needed {formatDateTime(request.needed_by)}</p>
                              <div className="record-facts">
                                <span>{request.units_required || 1} unit{request.units_required === 1 ? '' : 's'}</span>
                                <span>Created {formatDateTime(request.created_at)}</span>
                                <span>Requester: {request.requester_name || request.user_id}</span>
                              </div>
                              {Array.isArray(request.comments) && request.comments.length > 0 && (
                                <details className="admin-comments">
                                  <summary><MessageSquare className="h-4 w-4" /> {request.comments.length} comment{request.comments.length === 1 ? '' : 's'}</summary>
                                  <div>
                                    {request.comments.map((comment: AdminRecord) => (
                                      <article key={comment.id} className="admin-comment-row">
                                        <div>
                                          <strong>{comment.deleted_at ? 'Deleted comment' : comment.user_name || 'Anonymous'}</strong>
                                          <time>{formatDateTime(comment.created_at)}</time>
                                          <p>{comment.deleted_at ? 'This comment is hidden and can be restored.' : comment.text}</p>
                                        </div>
                                        <div className="record-actions">
                                          {!comment.deleted_at && <button className="button button-secondary" onClick={() => setEditor({ kind: 'comment', record: comment, requestId: request.id })}>Edit</button>}
                                          <button
                                            className={`button ${comment.deleted_at ? 'button-secondary' : 'button-danger'}`}
                                            onClick={() => moderationAction(
                                              comment.deleted_at ? 'Restore comment?' : 'Delete comment?',
                                              comment.deleted_at ? 'Restore comment' : 'Delete comment',
                                              comment.deleted_at ? 'default' : 'danger',
                                              reason => api.moderateAdminComment(request.id, comment.id, { action: comment.deleted_at ? 'RESTORE' : 'DELETE', reason }),
                                              comment.deleted_at ? 'Comment restored.' : 'Comment deleted.'
                                            )}
                                          >{comment.deleted_at ? 'Restore' : 'Delete'}</button>
                                        </div>
                                      </article>
                                    ))}
                                  </div>
                                </details>
                              )}
                            </div>
                          </div>
                          <div className="record-actions">
                            {!request.deleted_at && <button className="button button-secondary" onClick={() => setEditor({ kind: 'request', record: request })}><Pencil className="h-3.5 w-3.5" /> Edit</button>}
                            {!request.deleted_at && request.status !== 'ACTIVE' && (
                              <ActionButton
                                label="Approve"
                                onClick={() => requestAction(request, 'ACTIVE')}
                                disabled={busy === request.id}
                              />
                            )}
                            {!request.deleted_at && !['REJECTED', 'FULFILLED', 'CANCELLED'].includes(request.status) && (
                              <ActionButton
                                label="Reject"
                                danger
                                onClick={() => requestAction(request, 'REJECTED')}
                                disabled={busy === request.id}
                              />
                            )}
                            <button
                              className={`button ${request.deleted_at ? 'button-secondary' : 'button-danger'}`}
                              onClick={() => moderationAction(
                                request.deleted_at ? 'Restore this blood request?' : 'Delete this blood request?',
                                request.deleted_at ? 'Restore request' : 'Delete request',
                                request.deleted_at ? 'default' : 'danger',
                                reason => api.moderateAdminRequest(request.id, { action: request.deleted_at ? 'RESTORE' : 'DELETE', reason }),
                                request.deleted_at ? 'Request restored.' : 'Request deleted.'
                              )}
                            >{request.deleted_at ? <><RotateCcw className="h-3.5 w-3.5" /> Restore</> : <><Trash2 className="h-3.5 w-3.5" /> Delete</>}</button>
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                </section>
              )}

              {activeTab === 'community' && (
                <section>
                  <PanelHeader
                    eyebrow="Public content"
                    title="Community moderation"
                    description="Inspect published donation stories and health suggestions, then hide unsafe content or restore reviewed posts with a recorded reason."
                  />
                  <div className="admin-filter-bar">
                    <label className="select-field">
                      <SlidersHorizontal className="h-4 w-4" />
                      <span className="sr-only">Filter community post status</span>
                      <Select
                        value={communityStatus}
                        onChange={event => setCommunityStatus(event.target.value as '' | 'PUBLISHED' | 'HIDDEN')}
                      >
                        <option value="">Published and hidden</option>
                        <option value="PUBLISHED">Published</option>
                        <option value="HIDDEN">Hidden</option>
                      </Select>
                    </label>
                    <span className="filter-count">{filteredCommunityPosts.length} visible post{filteredCommunityPosts.length === 1 ? '' : 's'}</span>
                  </div>
                  {loading ? <LoadingRows /> : filteredCommunityPosts.length === 0 ? (
                    <EmptyState icon={BookOpenText} title="No community posts in this view" description="Change the status filter or refresh the moderation queue." />
                  ) : (
                    <div className="admin-record-list">
                      {filteredCommunityPosts.map(post => (
                        <article key={post.id} className="admin-record">
                          <div className="record-icon"><BookOpenText className="h-5 w-5" /></div>
                          <div className="record-primary record-primary-grow">
                            <CommunityPostInspection post={post} />
                          </div>
                          <div className="record-actions">
                            {post.status === 'PUBLISHED' && post.slug && !isDeletedPost(post) && (
                              <a className="button button-secondary" href={`/community/${post.slug}`} target="_blank" rel="noreferrer">Open public page</a>
                            )}
                            {!isDeletedPost(post) && <button className="button button-secondary" onClick={() => setEditor({ kind: 'post', record: post })}><Pencil className="h-3.5 w-3.5" /> Edit</button>}
                            {!isDeletedPost(post) && <ActionButton
                              label={post.status === 'HIDDEN' ? 'Restore' : 'Hide'}
                              danger={post.status !== 'HIDDEN'}
                              disabled={busy === `community-${post.id}`}
                              onClick={() => communityAction(post, post.status === 'HIDDEN' ? 'PUBLISHED' : 'HIDDEN')}
                            />}
                            <button
                              className={`button ${isDeletedPost(post) ? 'button-secondary' : 'button-danger'}`}
                              onClick={() => moderationAction(
                                isDeletedPost(post) ? `Restore “${post.title}”?` : `Delete “${post.title}”?`,
                                isDeletedPost(post) ? 'Restore post' : 'Delete post',
                                isDeletedPost(post) ? 'default' : 'danger',
                                reason => api.mutateAdminCommunityPost(post.id, { action: isDeletedPost(post) ? 'RESTORE' : 'DELETE', reason }),
                                isDeletedPost(post) ? 'Community post restored.' : 'Community post deleted.'
                              )}
                            >{isDeletedPost(post) ? 'Restore' : 'Delete'}</button>
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                </section>
              )}

              {activeTab === 'reports' && overview && (
                <>
                <section className="mb-8">
                  <PanelHeader eyebrow="Contact reliability" title="Donor contact evidence" description="Distinct verified requester counts, abuse patterns, owner disputes, and search suspension controls. Reporter identities and notes stay inside this staff view." />
                  {Object.keys(contactReports.aggregations).length === 0 ? (
                    <EmptyState icon={ShieldCheck} title="No donor contact evidence" description="Recorded reveal outcomes and owner disputes will appear here." />
                  ) : (
                    <div className="admin-record-list">
                      {Object.entries(contactReports.aggregations).map(([donorRef, summary], caseIndex) => {
                        const related = contactReports.items.filter(item => item.donor_ref === donorRef);
                        const disputes = related.filter(item => item.kind === 'DISPUTE' && !related.some(resolution => resolution.kind === 'STAFF_RESOLUTION' && new Date(resolution.created_at).getTime() > new Date(item.created_at).getTime() && resolution.categories?.some((category: string) => item.categories?.includes(category))));
                        const reporters = new Set(related.filter(item => item.kind === 'CALL_OUTCOME').map(item => item.actor_id)).size;
                        const state = contactReports.states[donorRef] || { suspended: false };
                        const donorKind = humanize(related[0]?.donor_kind || (donorRef.startsWith('imp:') ? 'IMPORTED' : 'REGISTERED'));
                        return <article key={donorRef} className="admin-record">
                          <div className="record-icon record-icon-amber"><ShieldAlert className="h-5 w-5" /></div>
                          <div className="record-primary record-primary-grow"><div><div className="record-title-row"><h3>Contact case {caseIndex + 1}: {donorKind} donor</h3><StatusBadge value={state.suspended ? 'SUSPENDED' : 'ACTIVE'} /></div><p>{reporters} distinct reporter{reporters === 1 ? '' : 's'} · {related.length} append-only evidence record{related.length === 1 ? '' : 's'}</p><div className="mt-2 flex flex-wrap gap-2">{Object.entries(summary).filter(([, count]) => count > 0).map(([category, count]) => <span key={category} className="admin-badge">{count} {humanize(category)}</span>)}</div><details className="technical-reference"><summary>Exact donor reference</summary><code>{donorRef}</code></details>{disputes.map(dispute => <div key={dispute.id} className="record-note"><strong>Owner dispute:</strong> {dispute.note}<div className="mt-2"><ActionButton label="Resolve dispute" disabled={busy === `contact-${donorRef}-RESOLVE_DISPUTE`} onClick={() => contactReportAction(donorRef, 'RESOLVE_DISPUTE', dispute.id)} /></div></div>)}</div></div>
                          <div className="record-actions">{state.suspended ? <ActionButton label="Restore donor" disabled={busy === `contact-${donorRef}-RESTORE`} onClick={() => contactReportAction(donorRef, 'RESTORE')} /> : <ActionButton label="Suppress donor" danger disabled={busy === `contact-${donorRef}-SUSPEND`} onClick={() => contactReportAction(donorRef, 'SUSPEND')} />}</div>
                        </article>;
                      })}
                    </div>
                  )}
                </section>
                <QueuePanel
                  title="Safety reports"
                  eyebrow="Trust and safety"
                  description="Triage reported requests, comments, accounts, and community posts. Resolution notes become part of the audit record."
                  records={overview.reports || []}
                  emptyTitle="No reports in the queue"
                  renderRecord={report => {
                    const reportedPost = report.target_type === 'POST' ? communityById.get(report.target_id) : undefined;
                    const primaryLabel = reportedPost?.title || `${humanize(report.target_type)} report: ${humanize(report.reason)}`;
                    return (
                      <article key={report.id} className="admin-record">
                        <div className="record-icon record-icon-amber"><AlertTriangle className="h-5 w-5" /></div>
                        <div className="record-primary record-primary-grow">
                          <div>
                            <div className="record-title-row"><h3>{primaryLabel}</h3><StatusBadge value={report.status} /></div>
                            <p>{humanize(report.reason)} · {humanize(report.target_type)}</p>
                            <details className="technical-reference"><summary>Exact target reference</summary><code>{report.target_id}</code></details>
                            <p className="record-note">{report.details || 'No additional details were supplied.'}</p>
                            {reportedPost ? (
                              <CommunityPostInspection post={reportedPost} nested />
                            ) : report.target_type === 'POST' ? (
                              <p className="record-note">The reported post is not in the current published or hidden moderation window. Refresh the queue or inspect its audit history before resolving the report.</p>
                            ) : null}
                          </div>
                        </div>
                        <div className="record-actions">
                          {reportedPost?.status === 'PUBLISHED' && reportedPost.slug && (
                            <a className="button button-secondary" href={`/community/${reportedPost.slug}`} target="_blank" rel="noreferrer">Inspect post</a>
                          )}
                          {reportedPost && ['PUBLISHED', 'HIDDEN'].includes(reportedPost.status) && (
                            <ActionButton
                              label={reportedPost.status === 'HIDDEN' ? 'Restore post' : 'Hide post'}
                              danger={reportedPost.status !== 'HIDDEN'}
                              disabled={busy === `community-${reportedPost.id}`}
                              onClick={() => communityAction(reportedPost, reportedPost.status === 'HIDDEN' ? 'PUBLISHED' : 'HIDDEN')}
                            />
                          )}
                          {report.status === 'OPEN' && <ActionButton label="Start review" onClick={() => void run(report.id, () => api.updateReport(report.id, 'REVIEWING'), 'Report assigned for review.')} disabled={busy === report.id} />}
                          {!['RESOLVED', 'DISMISSED'].includes(report.status) && (
                            <>
                              <ActionButton label="Resolve" onClick={() => reportAction(report, 'RESOLVED')} disabled={busy === report.id} />
                              <ActionButton label="Dismiss" danger onClick={() => reportAction(report, 'DISMISSED')} disabled={busy === report.id} />
                            </>
                          )}
                        </div>
                      </article>
                    );
                  }}
                />
                </>
              )}

              {activeTab === 'support' && overview && (
                <QueuePanel
                  title="Support inbox"
                  eyebrow="Member care"
                  description="Review account, safety, privacy, and partnership messages without exposing them to lower-privilege roles."
                  records={overview.tickets || []}
                  emptyTitle="The support inbox is clear"
                  renderRecord={ticket => (
                    <article key={ticket.id} className="admin-record">
                      <div className="record-icon"><ClipboardList className="h-5 w-5" /></div>
                      <div className="record-primary record-primary-grow">
                        <div>
                          <div className="record-title-row"><h3>{ticket.name}</h3><StatusBadge value={ticket.status} /><StatusBadge value={ticket.category} tone="purple" /></div>
                          <p>{ticket.email || ticket.phone || 'No reply channel'} · Received {formatDateTime(ticket.created_at)}</p>
                          <p className="record-note">{ticket.message}</p>
                        </div>
                      </div>
                      <div className="record-actions">
                        {ticket.status === 'OPEN' && <ActionButton label="Assign to me" onClick={() => void run(ticket.id, () => api.updateTicket(ticket.id, 'IN_PROGRESS'), 'Ticket assigned.')} disabled={busy === ticket.id} />}
                        {ticket.status !== 'CLOSED' && <ActionButton label="Close" onClick={() => void run(ticket.id, () => api.updateTicket(ticket.id, 'CLOSED'), 'Ticket closed.')} disabled={busy === ticket.id} />}
                      </div>
                    </article>
                  )}
                />
              )}

              {activeTab === 'organizations' && (
                <section>
                  <PanelHeader
                    eyebrow="Partner network"
                    title="Organization review"
                    description="Verify hospitals, blood banks, and NGOs only after reviewing their supplied reference and contact details."
                  />
                  {loading ? <LoadingRows /> : organizations.length === 0 ? (
                    <EmptyState icon={Building2} title="No organization applications" description="New applications will appear here for review." />
                  ) : (
                    <div className="admin-record-list">
                      {organizations.map(org => (
                        <article key={org.id} className="admin-record">
                          <div className="record-icon"><Building2 className="h-5 w-5" /></div>
                          <div className="record-primary record-primary-grow">
                            <div>
                              <div className="record-title-row"><h3>{org.name}</h3><StatusBadge value={org.status} /><StatusBadge value={org.type} tone="purple" /></div>
                              <p>{org.district} · {org.phone} · Ref {org.registration_reference}</p>
                              <p className="record-note">{org.address}</p>
                            </div>
                          </div>
                          <div className="record-actions">
                            {org.status !== 'VERIFIED' && <ActionButton label="Verify" onClick={() => organizationAction(org, 'VERIFIED')} disabled={busy === org.id} />}
                            {org.status !== 'REJECTED' && <ActionButton label="Reject" danger onClick={() => organizationAction(org, 'REJECTED')} disabled={busy === org.id} />}
                            {org.status === 'VERIFIED' && <ActionButton label="Suspend" danger onClick={() => organizationAction(org, 'SUSPENDED')} disabled={busy === org.id} />}
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                </section>
              )}

              {activeTab === 'claims' && (
                <section>
                  <PanelHeader
                    eyebrow="Identity review"
                    title="Imported profile claims"
                    description="Compare the public source listing with the verified claimant before assigning an imported record."
                  />
                  {loading ? <LoadingRows /> : claims.length === 0 ? (
                    <EmptyState icon={UserCheck} title="No claims awaiting review" description="Claims that cannot be matched by phone will appear here." />
                  ) : (
                    <div className="admin-record-list">
                      {claims.map(claim => (
                        <article key={claim.id} className="admin-record admin-record-stacked">
                          <div className="claim-compare">
                            <div>
                              <span className="compare-label">Source listing</span>
                              <strong>{claim.name}</strong>
                              <p>{claim.blood_group || 'Missing group'} · {claim.district || 'Missing district'} · {claim.phone_masked || 'No published number'}</p>
                              <small>{claim.source?.organization}</small>
                            </div>
                            <div>
                              <span className="compare-label">Verified claimant</span>
                              <strong>{claim.claimant?.name || 'Account unavailable'}</strong>
                              <p>{claim.claimant?.phone || 'No account phone'}</p>
                              <small>{claim.claim_note || 'Manual review required'}</small>
                            </div>
                          </div>
                          <div className="record-actions">
                            <ActionButton label="Approve claim" onClick={() => claimAction(claim, true)} disabled={busy === claim.id} />
                            <ActionButton label="Decline" danger onClick={() => claimAction(claim, false)} disabled={busy === claim.id} />
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                </section>
              )}

              {activeTab === 'audit' && (
                <section>
                  <PanelHeader
                    eyebrow="Accountability"
                    title="Human-readable activity"
                    description="Review member, guest, authentication, OTP, SMS, and staff activity without exposing technical application logs or secrets."
                  />
                  <div className="admin-filter-bar">
                    <label className="search-field">
                      <Search className="h-4 w-4" />
                      <span className="sr-only">Filter audit log</span>
                      <input value={auditSearch} onChange={event => setAuditSearch(event.target.value)} placeholder="Filter audit events" />
                    </label>
                    {auditUserFilter && (
                      <button className="audit-user-filter" onClick={() => {
                        const next = new URLSearchParams(searchParams);
                        next.delete('user');
                        setSearchParams(next);
                      }} title="Clear member filter">
                        Member activity <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <span className="filter-count">{filteredAudit.length} event{filteredAudit.length === 1 ? '' : 's'}</span>
                  </div>
                  {loading ? <LoadingRows /> : filteredAudit.length === 0 ? (
                    <EmptyState icon={LockKeyhole} title="No matching audit events" description="Try another actor, action, or target." />
                  ) : (
                    <div className="audit-list">
                      {filteredAudit.map(event => (
                        <article key={event.id} className="audit-event">
                          <span className="audit-dot" aria-hidden="true" />
                          <div>
                            <div className="record-title-row"><h3>{event.summary || humanize(event.action)}</h3><StatusBadge value={event.category || event.target_type} tone="purple" /></div>
                            <p><strong>{event.actor_summary?.label || 'Account no longer available'}</strong> ({event.actor_summary?.type || 'Account'}) · <strong>{event.target_summary?.label || 'Record no longer available'}</strong> ({event.target_summary?.type || humanize(event.target_type)})</p>
                            <time>{formatDateTime(event.created_at)}</time>
                            {event.reversible && event.undo_endpoint && (
                              <div className="mt-3">
                                <button
                                  className="button button-secondary"
                                  disabled={undoneAuditEventIds.has(event.id)}
                                  onClick={() => moderationAction(
                                    'Undo this activity?',
                                    'Undo activity',
                                    'default',
                                    reason => api.undoAuditEvent(event.id, reason),
                                    'Activity undone.'
                                  )}
                                ><RotateCcw className="h-3.5 w-3.5" /> {undoneAuditEventIds.has(event.id) ? 'Undone' : 'Undo'}</button>
                              </div>
                            )}
                            <details className="technical-reference"><summary>Exact audit identifiers</summary><code>Actor: {event.actor_id}</code><code>Target: {event.target_id}</code></details>
                            {event.metadata && <details><summary>View change metadata</summary><pre>{JSON.stringify(event.metadata, null, 2)}</pre></details>}
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                </section>
              )}

              {activeTab === 'messavo' && (
                <section>
                  <PanelHeader
                    eyebrow="Delivery resilience"
                    title="Messavo SMS priority"
                    description="Keep multiple SMS connections in ranked order. Delivery starts with priority one and falls back only when that provider cannot send."
                  />
                  <div className="admin-section-actions">
                    <div className="admin-guidance">
                      <Smartphone className="h-6 w-6" />
                      <div><strong>Tokens stay private</strong><p>Saved API tokens are never returned to this screen. Enter a new token only when creating or rotating a connection.</p></div>
                    </div>
                    <button className="button button-primary" onClick={() => setEditor({ kind: 'provider' })}><Plus className="h-4 w-4" /> Add provider</button>
                  </div>
                  {loading ? <LoadingRows /> : smsProviders.length === 0 ? (
                    <EmptyState icon={Smartphone} title="No SMS providers configured" description="Add the primary Messavo connection, then add fallbacks as needed." />
                  ) : (
                    <div className="provider-list">
                      {smsProviders.map((provider, index) => (
                        <article key={provider.id} className={`provider-row ${provider.deleted_at || !provider.enabled ? 'is-muted' : ''}`}>
                          <div className="provider-priority" aria-label={`Priority ${index + 1}`}>{index + 1}</div>
                          <div className="provider-copy">
                            <div className="record-title-row">
                              <h3>{provider.name}</h3>
                              <StatusBadge value={provider.deleted_at ? 'DELETED' : provider.enabled ? 'ENABLED' : 'DISABLED'} />
                              {provider.has_api_token && <span className="verified-label"><LockKeyhole className="h-3.5 w-3.5" /> Token saved</span>}
                            </div>
                            <p>{provider.base_url} · Updated {formatDateTime(provider.updated_at)}</p>
                          </div>
                          <div className="provider-order-actions" aria-label={`Change priority for ${provider.name}`}>
                            <button className="icon-button" disabled={index === 0 || Boolean(provider.deleted_at)} onClick={() => void moveProvider(index, -1)} aria-label="Move up"><ChevronUp className="h-4 w-4" /></button>
                            <button className="icon-button" disabled={index === smsProviders.length - 1 || Boolean(provider.deleted_at)} onClick={() => void moveProvider(index, 1)} aria-label="Move down"><ChevronDown className="h-4 w-4" /></button>
                          </div>
                          <div className="record-actions">
                            {!provider.deleted_at && <button className="button button-secondary" onClick={() => setEditor({ kind: 'provider', record: provider })}>Edit</button>}
                            {!provider.deleted_at && <button className="button button-secondary" onClick={() => moderationAction(
                              provider.enabled ? `Disable ${provider.name}?` : `Enable ${provider.name}?`,
                              provider.enabled ? 'Disable provider' : 'Enable provider',
                              'default',
                              reason => api.updateAdminSmsProvider(provider.id, { enabled: !provider.enabled, reason }),
                              `Provider ${provider.enabled ? 'disabled' : 'enabled'}.`
                            )}>{provider.enabled ? 'Disable' : 'Enable'}</button>}
                            <button className={`button ${provider.deleted_at ? 'button-secondary' : 'button-danger'}`} onClick={() => moderationAction(
                              provider.deleted_at ? `Restore ${provider.name}?` : `Delete ${provider.name}?`,
                              provider.deleted_at ? 'Restore provider' : 'Delete provider',
                              provider.deleted_at ? 'default' : 'danger',
                              reason => provider.deleted_at ? api.restoreAdminSmsProvider(provider.id, reason) : api.deleteAdminSmsProvider(provider.id, reason),
                              provider.deleted_at ? 'Provider restored.' : 'Provider deleted.'
                            )}>{provider.deleted_at ? 'Restore' : 'Delete'}</button>
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                </section>
              )}

              {activeTab === 'system' && overview && (
                <section>
                  <PanelHeader
                    eyebrow="Read-only operations"
                    title="System status"
                    description="Safe runtime and policy information. Secrets, password hashes, OTPs, and session tokens are never shown."
                  />
                  <div className="admin-guidance mb-5 border-amber-200 bg-amber-50">
                    <ShieldAlert className="h-6 w-6 text-amber-700" />
                    <div className="flex-1">
                      <strong>OTP bypass status</strong>
                      <p>
                        {overview.system?.otp_bypass_enabled
                          ? 'Active: phone ownership checks are bypassed across registration, sign-in, recovery, phone changes, and listing removal.'
                          : 'Off: all phone-protected actions require the configured OTP channel.'}
                      </p>
                    </div>
                  </div>
                  <div className="system-grid">
                    {Object.entries(overview.system || {}).map(([key, value]) => (
                      <div key={key} className="system-card">
                        {key.includes('database') || key.includes('storage') ? <Database className="h-5 w-5" /> : <Server className="h-5 w-5" />}
                        <span>{humanize(key)}</span>
                        <strong>{formatSystemValue(value)}</strong>
                      </div>
                    ))}
                  </div>
                  {Object.keys(overview.system || {}).length === 0 && (
                    <EmptyState icon={Server} title="No system summary returned" description="The API is healthy, but this deployment has not exposed the safe system summary yet." />
                  )}
                  {can('MANAGE_SYSTEM') && (
                    <div className="admin-controlled-action">
                      <div>
                        <span>Controlled action</span>
                        <strong>Change OTP bypass test mode</strong>
                        <p>The existing confirmation dialog and required reason will be recorded in the audit trail before this setting changes.</p>
                      </div>
                      <button
                        type="button"
                        className={`button ${overview.system?.otp_bypass_enabled ? 'button-secondary' : 'button-danger'}`}
                        disabled={busy === 'otp-bypass'}
                        onClick={() => {
                          const enabled = !Boolean(overview.system?.otp_bypass_enabled);
                          openAction({
                            title: enabled ? 'Enable OTP bypass test mode?' : 'Disable OTP bypass test mode?',
                            description: enabled
                              ? 'Anyone can act as any Bangladesh phone number while this is active. Use it only for controlled testing.'
                              : 'Phone-protected activities will immediately require the configured OTP channel again.',
                            confirmLabel: enabled ? 'Enable test mode' : 'Disable test mode',
                            tone: enabled ? 'danger' : 'default',
                            reasonLabel: 'Reason for this change',
                            reasonRequired: true,
                            onConfirm: reason => run('otp-bypass', async () => {
                              const result = await api.updateOtpBypass(enabled, reason);
                              onOtpBypassChange(Boolean(result.otp_bypass_enabled));
                            }, `OTP bypass mode ${enabled ? 'enabled' : 'disabled'}.`)
                          });
                        }}
                      >
                        {overview.system?.otp_bypass_enabled ? 'Disable bypass' : 'Enable bypass'}
                      </button>
                    </div>
                  )}
                  <div className="admin-guidance">
                    <ShieldCheck className="h-6 w-6" />
                    <div><strong>Operational safety</strong><p>Use health, readiness, and deployment monitoring for diagnosis. This panel intentionally never exposes credentials or raw authentication material.</p></div>
                  </div>
                </section>
              )}
            </>
          )}
        </main>
      </div>

      {dialog && (
        <ActionDialog
          state={dialog}
          busy={Boolean(busy)}
          onClose={() => setDialog(null)}
          onDone={() => setDialog(null)}
        />
      )}
      {editor && (
        <AdminEditorDialog
          state={editor}
          busy={busy === 'editor'}
          onClose={() => setEditor(null)}
          onSave={saveEditor}
        />
      )}
    </div>
  );

  function moderationAction(
    title: string,
    confirmLabel: string,
    tone: 'default' | 'danger',
    action: (reason: string) => Promise<unknown>,
    successMessage: string
  ) {
    openAction({
      title,
      description: 'Add a short reason. The change and the acting administrator will be kept in the activity log.',
      confirmLabel,
      tone,
      reasonLabel: 'Reason for this change',
      reasonRequired: true,
      onConfirm: reason => run(`moderation-${title}`, () => action(reason), successMessage)
    });
  }

  function requestAction(request: AdminRecord, status: 'ACTIVE' | 'REJECTED') {
    openAction({
      title: status === 'ACTIVE' ? 'Approve this blood request?' : 'Reject this blood request?',
      description: `${request.blood_group} at ${request.hospital_name || request.location?.area_name}. The requester will be notified of this decision.`,
      confirmLabel: status === 'ACTIVE' ? 'Approve request' : 'Reject request',
      tone: status === 'ACTIVE' ? 'default' : 'danger',
      reasonLabel: 'Moderation note',
      reasonRequired: true,
      onConfirm: reason => run(request.id, () => api.moderateRequest(request.id, status, reason), `Request ${status === 'ACTIVE' ? 'approved' : 'rejected'}.`)
    });
  }

  function communityAction(post: AdminCommunityPost, status: 'HIDDEN' | 'PUBLISHED') {
    const hiding = status === 'HIDDEN';
    openAction({
      title: hiding ? `Hide “${post.title}”?` : `Restore “${post.title}”?`,
      description: hiding
        ? 'The public page will stop resolving and the author will receive the moderation reason.'
        : 'The existing public address will become available again and the author will receive the review reason.',
      confirmLabel: hiding ? 'Hide post' : 'Restore post',
      tone: hiding ? 'danger' : 'default',
      reasonLabel: hiding ? 'Reason for hiding' : 'Reason for restoring',
      reasonRequired: true,
      onConfirm: reason => run(
        `community-${post.id}`,
        () => api.moderateAdminCommunityPost(post.id, status, reason),
        hiding ? 'Community post hidden.' : 'Community post restored.'
      )
    });
  }

  function reportAction(report: AdminRecord, status: 'RESOLVED' | 'DISMISSED') {
    openAction({
      title: status === 'RESOLVED' ? 'Resolve this report?' : 'Dismiss this report?',
      description: 'Add a concise reason so another operator can understand the decision later.',
      confirmLabel: status === 'RESOLVED' ? 'Resolve report' : 'Dismiss report',
      tone: status === 'RESOLVED' ? 'default' : 'danger',
      reasonLabel: 'Resolution note',
      reasonRequired: true,
      onConfirm: reason => run(report.id, () => api.updateReport(report.id, status, reason), 'Report updated.')
    });
  }

  function organizationAction(org: AdminRecord, status: 'VERIFIED' | 'REJECTED' | 'SUSPENDED') {
    openAction({
      title: `${humanize(status)} ${org.name}?`,
      description: 'This changes how the organization and its public campaigns appear across the network.',
      confirmLabel: status === 'VERIFIED' ? 'Verify organization' : status === 'REJECTED' ? 'Reject application' : 'Suspend organization',
      tone: status === 'VERIFIED' ? 'default' : 'danger',
      reasonLabel: 'Review note',
      reasonRequired: true,
      onConfirm: reason => run(org.id, () => api.reviewOrganization(org.id, status, reason), 'Organization review saved.')
    });
  }

  function claimAction(claim: AdminRecord, approve: boolean) {
    openAction({
      title: approve ? `Approve ${claim.claimant?.name || 'this claimant'}?` : 'Decline this profile claim?',
      description: approve
        ? 'The imported listing will become the claimant’s donor profile, starting unavailable until they opt in.'
        : 'The listing will be released for another legitimate owner to claim.',
      confirmLabel: approve ? 'Approve claim' : 'Decline claim',
      tone: approve ? 'default' : 'danger',
      reasonLabel: 'Review note',
      reasonRequired: true,
      onConfirm: reason => run(claim.id, () => api.reviewDirectoryClaim(claim.id, approve, reason), approve ? 'Claim approved.' : 'Claim declined.')
    });
  }
}

function CommunityPostInspection({ post, nested = false }: { post: AdminCommunityPost; nested?: boolean }) {
  return (
    <div className={nested ? 'mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4' : ''}>
      <div className="record-title-row">
        <h3>{post.title}</h3>
        <StatusBadge value={post.status} />
        <StatusBadge value={post.type} tone="purple" />
      </div>
      <p>By {post.author.name} · Updated {formatDateTime(post.updated_at)}</p>
      <p className="record-note">{post.excerpt}</p>
      {post.image && (
        <figure className="mt-3 flex min-w-0 flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3 sm:flex-row sm:items-center">
          <img
            src={post.image.url}
            alt={post.image.alt}
            width={post.image.width}
            height={post.image.height}
            loading="lazy"
            className="h-24 w-full rounded-lg object-cover sm:w-36"
          />
          <figcaption className="min-w-0 break-words text-xs leading-5 text-slate-600">Image description: {post.image.alt}</figcaption>
        </figure>
      )}
      <details className="mt-3 rounded-xl border border-slate-200 bg-white p-3">
        <summary className="cursor-pointer text-sm font-extrabold text-slate-800">Inspect full Markdown content</summary>
        <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap break-words font-sans text-xs leading-6 text-slate-700">{post.body_markdown}</pre>
      </details>
      {post.status === 'HIDDEN' && post.moderation_reason && (
        <p className="record-note">Current moderation reason: {post.moderation_reason}</p>
      )}
    </div>
  );
}

function OverviewPanel({ overview, can, onNavigate }: {
  overview: Overview;
  can: (capability: Capability) => boolean;
  onNavigate: (tab: TabId) => void;
}) {
  const priorityCounts = ['active_requests', 'available_donors', 'open_reports', 'open_tickets', 'pending_organizations', 'pending_directory_claims'];
  const countEntries = Object.entries(overview.counts || {});
  const orderedCounts = [
    ...priorityCounts.flatMap(key => key in overview.counts ? [[key, overview.counts[key]] as [string, number]] : []),
    ...countEntries.filter(([key]) => !priorityCounts.includes(key))
  ].slice(0, 12);

  const queues = [
    { label: 'Request review', value: overview.counts.active_requests || 0, icon: HeartPulse, tab: 'requests' as TabId, capability: 'MODERATE_CONTENT' as Capability },
    { label: 'Safety reports', value: overview.counts.open_reports || 0, icon: ShieldAlert, tab: 'reports' as TabId, capability: 'MODERATE_CONTENT' as Capability },
    { label: 'Support tickets', value: overview.counts.open_tickets || 0, icon: ClipboardList, tab: 'support' as TabId, capability: 'MANAGE_SUPPORT' as Capability },
    { label: 'Partner reviews', value: overview.counts.pending_organizations || 0, icon: Building2, tab: 'organizations' as TabId, capability: 'MANAGE_ORGANIZATIONS' as Capability }
  ].filter(queue => can(queue.capability));

  return (
    <section>
      <PanelHeader
        eyebrow="Network command center"
        title="Today’s operational picture"
        description="Live workload, trust signals, and safe system context for the areas your role is allowed to manage."
      />
      <div className="metric-grid">
        {orderedCounts.map(([key, value], index) => (
          <div key={key}>
            <MetricCard label={countLabels[key] || humanize(key)} value={value} featured={index < 4} />
          </div>
        ))}
      </div>
      <div className="overview-grid">
        <div className="admin-panel">
          <div className="panel-title-row"><div><span className="eyebrow">Queues</span><h2>Needs attention</h2></div><Activity className="h-5 w-5" /></div>
          <div className="queue-links">
            {queues.map(queue => {
              const Icon = queue.icon;
              return (
                <button key={queue.tab} onClick={() => onNavigate(queue.tab)}>
                  <span className="record-icon"><Icon className="h-5 w-5" /></span>
                  <span><strong>{queue.label}</strong><small>{queue.value === 0 ? 'Queue is clear' : `${queue.value} item${queue.value === 1 ? '' : 's'} waiting`}</small></span>
                  <span className={`queue-count ${queue.value > 0 ? 'has-work' : ''}`}>{queue.value}</span>
                </button>
              );
            })}
          </div>
        </div>
        <div className="admin-panel">
          <div className="panel-title-row"><div><span className="eyebrow">Access</span><h2>Your capabilities</h2></div><ShieldCheck className="h-5 w-5" /></div>
          <div className="capability-list">
            {(overview.viewer?.capabilities || []).map(capability => <span key={capability}><CheckCircle2 className="h-3.5 w-3.5" />{humanize(capability)}</span>)}
          </div>
          <p className="panel-footnote">Your staff role determines your access. A superadmin can update these permissions.</p>
        </div>
      </div>
    </section>
  );
}

function PanelHeader({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return (
    <header className="panel-header">
      <span className="eyebrow">{eyebrow}</span>
      <h2>{title}</h2>
      <p>{description}</p>
    </header>
  );
}

function MetricCard({ label, value, featured }: { label: string; value: number; featured?: boolean }) {
  return (
    <div className={`metric-card ${featured ? 'metric-card-featured' : ''}`}>
      <span>{label}</span>
      <strong>{new Intl.NumberFormat().format(value)}</strong>
      <small>{value === 0 ? 'No current items' : 'Current total'}</small>
    </div>
  );
}

function QueuePanel({ title, eyebrow, description, records, emptyTitle, renderRecord }: {
  title: string;
  eyebrow: string;
  description: string;
  records: AdminRecord[];
  emptyTitle: string;
  renderRecord: (record: AdminRecord) => ReactNode;
}) {
  return (
    <section>
      <PanelHeader eyebrow={eyebrow} title={title} description={description} />
      {records.length === 0
        ? <EmptyState icon={CheckCircle2} title={emptyTitle} description="There is nothing waiting for action right now." />
        : <div className="admin-record-list">{records.map(renderRecord)}</div>}
    </section>
  );
}

function StatusBadge({ value, tone }: { value: string; tone?: 'purple' }) {
  const normalized = String(value || 'UNKNOWN').toUpperCase();
  const semantic = tone || (
    ['ACTIVE', 'VERIFIED', 'RESOLVED', 'FULFILLED', 'CLAIMED'].includes(normalized) ? 'positive'
      : ['SUSPENDED', 'REJECTED', 'CANCELLED', 'DISMISSED'].includes(normalized) ? 'negative'
        : ['OPEN', 'PENDING', 'PENDING_REVIEW', 'REVIEWING', 'IN_PROGRESS'].includes(normalized) ? 'warning'
          : 'neutral'
  );
  return <span className={`status-badge status-${semantic}`}>{humanize(normalized)}</span>;
}

function ActionButton({ label, onClick, disabled, danger }: { label: string; onClick: () => void; disabled?: boolean; danger?: boolean }) {
  return <button onClick={onClick} disabled={disabled} className={`button ${danger ? 'button-danger' : 'button-secondary'}`}>{label}</button>;
}

function StaffRoleControl({ value, disabled, onChange }: { value: string; disabled?: boolean; onChange: (value: string) => void }) {
  return (
    <label className="compact-select">
      <span className="sr-only">Staff role</span>
      <UserCog className="h-4 w-4" />
      <Select value={value} disabled={disabled} onChange={event => onChange(event.target.value)}>
        <option value="">Member only</option>
        <option value="MODERATOR">Moderator</option>
        <option value="ADMIN">Admin</option>
        <option value="SUPERADMIN">Superadmin</option>
      </Select>
    </label>
  );
}

function EmptyState({ icon: Icon, title, description }: { icon: typeof Users; title: string; description: string }) {
  return (
    <div className="admin-empty">
      <span><Icon className="h-6 w-6" /></span>
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="admin-empty" role="status">
      <span><RefreshCw className="h-6 w-6 animate-spin" /></span>
      <h3>Loading administration data</h3>
      <p>Checking your role and the latest operational queues.</p>
    </div>
  );
}

function LoadingRows() {
  return (
    <div className="admin-record-list" aria-label="Loading records">
      {[0, 1, 2].map(item => <div key={item} className="admin-record admin-skeleton"><span /><div><i /><i /></div></div>)}
    </div>
  );
}

function AdminEditorDialog({ state, busy, onClose, onSave }: {
  state: EditorState;
  busy: boolean;
  onClose: () => void;
  onSave: (values: Record<string, unknown>) => Promise<void>;
}) {
  const source = (state.record || {}) as AdminRecord;
  const [name, setName] = useState(String(source.name || ''));
  const [phone, setPhone] = useState(String(source.phone || ''));
  const [verified, setVerified] = useState(Boolean(source.is_verified));
  const [accountStatus, setAccountStatus] = useState(String(source.account_status || 'ACTIVE'));
  const donor = (source.donor_profile || {}) as AdminRecord;
  const [memberBloodGroup, setMemberBloodGroup] = useState(String(donor.blood_group || ''));
  const [district, setDistrict] = useState(String(donor.district || donor.location?.area_name || ''));
  const [upazila, setUpazila] = useState(String(donor.upazila || ''));
  const [availabilityStatus, setAvailabilityStatus] = useState(String(donor.availability_status || 'NOT_AVAILABLE'));
  const [availabilityReason, setAvailabilityReason] = useState(String(donor.availability_reason || ''));
  const [age, setAge] = useState(String(donor.age || ''));
  const [weightKg, setWeightKg] = useState(String(donor.weight_kg || ''));
  const [medicalConditions, setMedicalConditions] = useState(String(donor.medical_conditions || ''));
  const [hospitalName, setHospitalName] = useState(String(source.hospital_name || ''));
  const [bloodGroup, setBloodGroup] = useState(String(source.blood_group || ''));
  const [editRequestStatus, setEditRequestStatus] = useState(String(source.status || 'ACTIVE'));
  const [bloodComponent, setBloodComponent] = useState(String(source.blood_component || 'WHOLE_BLOOD'));
  const [unitsRequired, setUnitsRequired] = useState(String(source.units_required || 1));
  const [hospitalAddress, setHospitalAddress] = useState(String(source.hospital_address || ''));
  const [ward, setWard] = useState(String(source.ward || ''));
  const [requestReasonDetails, setRequestReasonDetails] = useState(String(source.request_reason_details || ''));
  const [title, setTitle] = useState(String(source.title || ''));
  const [excerpt, setExcerpt] = useState(String(source.excerpt || ''));
  const [body, setBody] = useState(String(source.body_markdown || source.text || ''));
  const [baseUrl, setBaseUrl] = useState(String(source.base_url || ''));
  const [apiToken, setApiToken] = useState('');
  const [enabled, setEnabled] = useState(source.enabled === undefined ? true : Boolean(source.enabled));
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  const heading = state.kind === 'member' ? 'Edit member'
    : state.kind === 'request' ? 'Edit blood request'
      : state.kind === 'post' ? 'Edit community post'
        : state.kind === 'comment' ? 'Edit comment'
          : state.record ? 'Edit SMS provider' : 'Add SMS provider';

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (reason.trim().length < 3) {
      setError('Add a clear reason of at least 3 characters.');
      return;
    }
    let values: Record<string, unknown>;
    if (state.kind === 'member') {
      const donorProfile = memberBloodGroup ? {
        blood_group: memberBloodGroup,
        district: district.trim(),
        upazila: upazila.trim(),
        availability_status: availabilityStatus,
        availability_reason: availabilityReason.trim(),
        ...(age ? { age: Number(age) } : {}),
        ...(weightKg ? { weight_kg: Number(weightKg) } : {}),
        medical_conditions: medicalConditions.trim()
      } : undefined;
      values = { name: name.trim(), phone: phone.trim(), is_verified: verified, account_status: accountStatus, ...(donorProfile ? { donor_profile: donorProfile } : {}), reason: reason.trim() };
    } else if (state.kind === 'request') {
      values = {
        status: editRequestStatus,
        hospital_name: hospitalName.trim(), hospital_address: hospitalAddress.trim(), ward: ward.trim(),
        blood_group: bloodGroup, blood_component: bloodComponent, units_required: Number(unitsRequired),
        request_reason_details: requestReasonDetails.trim(), reason: reason.trim()
      };
    } else if (state.kind === 'post') {
      values = { title: title.trim(), excerpt: excerpt.trim(), body_markdown: body.trim(), reason: reason.trim() };
    } else if (state.kind === 'comment') {
      values = { text: body.trim(), reason: reason.trim() };
    } else {
      values = { name: name.trim(), base_url: baseUrl.trim(), enabled, ...(apiToken.trim() ? { api_token: apiToken.trim() } : {}), reason: reason.trim() };
    }
    setError('');
    try {
      await onSave(values);
    } catch (caught: any) {
      setError(caught.message || 'The update could not be saved.');
    }
  };

  return (
    <ModalPortal onClose={busy ? undefined : onClose}>
      <div className="dialog-backdrop" role="presentation" onMouseDown={event => event.target === event.currentTarget && !busy && onClose()}>
        <form className="action-dialog admin-editor-dialog" role="dialog" aria-modal="true" aria-labelledby="admin-editor-title" onSubmit={submit}>
          <button type="button" className="icon-button dialog-close" onClick={onClose} disabled={busy} aria-label="Close dialog"><X className="h-4 w-4" /></button>
          <span className="dialog-icon"><Pencil className="h-6 w-6" /></span>
          <h2 id="admin-editor-title">{heading}</h2>
          <p>Update only the fields that should change. A reason is required and will appear in the activity log.</p>

          <div className="admin-editor-fields">
            {state.kind === 'member' && <>
              <label><span>Name</span><input value={name} onChange={event => setName(event.target.value)} required maxLength={100} /></label>
              <label><span>Phone</span><input value={phone} onChange={event => setPhone(event.target.value)} required inputMode="tel" maxLength={20} /></label>
              <label><span>Account status</span><Select value={accountStatus} onChange={event => setAccountStatus(event.target.value)}><option value="ACTIVE">Active</option><option value="SUSPENDED">Suspended</option></Select></label>
              <label className="admin-check"><input type="checkbox" checked={verified} onChange={event => setVerified(event.target.checked)} /><span>Phone verified</span></label>
              <div className="admin-editor-subheading admin-field-wide"><strong>Donor profile</strong><span>Leave blood group blank if this member is not a donor.</span></div>
              <label><span>Blood group</span><Select value={memberBloodGroup} onChange={event => setMemberBloodGroup(event.target.value)}><option value="">No donor profile</option>{['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(group => <option key={group}>{group}</option>)}</Select></label>
              <label><span>Availability</span><Select value={availabilityStatus} disabled={!memberBloodGroup} onChange={event => setAvailabilityStatus(event.target.value)}>{['AVAILABLE', 'SICK', 'TRAVELING', 'NOT_AVAILABLE'].map(status => <option key={status} value={status}>{humanize(status)}</option>)}</Select></label>
              <label><span>District</span><input value={district} disabled={!memberBloodGroup} onChange={event => setDistrict(event.target.value)} required={Boolean(memberBloodGroup)} maxLength={100} /></label>
              <label><span>Upazila</span><input value={upazila} disabled={!memberBloodGroup} onChange={event => setUpazila(event.target.value)} maxLength={100} /></label>
              <label><span>Age</span><input type="number" min="16" max="70" value={age} disabled={!memberBloodGroup} onChange={event => setAge(event.target.value)} /></label>
              <label><span>Weight (kg)</span><input type="number" min="30" max="200" value={weightKg} disabled={!memberBloodGroup} onChange={event => setWeightKg(event.target.value)} /></label>
              <label className="admin-field-wide"><span>Availability note</span><input value={availabilityReason} disabled={!memberBloodGroup} onChange={event => setAvailabilityReason(event.target.value)} maxLength={250} /></label>
              <label className="admin-field-wide"><span>Medical conditions</span><textarea value={medicalConditions} disabled={!memberBloodGroup} onChange={event => setMedicalConditions(event.target.value)} rows={3} maxLength={1000} /></label>
            </>}

            {state.kind === 'request' && <>
              <label className="admin-field-wide"><span>Hospital or collection facility</span><input value={hospitalName} onChange={event => setHospitalName(event.target.value)} required maxLength={160} /></label>
              <label className="admin-field-wide"><span>Hospital address</span><input value={hospitalAddress} onChange={event => setHospitalAddress(event.target.value)} maxLength={240} /></label>
              <label><span>Status</span><Select value={editRequestStatus} onChange={event => setEditRequestStatus(event.target.value)}>{['ACTIVE', 'REJECTED', 'CANCELLED', 'FULFILLED', 'EXPIRED'].map(status => <option key={status} value={status}>{humanize(status)}</option>)}</Select></label>
              <label><span>Blood group</span><Select value={bloodGroup} onChange={event => setBloodGroup(event.target.value)}>{['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(group => <option key={group}>{group}</option>)}</Select></label>
              <label><span>Blood component</span><Select value={bloodComponent} onChange={event => setBloodComponent(event.target.value)}>{['WHOLE_BLOOD', 'RED_CELLS', 'PLATELETS', 'PLASMA', 'NOT_SURE'].map(component => <option key={component} value={component}>{humanize(component)}</option>)}</Select></label>
              <label><span>Units required</span><input type="number" min="1" max="20" value={unitsRequired} onChange={event => setUnitsRequired(event.target.value)} required /></label>
              <label><span>Ward</span><input value={ward} onChange={event => setWard(event.target.value)} maxLength={100} /></label>
              <label className="admin-field-wide"><span>Request details</span><textarea value={requestReasonDetails} onChange={event => setRequestReasonDetails(event.target.value)} rows={3} maxLength={160} /></label>
            </>}

            {state.kind === 'post' && <>
              <label className="admin-field-wide"><span>Title</span><input value={title} onChange={event => setTitle(event.target.value)} required maxLength={160} /></label>
              <label className="admin-field-wide"><span>Summary</span><textarea value={excerpt} onChange={event => setExcerpt(event.target.value)} rows={2} maxLength={300} /></label>
              <label className="admin-field-wide"><span>Post content</span><textarea value={body} onChange={event => setBody(event.target.value)} rows={8} required /></label>
            </>}

            {state.kind === 'comment' && <label className="admin-field-wide"><span>Comment</span><textarea value={body} onChange={event => setBody(event.target.value)} rows={5} required maxLength={2000} /></label>}

            {state.kind === 'provider' && <>
              <label><span>Provider name</span><input value={name} onChange={event => setName(event.target.value)} required maxLength={100} placeholder="Primary Messavo" /></label>
              <label className="admin-field-wide"><span>API base URL</span><input value={baseUrl} onChange={event => setBaseUrl(event.target.value)} type="url" required placeholder="https://…" /></label>
              <label className="admin-field-wide"><span>{state.record?.has_api_token ? 'New API token (leave blank to keep current)' : 'API token'}</span><input value={apiToken} onChange={event => setApiToken(event.target.value)} type="password" required={!state.record?.has_api_token} autoComplete="new-password" /></label>
              <label className="admin-check"><input type="checkbox" checked={enabled} onChange={event => setEnabled(event.target.checked)} /><span>Enabled for delivery</span></label>
            </>}

            <label className="admin-field-wide"><span>Reason for this change *</span><textarea value={reason} onChange={event => setReason(event.target.value)} rows={3} maxLength={500} required placeholder="Explain what changed and why" /></label>
          </div>

          {error && <div role="alert" className="dialog-error">{error}</div>}
          <div className="dialog-actions">
            <button type="button" className="button button-secondary" onClick={onClose} disabled={busy}>Cancel</button>
            <button className="button button-primary" disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button>
          </div>
        </form>
      </div>
    </ModalPortal>
  );
}

function ActionDialog({ state, busy, onClose, onDone }: {
  state: DialogState;
  busy: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  const confirm = async () => {
    if (state.reasonRequired && reason.trim().length < 3) {
      setError('Add a clear reason of at least 3 characters.');
      return;
    }
    setError('');
    try {
      await state.onConfirm(reason.trim());
      onDone();
    } catch (caught: any) {
      setError(caught.message || 'The action failed.');
    }
  };

  return (
    <ModalPortal onClose={busy ? undefined : onClose}>
      <div className="dialog-backdrop" role="presentation" onMouseDown={event => event.target === event.currentTarget && !busy && onClose()}>
        <div className="action-dialog" role="dialog" aria-modal="true" aria-labelledby="action-dialog-title">
          <button className="icon-button dialog-close" onClick={onClose} disabled={busy} aria-label="Close dialog"><X className="h-4 w-4" /></button>
          <span className={`dialog-icon ${state.tone === 'danger' ? 'dialog-icon-danger' : ''}`}>
            {state.tone === 'danger' ? <XCircle className="h-6 w-6" /> : <CheckCircle2 className="h-6 w-6" />}
          </span>
          <h2 id="action-dialog-title">{state.title}</h2>
          <p>{state.description}</p>
          {state.reasonLabel && (
            <label className="dialog-field">
              <span>{state.reasonLabel}{state.reasonRequired ? ' *' : ''}</span>
              <textarea value={reason} onChange={event => setReason(event.target.value)} rows={4} maxLength={500} placeholder="Record the reason for this action" autoFocus />
            </label>
          )}
          {error && <div role="alert" className="dialog-error">{error}</div>}
          <div className="dialog-actions">
            <button className="button button-secondary" onClick={onClose} disabled={busy}>Cancel</button>
            <button className={`button ${state.tone === 'danger' ? 'button-danger' : 'button-primary'}`} onClick={() => void confirm()} disabled={busy}>
              {busy ? 'Saving…' : state.confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}

function initials(name: string) {
  return String(name || 'Staff').split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase();
}

function humanize(value: unknown) {
  return String(value || 'Unknown').toLowerCase().replaceAll('_', ' ').replace(/\b\w/g, letter => letter.toUpperCase());
}

function isDeletedPost(post: AdminCommunityPost) {
  return post.status === 'DELETED';
}

function formatDate(value: unknown) {
  if (!value) return 'Unknown';
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? 'Unknown' : date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatDateTime(value: unknown) {
  if (!value) return 'Not supplied';
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? 'Not supplied' : date.toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatSystemValue(value: unknown) {
  if (typeof value === 'boolean') return value ? 'Enabled' : 'Disabled';
  if (value === null || value === undefined || value === '') return 'Not configured';
  return String(value);
}

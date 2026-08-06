import { FormEvent, useEffect, useState } from 'react';
import { Building2, CalendarDays, MapPin, ShieldCheck, Users } from 'lucide-react';
import { api } from '../lib/api';
import { BD_LOCATION_NAMES } from '../lib/locations';
import { EmptyState, Notice, PageHeader, SectionHeading, StatusBadge, Surface } from '../components/ui';

export default function PartnersPage({ user }: { user: any }) {
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [form, setForm] = useState({ name: '', type: 'HOSPITAL', district: '', address: '', phone: '', website: '', registration_reference: '' });
  const [message, setMessage] = useState('');

  useEffect(() => {
    api.getOrganizations().then(setOrganizations).catch(() => setOrganizations([]));
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setMessage('');
    try {
      await api.applyOrganization(form);
      setMessage('Application submitted for operator verification.');
    } catch (error: any) {
      setMessage(error.message);
    }
  };

  return (
    <div className="space-y-8 pb-12">
      <PageHeader
        eyebrow="Verified partners"
        title="Hospitals, blood banks and NGOs"
        description="Find organizations reviewed by Drop operations and see their upcoming community campaigns in one place."
        icon={Building2}
        aside={(
          <Surface className="p-5">
            <ShieldCheck className="h-8 w-8 text-green-600" aria-hidden="true" />
            <p className="mt-4 text-sm font-extrabold text-slate-950">Operational verification</p>
            <p className="mt-1 text-sm leading-6 text-slate-600">Verification confirms that Drop reviewed the submitted organization reference. It is not a clinical endorsement.</p>
          </Surface>
        )}
      />

      <section>
        <SectionHeading
          eyebrow="Community network"
          title="Organizations on Drop"
          description="Verified points of contact and public blood donation campaigns."
        />
        {organizations.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No verified partners yet"
            description="Verified organizations will appear here once their references have been reviewed."
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {organizations.map(org => (
              <Surface as="article" key={org.id} className="overflow-hidden p-0">
                <div className="border-b border-slate-100 p-5 sm:p-6">
                  <div className="flex items-start justify-between gap-4">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-rose-50 text-primary">
                      <Building2 className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <StatusBadge tone="success" icon={ShieldCheck}>Verified {org.type.replace('_', ' ')}</StatusBadge>
                  </div>
                  <h3 className="mt-5 text-xl font-extrabold text-slate-950">{org.name}</h3>
                  <p className="mt-3 flex items-start gap-2 text-sm leading-6 text-slate-600">
                    <MapPin className="mt-1 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                    <span>{org.address}, {org.district}</span>
                  </p>
                  <p className="mt-2 text-sm font-bold text-slate-800">{org.phone}</p>
                </div>
                {org.campaigns?.length > 0 && (
                  <div className="space-y-3 bg-green-50/60 p-5 sm:p-6">
                    <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-green-800">Upcoming campaigns</p>
                    {org.campaigns.map((campaign: any) => (
                      <div key={campaign.id} className="rounded-2xl border border-green-100 bg-white p-4">
                        <p className="flex items-center gap-2 text-sm font-extrabold text-slate-950">
                          <CalendarDays className="h-4 w-4 text-green-600" aria-hidden="true" />
                          {campaign.title}
                        </p>
                        <p className="mt-1 text-xs leading-5 text-slate-600">{campaign.location} · {new Date(campaign.starts_at).toLocaleDateString()}</p>
                      </div>
                    ))}
                  </div>
                )}
              </Surface>
            ))}
          </div>
        )}
      </section>

      <Surface as="section" className="p-6 sm:p-8">
        <SectionHeading
          eyebrow="Join the network"
          title="Apply as an organization"
          description="Submit your legal and registration details for an operator review."
        />
        {!user ? (
          <Notice tone="neutral" icon={ShieldCheck}>Log in with a verified account to apply.</Notice>
        ) : (
          <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-sm font-bold text-slate-700">Legal organization name</span>
              <input required value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} className="input" />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-bold text-slate-700">Organization type</span>
              <select value={form.type} onChange={event => setForm({ ...form, type: event.target.value })} className="input">
                <option value="HOSPITAL">Hospital</option>
                <option value="BLOOD_BANK">Blood bank</option>
                <option value="NGO">NGO</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-bold text-slate-700">District</span>
              <select required value={form.district} onChange={event => setForm({ ...form, district: event.target.value })} className="input">
                <option value="">Select district</option>
                {BD_LOCATION_NAMES.map(name => <option key={name}>{name}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-bold text-slate-700">Official phone</span>
              <input required type="tel" value={form.phone} onChange={event => setForm({ ...form, phone: event.target.value })} className="input" />
            </label>
            <label className="block sm:col-span-2">
              <span className="mb-2 block text-sm font-bold text-slate-700">Full address</span>
              <input required value={form.address} onChange={event => setForm({ ...form, address: event.target.value })} className="input" />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-bold text-slate-700">Registration or license reference</span>
              <input required value={form.registration_reference} onChange={event => setForm({ ...form, registration_reference: event.target.value })} className="input" />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-bold text-slate-700">Website <span className="font-medium text-slate-400">(optional)</span></span>
              <input type="url" value={form.website} onChange={event => setForm({ ...form, website: event.target.value })} className="input" />
            </label>
            {message && <Notice tone={message.startsWith('Application') ? 'success' : 'danger'} className="sm:col-span-2">{message}</Notice>}
            <button className="primary-button sm:col-span-2">Submit for verification</button>
          </form>
        )}
      </Surface>
    </div>
  );
}

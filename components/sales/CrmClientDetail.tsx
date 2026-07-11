'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Building2,
  CalendarClock,
  FileSpreadsheet,
  FileText,
  Globe,
  Image as ImageIcon,
  Mail,
  MapPin,
  MessageSquarePlus,
  NotebookPen,
  Paperclip,
  Phone,
  PhoneCall,
  Pin,
  Plus,
  Send,
  Star,
  Users,
  Video,
} from 'lucide-react';
import { LogoPlaceholder } from '@/components/offer/LogoPlaceholder';
import { Chip, StatusPill } from '@/components/sales/ui';
import {
  formatCzk,
  type CrmClient,
  type CrmCommunication,
  type CrmFile,
} from '@/lib/mock-sales-data';

const tabs = [
  { key: 'overview', label: 'Přehled' },
  { key: 'contacts', label: 'Kontakty' },
  { key: 'comms', label: 'Komunikace' },
  { key: 'campaigns', label: 'Kampaně' },
  { key: 'notes', label: 'Poznámky' },
  { key: 'files', label: 'Soubory' },
] as const;

type TabKey = (typeof tabs)[number]['key'];

const commIcon: Record<CrmCommunication['channel'], React.ReactNode> = {
  email: <Mail className="text-sky-600" size={16} />,
  call: <PhoneCall className="text-emerald-600" size={16} />,
  meeting: <Video className="text-indigo-600" size={16} />,
  note: <NotebookPen className="text-amber-600" size={16} />,
};

const fileIcon: Record<CrmFile['kind'], React.ReactNode> = {
  pdf: <FileText className="text-red-500" size={18} />,
  image: <ImageIcon className="text-purple-500" size={18} />,
  sheet: <FileSpreadsheet className="text-emerald-600" size={18} />,
  doc: <FileText className="text-sky-600" size={18} />,
};

const statusMeta = {
  active: { label: 'Aktivní', tone: 'emerald' as const },
  prospect: { label: 'Prospekt', tone: 'amber' as const },
  inactive: { label: 'Neaktivní', tone: 'slate' as const },
};

export function CrmClientDetail({ client }: { client: CrmClient }) {
  const [tab, setTab] = useState<TabKey>('overview');
  const status = statusMeta[client.status];
  const activeCampaigns = client.campaigns.filter((campaign) => campaign.status === 'active');
  const previousCampaigns = client.campaigns.filter((campaign) => campaign.status === 'previous');

  return (
    <div className="space-y-6">
      {/* Header card */}
      <section className="card">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-4">
            <LogoPlaceholder label={client.logoLabel} size="lg" />
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-semibold tracking-tight text-slate-950">{client.name}</h1>
                <StatusPill label={status.label} tone={status.tone} />
              </div>
              <p className="mt-1 text-sm text-slate-500">{client.industry} · klient od {client.since}</p>
              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-slate-500">
                <span className="inline-flex items-center gap-1.5"><Building2 size={13} /> IČO {client.companyId}</span>
                <span className="inline-flex items-center gap-1.5"><MapPin size={13} /> {client.address}</span>
                <span className="inline-flex items-center gap-1.5"><Globe size={13} /> {client.website}</span>
                <span className="inline-flex items-center gap-1.5"><Users size={13} /> Obchodník: {client.owner}</span>
              </div>
            </div>
          </div>

          {/* Quick actions */}
          <div className="flex flex-wrap gap-2 lg:flex-col lg:items-stretch">
            <Link className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800" href="/sales/new">
              <Plus aria-hidden size={16} />
              Nová kampaň
            </Link>
            <button className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50" type="button">
              <Send aria-hidden size={16} />
              Odeslat e-mail
            </button>
            <button className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50" type="button">
              <MessageSquarePlus aria-hidden size={16} />
              Přidat poznámku
            </button>
          </div>
        </div>

        <div className="mt-5 grid gap-3 border-t border-slate-100 pt-5 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-[11px] uppercase tracking-wide text-slate-500">Obrat celkem</p>
            <p className="mt-1 text-lg font-semibold text-slate-950">{formatCzk(client.totalRevenue)}</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-[11px] uppercase tracking-wide text-slate-500">Otevřená hodnota</p>
            <p className="mt-1 text-lg font-semibold text-slate-950">{formatCzk(client.openValue)}</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-[11px] uppercase tracking-wide text-slate-500">Aktivní kampaně</p>
            <p className="mt-1 text-lg font-semibold text-slate-950">{activeCampaigns.length}</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-[11px] uppercase tracking-wide text-slate-500">Health score</p>
            <p className="mt-1 text-lg font-semibold text-emerald-600">{client.healthScore}/100</p>
          </div>
        </div>
      </section>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-white p-1 text-sm font-medium text-slate-600">
        {tabs.map((item) => (
          <button
            className={`rounded-lg px-3 py-1.5 transition ${tab === item.key ? 'bg-slate-950 text-white' : 'hover:bg-slate-100'}`}
            key={item.key}
            onClick={() => setTab(item.key)}
            type="button"
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'overview' && (
        <div className="grid gap-6 lg:grid-cols-2">
          <section className="card">
            <h2 className="mb-3 text-base font-semibold text-slate-950">Fakturační údaje</h2>
            <dl className="grid grid-cols-2 gap-y-3 text-sm">
              <dt className="text-slate-500">IČO</dt><dd className="font-medium text-slate-900">{client.companyId}</dd>
              <dt className="text-slate-500">DIČ</dt><dd className="font-medium text-slate-900">{client.vatId}</dd>
              <dt className="text-slate-500">Adresa</dt><dd className="font-medium text-slate-900">{client.address}</dd>
              <dt className="text-slate-500">Web</dt><dd className="font-medium text-slate-900">{client.website}</dd>
              <dt className="text-slate-500">Obor</dt><dd className="font-medium text-slate-900">{client.industry}</dd>
            </dl>
          </section>
          <section className="card">
            <h2 className="mb-3 text-base font-semibold text-slate-950">Poslední komunikace</h2>
            <ul className="space-y-3">
              {client.communications.slice(0, 3).map((comm) => (
                <li className="flex items-start gap-3" key={comm.id}>
                  <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-slate-50 ring-1 ring-slate-200">{commIcon[comm.channel]}</span>
                  <div>
                    <p className="text-sm font-medium text-slate-900">{comm.subject}</p>
                    <p className="text-xs text-slate-500">{comm.date} · {comm.author}</p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}

      {tab === 'contacts' && (
        <div className="grid gap-4 md:grid-cols-2">
          {client.contacts.map((contact) => (
            <section className="card" key={contact.id}>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <span className="grid h-11 w-11 place-items-center rounded-full bg-slate-900 text-sm font-semibold text-white">
                    {contact.name.split(' ').map((part) => part[0]).join('').slice(0, 2)}
                  </span>
                  <div>
                    <p className="font-semibold text-slate-950">{contact.name}</p>
                    <p className="text-xs text-slate-500">{contact.role}</p>
                  </div>
                </div>
                {contact.primary && <Chip tone="blue"><Star aria-hidden size={12} /> Hlavní</Chip>}
              </div>
              <div className="mt-4 space-y-2 text-sm">
                <a className="flex items-center gap-2 text-slate-700 hover:text-slate-950" href={`mailto:${contact.email}`}>
                  <Mail aria-hidden className="text-slate-400" size={15} /> {contact.email}
                </a>
                <a className="flex items-center gap-2 text-slate-700 hover:text-slate-950" href={`tel:${contact.phone}`}>
                  <Phone aria-hidden className="text-slate-400" size={15} /> {contact.phone}
                </a>
              </div>
            </section>
          ))}
        </div>
      )}

      {tab === 'comms' && (
        <section className="card !p-0">
          <ul className="divide-y divide-slate-100">
            {client.communications.map((comm) => (
              <li className="flex items-start gap-3 p-4" key={comm.id}>
                <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-slate-50 ring-1 ring-slate-200">{commIcon[comm.channel]}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-slate-950">{comm.subject}</p>
                    <span className="shrink-0 text-xs text-slate-400">{comm.date}</span>
                  </div>
                  <p className="mt-0.5 text-sm text-slate-600">{comm.summary}</p>
                  <p className="mt-1 text-xs text-slate-400">{comm.author}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {tab === 'campaigns' && (
        <div className="space-y-6">
          <section>
            <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-slate-950">
              <span className="h-2 w-2 rounded-full bg-emerald-500" /> Aktivní kampaně ({activeCampaigns.length})
            </h2>
            <div className="grid gap-3 md:grid-cols-2">
              {activeCampaigns.map((campaign) => (
                <div className="card" key={campaign.id}>
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-semibold text-slate-950">{campaign.name}</p>
                    <StatusPill label="Aktivní" tone="emerald" />
                  </div>
                  <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500"><CalendarClock size={13} /> {campaign.period}</p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {campaign.mediaTypes.map((media) => <Chip key={media}>{media}</Chip>)}
                  </div>
                  <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-sm">
                    <span className="text-slate-500">{campaign.surfaces} ploch</span>
                    <span className="font-semibold text-slate-900">{formatCzk(campaign.value)}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {previousCampaigns.length > 0 && (
            <section>
              <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-slate-950">
                <span className="h-2 w-2 rounded-full bg-slate-400" /> Předchozí kampaně ({previousCampaigns.length})
              </h2>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {previousCampaigns.map((campaign) => (
                  <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4" key={campaign.id}>
                    <p className="text-sm font-semibold text-slate-800">{campaign.name}</p>
                    <p className="mt-1 text-xs text-slate-500">{campaign.period}</p>
                    <div className="mt-3 flex items-center justify-between text-sm">
                      <span className="text-slate-500">{campaign.surfaces} ploch</span>
                      <span className="font-semibold text-slate-700">{formatCzk(campaign.value)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {tab === 'notes' && (
        <div className="space-y-3">
          {client.notes.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">
              Zatím žádné poznámky.
            </div>
          ) : (
            client.notes.map((note) => (
              <section className={`card ${note.pinned ? 'ring-1 ring-amber-200' : ''}`} key={note.id}>
                <div className="flex items-start gap-3">
                  {note.pinned && <Pin aria-hidden className="mt-0.5 shrink-0 text-amber-500" size={16} />}
                  <div>
                    <p className="text-sm leading-relaxed text-slate-800">{note.text}</p>
                    <p className="mt-2 text-xs text-slate-400">{note.author} · {note.date}</p>
                  </div>
                </div>
              </section>
            ))
          )}
        </div>
      )}

      {tab === 'files' && (
        <section className="card !p-0">
          {client.files.length === 0 ? (
            <div className="p-6 text-center text-sm text-slate-500">Zatím žádné soubory.</div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {client.files.map((file) => (
                <li className="flex items-center gap-3 p-4" key={file.id}>
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-50 ring-1 ring-slate-200">{fileIcon[file.kind]}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900">{file.name}</p>
                    <p className="text-xs text-slate-400">{file.size} · {file.date}</p>
                  </div>
                  <button className="rounded-lg border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-50 hover:text-slate-900" type="button" aria-label="Stáhnout soubor">
                    <Paperclip aria-hidden size={16} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}

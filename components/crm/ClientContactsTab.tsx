'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Table, TableHead, TableHeaderCell, TableCell, EmptyState, Button } from '@/components/ui';
import { ClientContactItem, ClientProfileData } from '@/lib/crm/types';
import { Edit3, Trash2, Plus, Mail, Phone } from 'lucide-react';

export function ClientContactsTab({ client }: { client: ClientProfileData }) {
  const router = useRouter();
  const contacts = client.contacts || [];

  // Modal / Editing state
  const [editingContact, setEditingContact] = useState<ClientContactItem | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [loading, setLoading] = useState(false);

  // Form fields
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [title, setTitle] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [isPrimary, setIsPrimary] = useState(false);
  const [isCommercial, setIsCommercial] = useState(true);
  const [isRealization, setIsRealization] = useState(false);
  const [isBilling, setIsBilling] = useState(false);

  const openCreateModal = () => {
    setEditingContact(null);
    setFirstName('');
    setLastName('');
    setTitle('');
    setEmail('');
    setPhone('');
    setIsPrimary(contacts.length === 0);
    setIsCommercial(true);
    setIsRealization(false);
    setIsBilling(false);
    setIsCreating(true);
  };

  const openEditModal = (c: ClientContactItem) => {
    setEditingContact(c);
    setFirstName(c.firstName || '');
    setLastName(c.lastName || '');
    setTitle(c.title || '');
    setEmail(c.email || '');
    setPhone(c.phone || '');
    setIsPrimary(Boolean(c.isPrimary));
    setIsCommercial(Boolean(c.isCommercial));
    setIsRealization(Boolean(c.isRealization));
    setIsBilling(Boolean(c.isBilling));
    setIsCreating(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const url = editingContact
        ? `/api/crm/clients/${client.id}/contacts/${editingContact.id}`
        : `/api/crm/clients/${client.id}/contacts`;
      const method = editingContact ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName,
          lastName,
          title,
          email,
          phone,
          isPrimary,
          isCommercial,
          isRealization,
          isBilling,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        alert(errData.error || 'Chyba při ukládání kontaktu.');
      } else {
        setEditingContact(null);
        setIsCreating(false);
        router.refresh();
      }
    } catch {
      alert('Chyba komunikace se serverem.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (contactId: string, name: string) => {
    if (!confirm(`Opravdu chcete archivovat kontakt "${name}"? Kontakt zmizí z aktivního seznamu, ale historie zůstane zachována.`)) return;
    try {
      const res = await fetch(`/api/crm/clients/${client.id}/contacts/${contactId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        router.refresh();
      } else {
        alert('Chyba při mazání kontaktu.');
      }
    } catch {
      alert('Chyba komunikace se serverem.');
    }
  };

  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between border-b pb-3">
        <div>
          <h3 className="font-bold text-slate-900 text-lg">Kontaktní osoby ({contacts.length})</h3>
          <p className="text-xs text-slate-500">Evidence a úprava všech kontaktních osob klienta.</p>
        </div>
        <Button onClick={openCreateModal} className="flex items-center gap-1.5 text-xs font-bold">
          <Plus size={14} />
          <span>➕ Přidat kontakt</span>
        </Button>
      </div>

      {contacts.length === 0 ? (
        <EmptyState title="Žádné kontaktní osoby" description="Přidejte první kontaktní osobu tlačítkem výše." />
      ) : (
        <Table minWidth="min-w-[700px]">
          <TableHead>
            <tr>
              <TableHeaderCell>Jméno a Příjmení</TableHeaderCell>
              <TableHeaderCell>Pozice / Funkce</TableHeaderCell>
              <TableHeaderCell>E-mail</TableHeaderCell>
              <TableHeaderCell>Telefon</TableHeaderCell>
              <TableHeaderCell>Kompetence</TableHeaderCell>
              <TableHeaderCell>Akce</TableHeaderCell>
            </tr>
          </TableHead>
          <tbody>
            {contacts.map((contact: ClientContactItem) => (
              <tr key={contact.id} className="hover:bg-slate-50/70">
                <TableCell>
                  <div className="font-bold text-slate-900 flex items-center gap-2">
                    <span>{contact.firstName} {contact.lastName}</span>
                    {contact.isPrimary && (
                      <span className="bg-emerald-100 text-emerald-800 text-[10px] px-2 py-0.5 rounded-full font-bold border border-emerald-300">
                        HLAVNÍ KONTAKT
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell>{contact.title || contact.department || '-'}</TableCell>
                <TableCell>
                  {contact.email ? (
                    <a href={`mailto:${contact.email}`} className="text-sky-600 hover:underline flex items-center gap-1 text-xs">
                      <Mail size={12} className="text-sky-500" />
                      <span>{contact.email}</span>
                    </a>
                  ) : '-'}
                </TableCell>
                <TableCell>
                  {contact.phone ? (
                    <a href={`tel:${contact.phone}`} className="text-sky-600 hover:underline flex items-center gap-1 text-xs">
                      <Phone size={12} className="text-sky-500" />
                      <span>{contact.phone}</span>
                    </a>
                  ) : '-'}
                </TableCell>
                <TableCell>
                  <div className="flex gap-1 flex-wrap text-[10px]">
                    {contact.isCommercial && <span className="bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded border border-blue-200">Obchod</span>}
                    {contact.isRealization && <span className="bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded border border-purple-200">Realizace</span>}
                    {contact.isBilling && <span className="bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded border border-amber-200">Fakturace</span>}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openEditModal(contact)}
                      className="px-3 py-1.5 rounded-xl bg-sky-100 hover:bg-sky-200 text-sky-900 text-xs font-extrabold transition flex items-center gap-1.5 shadow-2xs"
                      title="Upravit kontaktní osobu"
                    >
                      <Edit3 size={13} className="text-sky-700" />
                      <span>✏️ Upravit</span>
                    </button>
                    <button
                      onClick={() => handleDelete(contact.id, `${contact.firstName} ${contact.lastName}`)}
                      className="px-2.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-800 text-xs font-bold transition flex items-center gap-1"
                      title="Archivovat kontakt"
                    >
                      <Trash2 size={13} className="text-rose-600" />
                      <span>Archivovat</span>
                    </button>
                  </div>
                </TableCell>
              </tr>
            ))}
          </tbody>
        </Table>
      )}

      {/* Edit / Create Contact Modal */}
      {(editingContact || isCreating) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 text-slate-900">
          <div className="card max-w-md w-full bg-white space-y-4 shadow-2xl">
            <h3 className="font-bold text-base border-b pb-2">
              {editingContact ? '✏️ Upravit kontaktní osobu' : '➕ Přidat novou kontaktní osobu'}
            </h3>

            <form onSubmit={handleSave} className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs font-semibold">Jméno *
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required
                    className="input text-xs mt-1"
                  />
                </label>
                <label className="text-xs font-semibold">Příjmení *
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    required
                    className="input text-xs mt-1"
                  />
                </label>
              </div>

              <label className="text-xs font-semibold">Pozice / Funkce
                <input
                  type="text"
                  placeholder="Např. Vedoucí prodejny / Marketing"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="input text-xs mt-1"
                />
              </label>

              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs font-semibold">E-mail
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="input text-xs mt-1"
                  />
                </label>
                <label className="text-xs font-semibold">Telefon
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="input text-xs mt-1"
                  />
                </label>
              </div>

              <div className="space-y-2 pt-1 border-t">
                <span className="text-xs font-bold text-slate-700 block">Kompetence & Role</span>
                <div className="flex flex-wrap gap-4 text-xs">
                  <label className="flex items-center gap-1.5 font-medium cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isPrimary}
                      onChange={(e) => setIsPrimary(e.target.checked)}
                      className="rounded text-sky-600"
                    />
                    <span>Hlavní kontakt klienta</span>
                  </label>
                  <label className="flex items-center gap-1.5 font-medium cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isCommercial}
                      onChange={(e) => setIsCommercial(e.target.checked)}
                      className="rounded text-sky-600"
                    />
                    <span>Obchod</span>
                  </label>
                  <label className="flex items-center gap-1.5 font-medium cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isRealization}
                      onChange={(e) => setIsRealization(e.target.checked)}
                      className="rounded text-sky-600"
                    />
                    <span>Realizace</span>
                  </label>
                  <label className="flex items-center gap-1.5 font-medium cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isBilling}
                      onChange={(e) => setIsBilling(e.target.checked)}
                      className="rounded text-sky-600"
                    />
                    <span>Fakturace</span>
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t pt-3">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setEditingContact(null);
                    setIsCreating(false);
                  }}
                >
                  Zrušit
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? 'Ukládám...' : 'Uložit kontakt'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

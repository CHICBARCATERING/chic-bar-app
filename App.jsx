import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, doc, onSnapshot, addDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import {
  Phone, MessageCircle, Calendar, Trash2, Plus,
  CheckCircle2, Clock, MapPin, User, Briefcase,
  ChevronRight, ChevronDown, ChevronLeft, Link, DollarSign,
  Map, GlassWater, Shirt, FileText, LayoutGrid, List, Send, Check, Users, X
} from 'lucide-react';

const firebaseConfig = {
  apiKey: "AIzaSyCdClwsHH_WpPt5EsMBoi4yAz1U9aJUDZ8",
  authDomain: "chic-bar.firebaseapp.com",
  projectId: "chic-bar",
  storageBucket: "chic-bar.firebasestorage.app",
  messagingSenderId: "1039444075661",
  appId: "1:1039444075661:web:bbf93e0dd986fa3daa6ec4"
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = 'chic-bar-agency-2026';

const getDefaultPay = (role) => {
  switch(role) {
    case 'Barman': return '12/h';
    case 'Cameriere': return '10/h';
    case 'Aiuto Barman': return '8/h';
    case 'Videomaker': return '50';
    case 'Responsabile': return '15/h';
    default: return '';
  }
};

const ROLES = ['Barman', 'Cameriere', 'Aiuto Barman', 'Videomaker', 'Responsabile', 'Altro'];

export default function App() {
  const [user, setUser] = useState(null);
  const [events, setEvents] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  const [expandedEvent, setExpandedEvent] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [activeDropdownId, setActiveDropdownId] = useState(null);

  const [isRubricaOpen, setIsRubricaOpen] = useState(false);
  const [rubricaView, setRubricaView] = useState('list');
  const [currentContact, setCurrentContact] = useState(null);

  const defaultContact = { name: '', surname: '', phone: '39', role: 'Barman', pay: '12/h' };

  useEffect(() => {
    const initAuth = async () => {
      try {
        await signInAnonymously(auth);
      } catch (err) {
        console.error("Auth error:", err);
        setAuthError("Errore di autenticazione Firebase. Controlla la connessione.");
        setLoading(false);
      }
    };
    initAuth();
    return onAuthStateChanged(auth, setUser);
  }, []);

  useEffect(() => {
    if (!user) return;

    const eventsCollection = collection(db, 'artifacts', appId, 'public', 'data', 'events');
    const unsubEvents = onSnapshot(eventsCollection,
      (snapshot) => {
        setEvents(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      (error) => { console.error("Firestore events error:", error); setLoading(false); }
    );

    const contactsCollection = collection(db, 'artifacts', appId, 'public', 'data', 'contacts');
    const unsubContacts = onSnapshot(contactsCollection,
      (snapshot) => setContacts(snapshot.docs.map(d => ({ id: d.id, ...d.data() }))),
      (error) => console.error("Firestore contacts error:", error)
    );

    return () => { unsubEvents(); unsubContacts(); };
  }, [user]);

  const createNewEvent = async () => {
    const eventsCollection = collection(db, 'artifacts', appId, 'public', 'data', 'events');
    const newDoc = await addDoc(eventsCollection, {
      clientName: '',
      location: '',
      date: new Date().toISOString().split('T')[0],
      staffNeeded: 0,
      staff: [],
      staffComplete: false,
      createdAt: Date.now()
    });
    setExpandedEvent(newDoc.id);
  };

  const updateEvent = async (eventId, data) => {
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'events', eventId), data);
  };

  const confirmDeleteEvent = async (eventId) => {
    await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'events', eventId));
    setDeleteConfirm(null);
    if (expandedEvent === eventId) setExpandedEvent(null);
  };

  const generateStaffSlots = (event) => {
    const count = parseInt(event.staffNeeded) || 0;
    const currentStaff = [...(event.staff || [])];
    if (currentStaff.length < count) {
      for (let i = currentStaff.length; i < count; i++) {
        currentStaff.push({
          id: Math.random().toString(36).substr(2, 9),
          name: '', surname: '', role: 'Barman', pay: '',
          date: event.date, startTime: '18:00', endTime: '02:00',
          uniformColor: 'Nera (Camicia nera, pantaloni neri)',
          mapsLink: '', drinkList: '', notes: '',
          confirmed: false, sent: false, phone: ''
        });
      }
    } else {
      currentStaff.length = count;
    }
    updateEvent(event.id, { staff: currentStaff });
  };

  const updateStaffMember = (eventId, staffId, field, value) => {
    const event = events.find(e => e.id === eventId);
    if (!event) return;
    const newStaff = event.staff.map(s => s.id === staffId ? { ...s, [field]: value } : s);
    updateEvent(eventId, { staff: newStaff });
  };

  const applyContactToSlot = (eventId, staffId, contact) => {
    const event = events.find(e => e.id === eventId);
    if (!event) return;
    const newStaff = event.staff.map(s => s.id === staffId ? {
      ...s, name: contact.name, surname: contact.surname,
      phone: contact.phone, role: contact.role, pay: contact.pay
    } : s);
    updateEvent(eventId, { staff: newStaff });
    setActiveDropdownId(null);
  };

  const removeStaffMember = (eventId, staffId) => {
    const event = events.find(e => e.id === eventId);
    if (!event) return;
    const newStaff = event.staff.filter(s => s.id !== staffId);
    updateEvent(eventId, { staff: newStaff, staffNeeded: newStaff.length });
  };

  const openRubrica = () => { setRubricaView('list'); setIsRubricaOpen(true); };
  const closeRubrica = () => {
    setIsRubricaOpen(false);
    setTimeout(() => { setRubricaView('list'); setCurrentContact(null); }, 200);
  };
  const handleAddNewContactClick = () => {
    setCurrentContact({ ...defaultContact }); setRubricaView('form');
  };
  const handleViewContactClick = (contact) => {
    setCurrentContact({ ...contact }); setRubricaView('detail');
  };
  const handleEditContactClick = () => {
    setRubricaView('form');
  };

  const saveContact = async () => {
    if (!currentContact.name || !currentContact.surname) return;
    const contactsCollection = collection(db, 'artifacts', appId, 'public', 'data', 'contacts');
    if (currentContact.id) {
      const { id, ...data } = currentContact;
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'contacts', id), data);
    } else {
      await addDoc(contactsCollection, { ...currentContact, createdAt: Date.now() });
    }
    setRubricaView('list');
  };

  const deleteContact = async (contactId) => {
    await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'contacts', contactId));
    setRubricaView('list');
  };

  const formatWhatsAppMessage = (event, emp) => {
    const clientNameText = event.clientName ? ` *${event.clientName}*` : '';
    const eventDate = emp.date || event.date;
    const dateParts = eventDate.split('-');
    const formattedDate = dateParts.length === 3
      ? `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}`
      : eventDate;

    let messageBody = [];
    if (emp.role) messageBody.push(`• *Ruolo:* ${emp.role}`);
    if (emp.role === 'Barman' && emp.drinkList) messageBody.push(`• *Drink List:* ${emp.drinkList}`);
    if (emp.startTime || emp.endTime) messageBody.push(`• *Orario:* dalle ${emp.startTime || '18:00'} alle ${emp.endTime || '02:00'}`);
    if (event.location) messageBody.push(`• *Location:* ${event.location}`);
    if (emp.mapsLink) messageBody.push(`• *Maps:* ${emp.mapsLink}`);
    if (emp.uniformColor) messageBody.push(`• *Divisa:* ${emp.uniformColor}`);
    if (emp.pay) messageBody.push(`• *Paga:* €${emp.pay}`);
    if (emp.notes) messageBody.push(`• *Note:* ${emp.notes}`);

    const dateStr = eventDate.replace(/-/g, '');
    const startT = (emp.startTime || '18:00').replace(':', '');
    const endT = (emp.endTime || '02:00').replace(':', '');
    const endDate = endT <= startT
      ? new Date(new Date(eventDate).getTime() + 86400000).toISOString().split('T')[0].replace(/-/g, '')
      : dateStr;
    const calTitle = encodeURIComponent(`Evento Chic Bar Catering${event.clientName ? ' - ' + event.clientName : ''}`);
    let calDetails = [];
    if (emp.role) calDetails.push(`Ruolo: ${emp.role}`);
    if (emp.startTime || emp.endTime) calDetails.push(`Orario: dalle ${emp.startTime || '18:00'} alle ${emp.endTime || '02:00'}`);
    if (emp.uniformColor) calDetails.push(`Divisa: ${emp.uniformColor}`);
    if (emp.pay) calDetails.push(`Paga: €${emp.pay}`);
    if (emp.role === 'Barman' && emp.drinkList) calDetails.push(`Drink List: ${emp.drinkList}`);
    if (emp.mapsLink) calDetails.push(`Maps: ${emp.mapsLink}`);
    if (emp.notes) calDetails.push(`Note: ${emp.notes}`);
    const calLink = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${calTitle}&dates=${dateStr}T${startT}00/${endDate}T${endT}00&details=${encodeURIComponent(calDetails.join('\n'))}&location=${encodeURIComponent(emp.mapsLink || event.location || '')}`;

    const rawMessage = `*CHIC BAR - DETTAGLI EVENTO*\n\nCiao ${emp.name || ''}! 👋\nEcco tutte le info per l'evento${clientNameText} del *${formattedDate}*.\n\n${messageBody.join('\n')}\n\n📅 *Aggiungi al calendario:* ${calLink}\n\nPer favore, dammi conferma di ricezione. Grazie e buon lavoro! 🚀`;
    window.open(`https://wa.me/${(emp.phone || '').replace(/\D/g, '')}?text=${encodeURIComponent(rawMessage)}`, '_blank');
  };

  const formatDateDisplay = (dateStr) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return dateStr;
  };

  const sortedEvents = [...events].sort((a, b) => {
    if (a.date < b.date) return -1;
    if (a.date > b.date) return 1;
    return (b.createdAt || 0) - (a.createdAt || 0);
  });

  if (authError) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-red-50 text-red-600 p-6 rounded-2xl max-w-md border border-red-200 shadow-lg text-center">
        <X size={40} className="mx-auto mb-2 text-red-500" />
        <h2 className="font-bold text-lg">Errore Firebase</h2>
        <p className="text-sm mt-2">{authError}</p>
      </div>
    </div>
  );

  if (loading) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#385b4f]"></div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-24 font-sans" onClick={() => setActiveDropdownId(null)}>
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 px-4 py-3 shadow-sm">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <h1 className="text-[#385b4f] font-black text-xl tracking-tight">Chic Bar — Staff</h1>
          <div className="flex gap-2">
            <button
              onClick={(e) => { e.stopPropagation(); openRubrica(); }}
              className="bg-white border-2 border-[#385b4f] text-[#385b4f] px-3 py-2 rounded-xl flex items-center gap-1.5 hover:bg-[#385b4f] hover:text-white transition-all font-bold text-sm"
            >
              <Users size={16} /> <span className="hidden sm:inline">Rubrica</span>
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); createNewEvent(); }}
              className="bg-[#385b4f] text-white px-3 py-2 rounded-xl flex items-center gap-1.5 hover:bg-[#2c473e] transition-all font-bold shadow text-sm"
            >
              <Plus size={16} /> <span className="hidden sm:inline">Nuovo Evento</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-3 sm:p-6 space-y-3">
        {sortedEvents.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <Calendar size={48} className="mx-auto mb-3 opacity-30" />
            <p className="font-semibold text-lg">Nessun evento</p>
            <p className="text-sm mt-1">Clicca "Nuovo Evento" per iniziare</p>
          </div>
        ) : sortedEvents.map(event => {
          const isExpanded = expandedEvent === event.id;
          const staffFilled = (event.staff || []).filter(s => s.name && s.surname).length;
          const staffTotal = parseInt(event.staffNeeded) || 0;
          const confirmedCount = (event.staff || []).filter(s => s.confirmed).length;
          const squadraFormata = staffTotal > 0 && confirmedCount === staffTotal;
          const mancaCount = staffTotal - confirmedCount;

          return (
            <div key={event.id} className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              <div
                className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-slate-50 transition-colors"
                onClick={(e) => { e.stopPropagation(); setExpandedEvent(isExpanded ? null : event.id); }}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${squadraFormata ? 'bg-green-400' : staffFilled === staffTotal && staffTotal > 0 ? 'bg-yellow-400' : 'bg-slate-300'}`} />
                  <div className="min-w-0">
                    <p className="font-bold text-slate-800 truncate text-sm sm:text-base">
                      {event.clientName || <span className="italic text-slate-400">Nuovo evento</span>}
                    </p>
                    <p className="text-xs text-slate-400 flex items-center gap-1">
                      <Calendar size={11} /> {formatDateDisplay(event.date)}
                      {event.location && <><span className="mx-1">·</span><MapPin size={11} />{event.location}</>}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {staffTotal > 0 && (
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${squadraFormata ? 'bg-green-100 text-green-700' : 'bg-orange-50 text-orange-600'}`}>
                      {squadraFormata ? '✅ Squadra formata' : `⚠️ Manca ${mancaCount} conferma/e`}
                    </span>
                  )}
                  <button
                    className="text-slate-300 hover:text-red-400 transition-colors p-1"
                    onClick={e => { e.stopPropagation(); setDeleteConfirm(event.id); }}
                  >
                    <Trash2 size={15} />
                  </button>
                  {isExpanded ? <ChevronDown size={16} className="text-slate-400" /> : <ChevronRight size={16} className="text-slate-400" />}
                </div>
              </div>

              {isExpanded && (
                <div className="border-t border-slate-100 px-4 py-4 space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-slate-500 font-medium block mb-1">Cliente / Evento</label>
                      <input
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#385b4f]/30"
                        value={event.clientName || ''}
                        onChange={e => updateEvent(event.id, { clientName: e.target.value })}
                        placeholder="Nome cliente"
                        onClick={e => e.stopPropagation()}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-500 font-medium block mb-1">Location</label>
                      <input
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#385b4f]/30"
                        value={event.location || ''}
                        onChange={e => updateEvent(event.id, { location: e.target.value })}
                        placeholder="Via, Città"
                        onClick={e => e.stopPropagation()}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-500 font-medium block mb-1">Data</label>
                      <input
                        type="date"
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#385b4f]/30"
                        value={event.date || ''}
                        onChange={e => updateEvent(event.id, { date: e.target.value })}
                        onClick={e => e.stopPropagation()}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-500 font-medium block mb-1">N° Staff</label>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          min="0"
                          className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#385b4f]/30"
                          value={event.staffNeeded || 0}
                          onChange={e => updateEvent(event.id, { staffNeeded: parseInt(e.target.value) || 0 })}
                          onClick={e => e.stopPropagation()}
                        />
                        <button
                          className="bg-[#385b4f] text-white px-3 rounded-xl text-xs font-bold hover:bg-[#2c473e] transition-colors flex-shrink-0"
                          onClick={e => { e.stopPropagation(); generateStaffSlots(event); }}
                        >
                          Aggiorna
                        </button>
                      </div>
                    </div>
                  </div>

                  {(event.staff || []).length > 0 && (
                    <div className="space-y-3">
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Slot Staff</p>
                      {(event.staff || []).map((emp, idx) => (
                        <StaffSlot
                          key={emp.id}
                          emp={emp}
                          idx={idx}
                          event={event}
                          contacts={contacts}
                          activeDropdownId={activeDropdownId}
                          setActiveDropdownId={setActiveDropdownId}
                          updateStaffMember={updateStaffMember}
                          applyContactToSlot={applyContactToSlot}
                          removeStaffMember={removeStaffMember}
                          formatWhatsAppMessage={formatWhatsAppMessage}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </main>

      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setDeleteConfirm(null)}>
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl" onClick={e => e.stopPropagation()}>
            <Trash2 size={32} className="text-red-500 mx-auto mb-3" />
            <h3 className="font-bold text-center text-lg mb-1">Eliminare evento?</h3>
            <p className="text-slate-500 text-sm text-center mb-5">Questa azione non può essere annullata.</p>
            <div className="flex gap-3">
              <button className="flex-1 border border-slate-200 rounded-xl py-2.5 font-medium text-sm hover:bg-slate-50 transition-colors" onClick={() => setDeleteConfirm(null)}>Annulla</button>
              <button className="flex-1 bg-red-500 text-white rounded-xl py-2.5 font-medium text-sm hover:bg-red-600 transition-colors" onClick={() => confirmDeleteEvent(deleteConfirm)}>Elimina</button>
            </div>
          </div>
        </div>
      )}

      {isRubricaOpen && (
        <div className="fixed inset-0 z-50 flex" onClick={closeRubrica}>
          <div className="ml-auto w-full max-w-sm bg-white h-full shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              {rubricaView === 'list' ? (
                <h2 className="font-black text-lg text-[#385b4f]">Rubrica Staff</h2>
              ) : (
                <button onClick={() => setRubricaView(rubricaView === 'form' && currentContact?.id ? 'detail' : 'list')} className="flex items-center gap-1 text-[#385b4f] font-bold text-sm">
                  <ChevronLeft size={18} /> {rubricaView === 'form' && currentContact?.id ? 'Dettaglio' : 'Rubrica'}
                </button>
              )}
              <button onClick={closeRubrica} className="text-slate-400 hover:text-slate-600"><X size={22} /></button>
            </div>

            {rubricaView === 'list' && (
              <>
                <div className="flex-1 overflow-y-auto">
                  {contacts.length === 0 ? (
                    <div className="text-center py-12 text-slate-400">
                      <Users size={36} className="mx-auto mb-2 opacity-30" />
                      <p className="text-sm">Nessun contatto</p>
                    </div>
                  ) : contacts.sort((a, b) => (a.surname || '').localeCompare(b.surname || '')).map(c => (
                    <div key={c.id} className="flex items-center justify-between px-5 py-3 hover:bg-slate-50 border-b border-slate-50 cursor-pointer" onClick={() => handleViewContactClick(c)}>
                      <div>
                        <p className="font-semibold text-sm">{c.surname} {c.name}</p>
                        <p className="text-xs text-slate-400">{c.role} · {c.phone}</p>
                      </div>
                      <ChevronRight size={16} className="text-slate-300" />
                    </div>
                  ))}
                </div>
                <div className="p-4 border-t border-slate-100">
                  <button onClick={handleAddNewContactClick} className="w-full bg-[#385b4f] text-white rounded-xl py-3 font-bold flex items-center justify-center gap-2 hover:bg-[#2c473e] transition-colors">
                    <Plus size={18} /> Nuovo contatto
                  </button>
                </div>
              </>
            )}

            {rubricaView === 'detail' && currentContact && (
              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                <div className="bg-slate-50 rounded-2xl p-4 space-y-3">
                  <div>
                    <p className="text-xs text-slate-400 font-medium">Nome</p>
                    <p className="text-sm font-semibold text-slate-800">{currentContact.name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 font-medium">Cognome</p>
                    <p className="text-sm font-semibold text-slate-800">{currentContact.surname}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 font-medium">Telefono</p>
                    <p className="text-sm font-semibold text-slate-800">{currentContact.phone}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 font-medium">Ruolo</p>
                    <p className="text-sm font-semibold text-slate-800">{currentContact.role}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 font-medium">Paga default</p>
                    <p className="text-sm font-semibold text-slate-800">{currentContact.pay || '—'}</p>
                  </div>
                </div>
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => deleteContact(currentContact.id)}
                    className="flex-1 border border-red-200 text-red-500 rounded-xl py-2.5 font-medium text-sm hover:bg-red-50 transition-colors flex items-center justify-center gap-1"
                  >
                    <Trash2 size={14} /> Elimina
                  </button>
                  <button
                    onClick={handleEditContactClick}
                    className="flex-1 bg-[#385b4f] text-white rounded-xl py-2.5 font-bold text-sm hover:bg-[#2c473e] transition-colors flex items-center justify-center gap-1"
                  >
                    Modifica
                  </button>
                </div>
              </div>
            )}

            {rubricaView === 'form' && (
              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                <div>
                  <label className="text-xs text-slate-500 font-medium block mb-1">Nome</label>
                  <input className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#385b4f]/30"
                    value={currentContact?.name || ''}
                    onChange={e => setCurrentContact(p => ({ ...p, name: e.target.value }))}
                    placeholder="Nome" />
                </div>
                <div>
                  <label className="text-xs text-slate-500 font-medium block mb-1">Cognome</label>
                  <input className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#385b4f]/30"
                    value={currentContact?.surname || ''}
                    onChange={e => setCurrentContact(p => ({ ...p, surname: e.target.value }))}
                    placeholder="Cognome" />
                </div>
                <div>
                  <label className="text-xs text-slate-500 font-medium block mb-1">Telefono (con prefisso)</label>
                  <input className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#385b4f]/30"
                    value={currentContact?.phone || ''}
                    onChange={e => setCurrentContact(p => ({ ...p, phone: e.target.value }))}
                    placeholder="393331234567" />
                </div>
                <div>
                  <label className="text-xs text-slate-500 font-medium block mb-1">Ruolo</label>
                  <select className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#385b4f]/30"
                    value={currentContact?.role || 'Barman'}
                    onChange={e => setCurrentContact(p => ({ ...p, role: e.target.value, pay: getDefaultPay(e.target.value) }))}>
                    {ROLES.map(r => <option key={r}>{r}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-500 font-medium block mb-1">Paga default</label>
                  <input className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#385b4f]/30"
                    value={currentContact?.pay || ''}
                    onChange={e => setCurrentContact(p => ({ ...p, pay: e.target.value }))}
                    placeholder="es. 12/h" />
                </div>
                <div className="flex gap-3 pt-2">
                  <button onClick={saveContact} disabled={!currentContact?.name || !currentContact?.surname}
                    className="flex-1 bg-[#385b4f] text-white rounded-xl py-2.5 font-bold text-sm hover:bg-[#2c473e] transition-colors disabled:opacity-40">
                    Salva
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function StaffSlot({ emp, idx, event, contacts, activeDropdownId, setActiveDropdownId, updateStaffMember, applyContactToSlot, removeStaffMember, formatWhatsAppMessage }) {
  const dropdownId = `${event.id}-${emp.id}`;
  const isDropdownOpen = activeDropdownId === dropdownId;

  return (
    <div className="border border-slate-200 rounded-2xl p-3 space-y-3 bg-slate-50">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-slate-500">STAFF #{idx + 1}</span>
        <div className="flex items-center gap-2">
          {emp.confirmed && <CheckCircle2 size={14} className="text-green-500" />}
          <button onClick={e => { e.stopPropagation(); removeStaffMember(event.id, emp.id); }} className="text-slate-300 hover:text-red-400 transition-colors">
            <X size={16} />
          </button>
        </div>
      </div>

      <div className="flex-1 relative" onClick={e => e.stopPropagation()}>
        <button
          className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-left bg-white flex items-center justify-between hover:border-[#385b4f] transition-colors"
          onClick={e => { e.stopPropagation(); setActiveDropdownId(isDropdownOpen ? null : dropdownId); }}
        >
          <span className={emp.name && emp.surname ? 'text-slate-800 font-medium' : 'text-slate-400'}>
            {emp.name && emp.surname ? `${emp.surname} ${emp.name}` : 'Seleziona da rubrica...'}
          </span>
          <ChevronDown size={14} className="text-slate-400 flex-shrink-0 ml-1" />
        </button>
        {isDropdownOpen && (
          <div className="absolute top-full left-0 right-0 bg-white border border-slate-200 rounded-xl shadow-lg z-30 mt-1 max-h-40 overflow-y-auto">
            <div className="p-2 border-b border-slate-100">
              <p className="text-xs text-slate-400 font-medium px-2">Seleziona dalla rubrica</p>
            </div>
            {contacts.length === 0
              ? <p className="text-xs text-slate-400 p-3 text-center">Nessun contatto in rubrica</p>
              : contacts.sort((a, b) => (a.surname || '').localeCompare(b.surname || '')).map(c => (
                <button key={c.id} className="w-full text-left px-3 py-2 hover:bg-slate-50 text-sm"
                  onClick={e => { e.stopPropagation(); applyContactToSlot(event.id, emp.id, c); }}>
                  <span className="font-medium">{c.surname} {c.name}</span>
                  <span className="text-xs text-slate-400 ml-2">{c.role}</span>
                </button>
              ))
            }
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <input className="border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#385b4f]/30"
          value={emp.name || ''} onChange={e => updateStaffMember(event.id, emp.id, 'name', e.target.value)}
          placeholder="Nome" onClick={e => e.stopPropagation()} />
        <input className="border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#385b4f]/30"
          value={emp.surname || ''} onChange={e => updateStaffMember(event.id, emp.id, 'surname', e.target.value)}
          placeholder="Cognome" onClick={e => e.stopPropagation()} />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div onClick={e => e.stopPropagation()}>
          <label className="text-xs text-slate-400 mb-0.5 block">Ruolo</label>
          <select className="w-full border border-slate-200 rounded-xl px-2 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#385b4f]/30"
            value={emp.role || 'Barman'}
            onChange={e => updateStaffMember(event.id, emp.id, 'role', e.target.value)}>
            {['Barman','Cameriere','Aiuto Barman','Videomaker','Responsabile','Altro'].map(r => <option key={r}>{r}</option>)}
          </select>
        </div>
        <div onClick={e => e.stopPropagation()}>
          <label className="text-xs text-slate-400 mb-0.5 block">Paga</label>
          <input className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#385b4f]/30"
            value={emp.pay || ''} onChange={e => updateStaffMember(event.id, emp.id, 'pay', e.target.value)}
            placeholder="12/h" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div onClick={e => e.stopPropagation()}>
          <label className="text-xs text-slate-400 mb-0.5 block">Data turno</label>
          <input type="date" className="w-full border border-slate-200 rounded-xl px-2 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#385b4f]/30"
            value={emp.date || event.date || ''} onChange={e => updateStaffMember(event.id, emp.id, 'date', e.target.value)} />
        </div>
        <div onClick={e => e.stopPropagation()}>
          <label className="text-xs text-slate-400 mb-0.5 block">Telefono (WA)</label>
          <input className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#385b4f]/30"
            value={emp.phone || ''} onChange={e => updateStaffMember(event.id, emp.id, 'phone', e.target.value)}
            placeholder="393331234567" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2" onClick={e => e.stopPropagation()}>
        <div>
          <label className="text-xs text-slate-400 mb-0.5 block">Inizio</label>
          <input type="time" className="w-full border border-slate-200 rounded-xl px-2 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#385b4f]/30"
            value={emp.startTime || '18:00'} onChange={e => updateStaffMember(event.id, emp.id, 'startTime', e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-slate-400 mb-0.5 block">Fine</label>
          <input type="time" className="w-full border border-slate-200 rounded-xl px-2 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#385b4f]/30"
            value={emp.endTime || '02:00'} onChange={e => updateStaffMember(event.id, emp.id, 'endTime', e.target.value)} />
        </div>
      </div>

      <div onClick={e => e.stopPropagation()}>
        <label className="text-xs text-slate-400 mb-0.5 block">Divisa</label>
        <select className="w-full border border-slate-200 rounded-xl px-2 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#385b4f]/30"
          value={emp.uniformColor || ''} onChange={e => updateStaffMember(event.id, emp.id, 'uniformColor', e.target.value)}>
          {['Nera (Camicia nera, pantaloni neri)','Bianca (Camicia bianca, pantaloni neri)','Elegante (Giacca, camicia bianca)','Casual (A scelta)'].map(u => <option key={u}>{u}</option>)}
        </select>
      </div>

      {emp.role === 'Barman' && (
        <div onClick={e => e.stopPropagation()}>
          <label className="text-xs text-slate-400 mb-0.5 block">Drink List</label>
          <input className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#385b4f]/30"
            value={emp.drinkList || ''} onChange={e => updateStaffMember(event.id, emp.id, 'drinkList', e.target.value)}
            placeholder="URL drink list..." />
        </div>
      )}

      <div onClick={e => e.stopPropagation()}>
        <label className="text-xs text-slate-400 mb-0.5 block">Link Maps</label>
        <input className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#385b4f]/30"
          value={emp.mapsLink || ''} onChange={e => updateStaffMember(event.id, emp.id, 'mapsLink', e.target.value)}
          placeholder="https://maps.google.com/..." />
      </div>

      <div onClick={e => e.stopPropagation()}>
        <label className="text-xs text-slate-400 mb-0.5 block">Note</label>
        <input className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#385b4f]/30"
          value={emp.notes || ''} onChange={e => updateStaffMember(event.id, emp.id, 'notes', e.target.value)}
          placeholder="Note aggiuntive..." />
      </div>

      <div className="flex gap-2 pt-1">
        <button
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-bold transition-colors ${emp.confirmed ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          onClick={e => { e.stopPropagation(); updateStaffMember(event.id, emp.id, 'confirmed', !emp.confirmed); }}
        >
          <CheckCircle2 size={15} /> {emp.confirmed ? 'Confermato' : 'Conferma'}
        </button>
        <button
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-bold bg-green-500 text-white hover:bg-green-600 transition-colors disabled:opacity-40"
          disabled={!emp.phone}
          onClick={e => { e.stopPropagation(); formatWhatsAppMessage(event, emp); updateStaffMember(event.id, emp.id, 'sent', true); }}
        >
          <MessageCircle size={15} /> WhatsApp
        </button>
      </div>
    </div>
  );
}

import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, doc, onSnapshot, addDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import {
  Phone, MessageCircle, Calendar, Trash2, Plus,
  CheckCircle2, Clock, MapPin, User, Briefcase,
  ChevronRight, ChevronDown, ChevronLeft, Link, DollarSign,
  Map, GlassWater, Shirt, FileText, LayoutGrid, List, Send, Check, Users, X, Bell, AlertTriangle, Search, ClipboardCopy
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

// Incolla qui il link DIRETTO dell'immagine (tasto destro sul logo su imgur → "Copia indirizzo immagine",
// deve iniziare con https://i.imgur.com/...). Il link album https://imgur.com/a/ODrHo3J non funziona in <img>.
const LOGO_URL = 'https://i.imgur.com/ODrHo3J.png';

const getDefaultPay = (role) => {
  switch(role) {
    case 'Barman': return '10/h';
    case 'Cameriere': return '10/h';
    case 'Aiuto Barman': return '8/h';
    case 'Videomaker': return '50';
    case 'Responsabile': return '15/h';
    default: return '';
  }
};

const getDefaultPayType = (role) => role === 'Videomaker' ? 'fixed' : 'hourly';

const ROLES = ['Barman', 'Cameriere', 'Aiuto Barman', 'Videomaker', 'Responsabile', 'Altro'];

const LOCATIONS = [
  { name: 'Domus Latae', maps: 'https://www.google.com/maps/search/?api=1&query=Domus+Latae' },
  { name: 'Villa Alfonso', maps: 'https://www.google.com/maps/search/?api=1&query=Villa+Alfonso' },
  { name: 'Villa del Vecchio Pozzo', maps: 'https://www.google.com/maps/search/?api=1&query=Villa+del+Vecchio+Pozzo' },
  { name: 'Villa Egea', maps: 'https://www.google.com/maps/search/?api=1&query=Villa+Egea' },
  { name: 'Villa Lisa', maps: 'https://www.google.com/maps/search/?api=1&query=Villa+Lisa' },
  { name: 'Villa Sciarrera Hera', maps: 'https://www.google.com/maps/search/?api=1&query=Villa+Sciarrera+Hera' },
  { name: 'Salone Romano', maps: 'https://www.google.com/maps/search/?api=1&query=Salone+Romano' },
];

const getEventTiming = (dateStr) => {
  if (!dateStr) return { label: '', tone: 'none', daysDiff: null };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const parts = dateStr.split('-').map(Number);
  if (parts.length !== 3) return { label: '', tone: 'none', daysDiff: null };
  const eventDate = new Date(parts[0], parts[1] - 1, parts[2]);
  eventDate.setHours(0, 0, 0, 0);
  const diff = Math.round((eventDate - today) / 86400000);
  if (diff < 0) return { label: 'PASSATO', tone: 'past', daysDiff: diff };
  if (diff === 0) return { label: 'OGGI', tone: 'today', daysDiff: 0 };
  if (diff === 1) return { label: 'DOMANI', tone: 'soon', daysDiff: 1 };
  if (diff <= 7) return { label: `TRA ${diff} GIORNI`, tone: 'soon', daysDiff: diff };
  return { label: `TRA ${diff} GIORNI`, tone: 'future', daysDiff: diff };
};

const timingStyles = {
  today: 'bg-red-100 text-red-700',
  soon: 'bg-amber-100 text-amber-700',
  future: 'bg-slate-100 text-slate-500',
  past: 'bg-slate-100 text-slate-400',
  none: 'bg-slate-100 text-slate-400'
};

// --- Calcolo paga (F3.1) ---
const parsePayAmount = (pay) => {
  const m = String(pay || '').match(/[\d]+([.,]\d+)?/);
  return m ? parseFloat(m[0].replace(',', '.')) : 0;
};

const calcSlotHours = (emp) => {
  const [mh, mm] = (emp.meetTime || '17:30').split(':').map(Number);
  const [eh, em] = (emp.endTime || '02:00').split(':').map(Number);
  let hours = (eh + em / 60) - (mh + mm / 60);
  if (hours <= 0) hours += 24;
  return hours;
};

const calcSlotEstimate = (emp) => {
  const amount = parsePayAmount(emp.pay);
  if (!amount) return 0;
  if ((emp.payType || 'hourly') === 'fixed') return amount;
  return amount * calcSlotHours(emp);
};

const formatEuro = (n) => {
  const rounded = Math.round(n * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2).replace('.', ',');
};

const formatPayText = (emp) => {
  const amount = parsePayAmount(emp.pay);
  if (!amount) return '';
  return (emp.payType || 'hourly') === 'fixed' ? `€${formatEuro(amount)} fissi` : `€${formatEuro(amount)}/h`;
};

export default function App() {
  const [user, setUser] = useState(null);
  const [events, setEvents] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [expandedEvent, setExpandedEvent] = useState(null);
  const [eventActiveTab, setEventActiveTab] = useState('staff');
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [activeDropdownId, setActiveDropdownId] = useState(null);
  const [isRubricaOpen, setIsRubricaOpen] = useState(false);
  const [rubricaView, setRubricaView] = useState('list');
  const [currentContact, setCurrentContact] = useState(null);
  const [locations, setLocations] = useState([]);
  const [isLocRubricaOpen, setIsLocRubricaOpen] = useState(false);
  const [locRubricaView, setLocRubricaView] = useState('list');
  const [currentLocation, setCurrentLocation] = useState(null);
  const [eventFilter, setEventFilter] = useState('upcoming'); // F2.3: 'upcoming' | 'past'
  const [searchQuery, setSearchQuery] = useState(''); // F3.2
  const [toast, setToast] = useState(null); // F2.2
  const toastTimer = useRef(null);
  const [logoError, setLogoError] = useState(false);
  const defaultLocation = { name: '', maps: '' };

  const defaultContact = { name: '', surname: '', phone: '', role: 'Barman', pay: '12/h', payType: 'hourly' };

  // F2.2 — Toast "Salvato ✓"
  const showToast = (msg = 'Salvato ✓') => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 1500);
  };

  // Resetta la tab ogni volta che si apre un evento diverso
  useEffect(() => {
    setEventActiveTab('staff');
  }, [expandedEvent]);

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
    onSnapshot(
      collection(db, 'artifacts', appId, 'public', 'data', 'locations'),
      (snapshot) => setLocations(snapshot.docs.map(d => ({ id: d.id, ...d.data() }))),
      (error) => console.error("Firestore locations error:", error)
    );
    return () => { unsubEvents(); unsubContacts(); };
  }, [user]);

  const createNewEvent = async () => {
    const eventsCollection = collection(db, 'artifacts', appId, 'public', 'data', 'events');
    const newDoc = await addDoc(eventsCollection, {
      clientName: '',
      location: '',
      locationMaps: '',
      locationCustom: false,
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
    showToast();
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
          name: '', surname: '', role: 'Barman', pay: '', payType: 'hourly',
          date: event.date, meetTime: '17:30', startTime: '18:00', endTime: '02:00',
          uniformColor: 'Nera (Camicia nera, pantaloni neri)',
          mapsLink: event.locationMaps || '', drinkList: '', notes: '',
          confirmed: false, sent: false, phone: ''
        });
      }
      updateEvent(event.id, { staff: currentStaff });
    } else if (currentStaff.length > count) {
      const toRemove = currentStaff.slice(count);
      const hasData = toRemove.some(s => s.name || s.surname || s.phone || s.confirmed || s.sent);
      if (hasData) {
        const ok = window.confirm(
          `Attenzione: stai per rimuovere ${currentStaff.length - count} slot che contengono già dati o conferme. Vuoi procedere?`
        );
        if (!ok) return;
      }
      currentStaff.length = count;
      updateEvent(event.id, { staff: currentStaff });
    }
  };

  const updateStaffMember = (eventId, staffId, field, value) => {
    const event = events.find(e => e.id === eventId);
    if (!event) return;
    const newStaff = event.staff.map(s => s.id === staffId ? { ...s, [field]: value } : s);
    updateEvent(eventId, { staff: newStaff });
  };

  // Quando si sostituisce un dipendente dalla rubrica, i bottoni tornano alla Fase A
  const applyContactToSlot = (eventId, staffId, contact) => {
    const event = events.find(e => e.id === eventId);
    if (!event) return;
    const newStaff = event.staff.map(s => s.id === staffId ? {
      ...s, name: contact.name, surname: contact.surname,
      phone: contact.phone, role: contact.role, pay: contact.pay,
      payType: contact.payType || 'hourly',
      sent: false, confirmed: false
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
    showToast();
    setRubricaView('list');
  };

  const deleteContact = async (contactId) => {
    await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'contacts', contactId));
    setRubricaView('list');
  };

  const openLocRubrica = () => { setLocRubricaView('list'); setIsLocRubricaOpen(true); };
  const closeLocRubrica = () => {
    setIsLocRubricaOpen(false);
    setTimeout(() => { setLocRubricaView('list'); setCurrentLocation(null); }, 200);
  };
  const handleAddNewLocationClick = () => {
    setCurrentLocation({ ...defaultLocation }); setLocRubricaView('form');
  };
  const handleViewLocationClick = (loc) => {
    setCurrentLocation({ ...loc }); setLocRubricaView('detail');
  };
  const handleEditLocationClick = () => {
    setLocRubricaView('form');
  };

  const saveLocation = async () => {
    if (!currentLocation.name) return;
    const locationsCollection = collection(db, 'artifacts', appId, 'public', 'data', 'locations');
    if (currentLocation.id) {
      const { id, ...data } = currentLocation;
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'locations', id), data);
    } else {
      await addDoc(locationsCollection, { ...currentLocation, createdAt: Date.now() });
    }
    showToast();
    setLocRubricaView('list');
  };

  const deleteLocation = async (locationId) => {
    await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'locations', locationId));
    setLocRubricaView('list');
  };

  const messageContact = (contact) => {
    const phone = (contact.phone || '').replace(/\D/g, '');
    if (!phone) return;
    window.open(`https://wa.me/${phone}`, '_blank');
  };

  // F5.3 — Messaggio WhatsApp principale
  const formatWhatsAppMessage = (event, emp) => {
    const eventDate = emp.date || event.date;
    const dateParts = eventDate.split('-');
    const formattedDate = dateParts.length === 3
      ? `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}`
      : eventDate;

    const meetTime = emp.meetTime || '17:30';
    const startTime = emp.startTime || '18:00';
    const endTime = emp.endTime || '02:00';

    const dateStr = eventDate.replace(/-/g, '');
    const startT = meetTime.replace(':', '');
    const endT = endTime.replace(':', '');
    const endDate = endT <= startT
      ? new Date(new Date(eventDate).getTime() + 86400000).toISOString().split('T')[0].replace(/-/g, '')
      : dateStr;

    const calTitle = encodeURIComponent(`Evento Chic Bar Catering${event.clientName ? ' - ' + event.clientName : ''}`);
    let calDetails = [];
    if (emp.role) calDetails.push(`Ruolo: ${emp.role}`);
    calDetails.push(`Orario incontro: ${meetTime}`);
    calDetails.push(`Inizio evento: ${startTime}`);
    calDetails.push(`Fine: ${endTime}`);
    if (emp.uniformColor) calDetails.push(`Divisa: ${emp.uniformColor}`);
    if (emp.pay) calDetails.push(`Paga: ${formatPayText(emp) || '€' + emp.pay}`);
    if (emp.role === 'Barman' && emp.drinkList) calDetails.push(`Drink List: ${emp.drinkList}`);
    if (emp.mapsLink) calDetails.push(`Maps: ${emp.mapsLink}`);
    if (emp.notes) calDetails.push(`Note: ${emp.notes}`);

    const calLink = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${calTitle}&dates=${dateStr}T${startT}00/${endDate}T${endT}00&details=${encodeURIComponent(calDetails.join('\n'))}&location=${encodeURIComponent(emp.mapsLink || event.location || '')}`;

    let lines = [];
    lines.push(`🕐 *Orario incontro:* ${meetTime}`);
    if (emp.mapsLink) lines.push(`📍 *Punto di incontro:* ${emp.mapsLink}`);
    lines.push(`🎉 *Inizio evento:* ${startTime}`);
    if (event.location) lines.push(`🏛️ *Location:* ${event.location}`);
    if (emp.role) lines.push(`👔 *Ruolo:* ${emp.role}`);
    if (emp.uniformColor) lines.push(`👗 *Divisa:* ${emp.uniformColor}`);
    if (emp.pay) lines.push(`💶 *Paga:* ${formatPayText(emp) || '€' + emp.pay}`);
    if (emp.role === 'Barman' && emp.drinkList) lines.push(`🍹 *Drink List:* ${emp.drinkList}`);
    if (emp.notes) lines.push(`📝 *Note:* ${emp.notes}`);

    const rawMessage = `*CHIC BAR - DETTAGLI EVENTO*\n\nCiao ${emp.name || ''}! 👋\nEcco le info per l'evento${event.clientName ? ' *' + event.clientName + '*' : ''} del *${formattedDate}*.\n\n${lines.join('\n')}\n\n📅 *Aggiungi al calendario:* ${calLink}\n\nConfermami ricezione. Grazie e buon lavoro! 🚀`;

    window.open(`https://wa.me/${(emp.phone || '').replace(/\D/g, '')}?text=${encodeURIComponent(rawMessage)}`, '_blank');
  };

  // F6.1 — Promemoria 7 giorni prima
  const formatReminder7daysMessage = (event, emp) => {
    const eventDate = emp.date || event.date;
    const dateParts = eventDate.split('-');
    const formattedDate = dateParts.length === 3
      ? `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}`
      : eventDate;

    let lines = [`Ciao ${emp.name || ''}! 👋`];
    lines.push(`Tra una settimana c'è l'evento${event.clientName ? ' *' + event.clientName + '*' : ''} — tutto ok da parte tua?`);
    lines.push(`📅 Data: *${formattedDate}*`);
    lines.push(`🕐 Ci vediamo alle *${emp.meetTime || '17:30'}* qui 👇`);
    if (emp.mapsLink) lines.push(`📍 ${emp.mapsLink}`);
    lines.push(`🎉 Inizio servizio: *${emp.startTime || '18:00'}*${event.location ? ' presso *' + event.location + '*' : ''}`);
    if (emp.uniformColor) lines.push(`👔 Divisa: *${emp.uniformColor}*`);
    lines.push('Fammi sapere che hai tutto chiaro, grazie! 🙌');

    const rawMessage = lines.join('\n');
    window.open(`https://wa.me/${(emp.phone || '').replace(/\D/g, '')}?text=${encodeURIComponent(rawMessage)}`, '_blank');
  };

  // F6.2 — Promemoria giorno prima
  const formatReminderMessage = (event, emp) => {
    let lines = [`Ciao ${emp.name || ''}! 🙌`];
    lines.push(`Piccolo reminder per domani — evento${event.clientName ? ' *' + event.clientName + '*' : ''} 🍹`);
    lines.push(`🕐 Ci vediamo alle *${emp.meetTime || '17:30'}* qui 👇`);
    if (emp.mapsLink) lines.push(`📍 ${emp.mapsLink}`);
    lines.push(`🎉 Inizio servizio: *${emp.startTime || '18:00'}*${event.location ? ' presso *' + event.location + '*' : ''}`);
    lines.push('Se hai bisogno di qualcosa dimmi pure. A domani! 🚀');

    const rawMessage = lines.join('\n');
    window.open(`https://wa.me/${(emp.phone || '').replace(/\D/g, '')}?text=${encodeURIComponent(rawMessage)}`, '_blank');
  };

  const formatDateDisplay = (dateStr) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return dateStr;
  };

  // F3.3 — Copia riepilogo evento negli appunti
  const copyEventSummary = (event) => {
    const confirmed = (event.staff || []).filter(s => s.confirmed);
    let text = `EVENTO: ${event.clientName || '—'} — ${formatDateDisplay(event.date)} — ${event.location || '—'}\n\n`;
    if (confirmed.length === 0) {
      text += 'Nessuno slot confermato ancora.';
    } else {
      text += confirmed.map(s =>
        `${s.name} ${s.surname} · ${s.role} · incontro ${s.meetTime || '17:30'} · inizio ${s.startTime || '18:00'}`
      ).join('\n');
    }
    navigator.clipboard.writeText(text).then(
      () => showToast('Riepilogo copiato 📋'),
      () => showToast('Errore copia ✗')
    );
  };

  const dateCounts = events.reduce((acc, e) => {
    if (e.date) acc[e.date] = (acc[e.date] || 0) + 1;
    return acc;
  }, {});

  const sortedEvents = [...events].sort((a, b) => {
    const da = getEventTiming(a.date).daysDiff;
    const dbb = getEventTiming(b.date).daysDiff;
    if (da === null && dbb === null) return (b.createdAt || 0) - (a.createdAt || 0);
    if (da === null) return 1;
    if (dbb === null) return -1;
    const aPast = da < 0, bPast = dbb < 0;
    if (aPast !== bPast) return aPast ? 1 : -1;
    if (!aPast) {
      if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    } else {
      if (a.date !== b.date) return a.date > b.date ? -1 : 1;
    }
    return (b.createdAt || 0) - (a.createdAt || 0);
  });

  // F3.2 — Ricerca per cliente o location
  const searchedEvents = sortedEvents.filter(e => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return (e.clientName || '').toLowerCase().includes(q) || (e.location || '').toLowerCase().includes(q);
  });

  // F2.3 — Tab Prossimi / Passati
  const upcomingEvents = searchedEvents.filter(e => {
    const d = getEventTiming(e.date).daysDiff;
    return d === null || d >= 0;
  });
  const pastEvents = searchedEvents.filter(e => {
    const d = getEventTiming(e.date).daysDiff;
    return d !== null && d < 0;
  });
  const visibleEvents = eventFilter === 'upcoming' ? upcomingEvents : pastEvents;

  if (authError) return (
    <div className="min-h-screen bg-[#f0f2ef] flex items-center justify-center p-4">
      <div className="bg-red-50 text-red-600 p-6 rounded-2xl max-w-md border border-red-200 shadow-lg text-center">
        <X size={40} className="mx-auto mb-2 text-red-500" />
        <h2 className="font-bold text-lg">Errore Firebase</h2>
        <p className="text-sm mt-2">{authError}</p>
      </div>
    </div>
  );

  if (loading) return (
    <div className="min-h-screen bg-[#f0f2ef] flex flex-col items-center justify-center gap-5">
      <img
        src={LOGO_URL}
        alt="Chic Bar"
        className="h-16 object-contain"
        onError={e => { e.currentTarget.style.display = 'none'; }}
      />
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#385b4f]"></div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#f0f2ef] text-slate-900 pb-24 font-sans" onClick={() => setActiveDropdownId(null)}>
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 px-4 py-3 shadow-sm">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          {logoError ? (
            <h1 className="text-[#385b4f] font-black text-xl tracking-tight">Chic Bar — Staff</h1>
          ) : (
            <img
              src={LOGO_URL}
              alt="Chic Bar — Staff"
              style={{ height: '36px', objectFit: 'contain' }}
              onError={() => setLogoError(true)}
            />
          )}
          <div className="flex gap-2">
            <button
              onClick={(e) => { e.stopPropagation(); openRubrica(); }}
              className="bg-white border-2 border-[#385b4f] text-[#385b4f] px-3 py-2 rounded-xl flex items-center gap-1.5 hover:bg-[#385b4f] hover:text-white transition-all font-bold text-sm"
            >
              <Users size={16} /> <span className="hidden sm:inline">Rubrica</span>
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); openLocRubrica(); }}
              className="bg-white border-2 border-[#385b4f] text-[#385b4f] px-3 py-2 rounded-xl flex items-center gap-1.5 hover:bg-[#385b4f] hover:text-white transition-all font-bold text-sm"
            >
              <MapPin size={16} /> <span className="hidden sm:inline">Location</span>
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
        {/* F3.2 — Barra di ricerca */}
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-9 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#385b4f]/30 shadow-sm"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Cerca per cliente o location..."
            onClick={e => e.stopPropagation()}
          />
          {searchQuery && (
            <button
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              onClick={e => { e.stopPropagation(); setSearchQuery(''); }}
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* F2.3 — Tab Prossimi / Passati */}
        <div className="flex bg-white rounded-xl border border-slate-200 p-1 shadow-sm">
          <button
            className={`flex-1 py-2 rounded-lg text-sm font-bold transition-colors ${eventFilter === 'upcoming' ? 'bg-[#385b4f] text-white shadow' : 'text-slate-500 hover:text-slate-700'}`}
            onClick={e => { e.stopPropagation(); setEventFilter('upcoming'); }}
          >
            Prossimi ({upcomingEvents.length})
          </button>
          <button
            className={`flex-1 py-2 rounded-lg text-sm font-bold transition-colors ${eventFilter === 'past' ? 'bg-[#385b4f] text-white shadow' : 'text-slate-500 hover:text-slate-700'}`}
            onClick={e => { e.stopPropagation(); setEventFilter('past'); }}
          >
            Passati ({pastEvents.length})
          </button>
        </div>

        {visibleEvents.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <Calendar size={48} className="mx-auto mb-3 opacity-30" />
            <p className="font-semibold text-lg">
              {searchQuery ? 'Nessun risultato' : eventFilter === 'past' ? 'Nessun evento passato' : 'Nessun evento'}
            </p>
            <p className="text-sm mt-1">
              {searchQuery ? 'Prova con un altro termine' : 'Clicca "Nuovo Evento" per iniziare'}
            </p>
          </div>
        ) : visibleEvents.map(event => {
          const isExpanded = expandedEvent === event.id;
          const staffFilled = (event.staff || []).filter(s => s.name && s.surname).length;
          const staffTotal = parseInt(event.staffNeeded) || 0;
          const confirmedCount = (event.staff || []).filter(s => s.confirmed).length;
          const sentCount = (event.staff || []).filter(s => s.sent).length;
          const squadraFormata = staffTotal > 0 && confirmedCount === staffTotal;
          const mancaCount = staffTotal - confirmedCount;
          const timing = getEventTiming(event.date);
          const isPast = timing.daysDiff !== null && timing.daysDiff < 0;
          const sameDayCount = dateCounts[event.date] || 0;
          const showDoubleWarning = sameDayCount > 1 && !isPast;
          const totalEstimate = (event.staff || []).reduce((sum, s) => sum + calcSlotEstimate(s), 0);

          const knownVenue = locations.some(l => l.name === event.location);
          const isCustomLoc = event.locationCustom || (!!event.location && !knownVenue);

          return (
            <div key={event.id} className={`bg-white rounded-2xl shadow-md border overflow-hidden ${timing.tone === 'today' ? 'border-red-200' : 'border-slate-100'} ${isPast ? 'opacity-70' : ''}`}>
              {/* Testata evento (sempre visibile) */}
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
                    {/* F6.4 — badge timing su riga separata + warning doppio evento compatto */}
                    {(timing.label || showDoubleWarning) && (
                      <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                        {timing.label && (
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded-full tracking-wide ${timingStyles[timing.tone]}`}>
                            {timing.label}
                          </span>
                        )}
                        {showDoubleWarning && (
                          <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-orange-100 text-orange-600 flex items-center gap-0.5">
                            <AlertTriangle size={10} /> {sameDayCount} eventi
                          </span>
                        )}
                      </div>
                    )}
                    <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
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

              {/* Sezione espansa con TAB */}
              {isExpanded && (
                <div className="border-t border-slate-100">
                  {/* Barra Tab */}
                  <div className="flex border-b border-slate-100">
                    <button
                      className={`flex-1 py-3 text-sm font-bold transition-colors border-b-2 -mb-px ${eventActiveTab === 'staff' ? 'text-[#385b4f] border-[#385b4f]' : 'text-slate-400 border-transparent hover:text-slate-600'}`}
                      onClick={e => { e.stopPropagation(); setEventActiveTab('staff'); }}
                    >
                      👥 Staff {staffTotal > 0 ? `(${confirmedCount}/${staffTotal})` : ''}
                    </button>
                    <button
                      className={`flex-1 py-3 text-sm font-bold transition-colors border-b-2 -mb-px ${eventActiveTab === 'details' ? 'text-[#385b4f] border-[#385b4f]' : 'text-slate-400 border-transparent hover:text-slate-600'}`}
                      onClick={e => { e.stopPropagation(); setEventActiveTab('details'); }}
                    >
                      📋 Dettagli Evento
                    </button>
                  </div>

                  {/* TAB: Dettagli Evento */}
                  {eventActiveTab === 'details' && (
                    <div className="px-4 py-4 space-y-4">
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
                          <select
                            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#385b4f]/30"
                            value={isCustomLoc ? '__custom__' : (knownVenue ? event.location : '')}
                            onClick={e => e.stopPropagation()}
                            onChange={e => {
                              const val = e.target.value;
                              if (val === '__custom__') {
                                updateEvent(event.id, { locationCustom: true, locationMaps: '' });
                              } else if (val === '') {
                                updateEvent(event.id, { location: '', locationMaps: '', locationCustom: false });
                              } else {
                                const venue = locations.find(l => l.name === val);
                                updateEvent(event.id, { location: val, locationMaps: venue ? venue.maps : '', locationCustom: false });
                              }
                            }}
                          >
                            <option value="">— Seleziona —</option>
                            {locations.map(l => <option key={l.name} value={l.name}>{l.name}</option>)}
                            <option value="__custom__">Altro (scrivi a mano)</option>
                          </select>
                          {isCustomLoc && (
                            <input
                              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm mt-2 focus:outline-none focus:ring-2 focus:ring-[#385b4f]/30"
                              value={event.location || ''}
                              onChange={e => updateEvent(event.id, { location: e.target.value })}
                              placeholder="Via, Città"
                              onClick={e => e.stopPropagation()}
                            />
                          )}
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

                      {staffTotal > 0 && (
                        <div className="bg-slate-50 rounded-xl p-3 grid grid-cols-3 gap-2 text-center">
                          <div>
                            <p className="text-lg font-black text-slate-700">{staffTotal}</p>
                            <p className="text-[10px] text-slate-400 font-medium uppercase">Staff totale</p>
                          </div>
                          <div>
                            <p className="text-lg font-black text-amber-600">{sentCount}</p>
                            <p className="text-[10px] text-slate-400 font-medium uppercase">Inviati</p>
                          </div>
                          <div>
                            <p className="text-lg font-black text-green-600">{confirmedCount}</p>
                            <p className="text-[10px] text-slate-400 font-medium uppercase">Confermati</p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* TAB: Staff */}
                  {eventActiveTab === 'staff' && (
                    <div className="px-4 py-4 space-y-3">
                      {(event.staff || []).length === 0 ? (
                        <div className="text-center py-8 text-slate-400">
                          <Users size={32} className="mx-auto mb-2 opacity-30" />
                          <p className="text-sm">Nessuno slot staff.</p>
                          <p className="text-xs mt-1">Vai su "Dettagli Evento" per impostare il numero di staff.</p>
                        </div>
                      ) : (
                        <>
                          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Slot Staff</p>
                          {(event.staff || []).map((emp, idx) => (
                            <StaffSlot
                              key={emp.id}
                              emp={emp}
                              idx={idx}
                              event={event}
                              contacts={contacts}
                              locations={locations}
                              activeDropdownId={activeDropdownId}
                              setActiveDropdownId={setActiveDropdownId}
                              updateStaffMember={updateStaffMember}
                              applyContactToSlot={applyContactToSlot}
                              removeStaffMember={removeStaffMember}
                              formatWhatsAppMessage={formatWhatsAppMessage}
                              formatReminderMessage={formatReminderMessage}
                              formatReminder7daysMessage={formatReminder7daysMessage}
                            />
                          ))}

                          {/* F3.1 — Totale stimato staff */}
                          {totalEstimate > 0 && (
                            <div className="bg-[#e8f0ee] rounded-xl px-4 py-3 text-center">
                              <p className="text-sm font-black text-[#385b4f]">💶 Totale staff stimato: €{formatEuro(totalEstimate)}</p>
                            </div>
                          )}

                          {/* F3.3 — Copia riepilogo */}
                          <button
                            className="w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 bg-white border-2 border-[#385b4f] text-[#385b4f] hover:bg-[#385b4f] hover:text-white active:scale-95 transition-all"
                            onClick={e => { e.stopPropagation(); copyEventSummary(event); }}
                          >
                            <ClipboardCopy size={16} /> 📋 Copia riepilogo
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </main>

      {/* F2.2 — Toast Salvato */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] bg-green-600 text-white text-sm font-bold px-5 py-2.5 rounded-full shadow-lg pointer-events-none">
          {toast}
        </div>
      )}

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

      {isLocRubricaOpen && (
        <div className="fixed inset-0 z-50 flex" onClick={closeLocRubrica}>
          <div className="ml-auto w-full max-w-sm bg-white h-full shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              {locRubricaView === 'list' ? (
                <h2 className="font-black text-lg text-[#385b4f]">Rubrica Location</h2>
              ) : (
                <button onClick={() => setLocRubricaView(locRubricaView === 'form' && currentLocation?.id ? 'detail' : 'list')} className="flex items-center gap-1 text-[#385b4f] font-bold text-sm">
                  <ChevronLeft size={18} /> {locRubricaView === 'form' && currentLocation?.id ? 'Dettaglio' : 'Rubrica'}
                </button>
              )}
              <button onClick={closeLocRubrica} className="text-slate-400 hover:text-slate-600"><X size={22} /></button>
            </div>

            {locRubricaView === 'list' && (
              <>
                <div className="flex-1 overflow-y-auto">
                  {locations.length === 0 ? (
                    <div className="text-center py-12 text-slate-400">
                      <MapPin size={36} className="mx-auto mb-2 opacity-30" />
                      <p className="text-sm">Nessuna location</p>
                    </div>
                  ) : locations.slice().sort((a, b) => (a.name || '').localeCompare(b.name || '')).map(l => (
                    <div key={l.id} className="flex items-center justify-between px-5 py-3 hover:bg-slate-50 border-b border-slate-50">
                      <div className="cursor-pointer flex-1 min-w-0" onClick={() => handleViewLocationClick(l)}>
                        <p className="font-semibold text-sm truncate">{l.name}</p>
                        <p className="text-xs text-slate-400 truncate">{l.maps || 'Nessun link'}</p>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {l.maps && (
                          <a href={l.maps} target="_blank" rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-[#385b4f] hover:text-[#2c473e] p-1.5" title="Apri su Maps">
                            <Map size={16} />
                          </a>
                        )}
                        <ChevronRight size={16} className="text-slate-300" />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="p-4 border-t border-slate-100">
                  <button onClick={handleAddNewLocationClick} className="w-full bg-[#385b4f] text-white rounded-xl py-3 font-bold flex items-center justify-center gap-2 hover:bg-[#2c473e] transition-colors">
                    <Plus size={18} /> Nuova location
                  </button>
                </div>
              </>
            )}

            {locRubricaView === 'detail' && currentLocation && (
              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                <div className="bg-slate-50 rounded-2xl p-4 space-y-3">
                  <div>
                    <p className="text-xs text-slate-400 font-medium">Nome</p>
                    <p className="text-sm font-semibold text-slate-800">{currentLocation.name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 font-medium">Link Maps</p>
                    <p className="text-sm font-semibold text-slate-800 break-all">{currentLocation.maps || '—'}</p>
                  </div>
                </div>
                {currentLocation.maps && (
                  <a href={currentLocation.maps} target="_blank" rel="noopener noreferrer"
                    className="w-full bg-[#385b4f] text-white rounded-xl py-2.5 font-bold text-sm hover:bg-[#2c473e] transition-colors flex items-center justify-center gap-2">
                    <Map size={16} /> Apri su Maps
                  </a>
                )}
                <div className="flex gap-3 pt-1">
                  <button onClick={() => deleteLocation(currentLocation.id)}
                    className="flex-1 border border-red-200 text-red-500 rounded-xl py-2.5 font-medium text-sm hover:bg-red-50 transition-colors flex items-center justify-center gap-1">
                    <Trash2 size={14} /> Elimina
                  </button>
                  <button onClick={handleEditLocationClick}
                    className="flex-1 bg-[#385b4f] text-white rounded-xl py-2.5 font-bold text-sm hover:bg-[#2c473e] transition-colors flex items-center justify-center gap-1">
                    Modifica
                  </button>
                </div>
              </div>
            )}

            {locRubricaView === 'form' && (
              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                <div>
                  <label className="text-xs text-slate-500 font-medium block mb-1">Nome location</label>
                  <input className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#385b4f]/30"
                    value={currentLocation?.name || ''}
                    onChange={e => setCurrentLocation(p => ({ ...p, name: e.target.value }))}
                    placeholder="es. Villa Egea" />
                </div>
                <div>
                  <label className="text-xs text-slate-500 font-medium block mb-1">Link Maps</label>
                  <input className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#385b4f]/30"
                    value={currentLocation?.maps || ''}
                    onChange={e => setCurrentLocation(p => ({ ...p, maps: e.target.value }))}
                    placeholder="Incolla qui il link di Google Maps" />
                </div>
                <div className="flex gap-3 pt-2">
                  <button onClick={saveLocation} disabled={!currentLocation?.name}
                    className="flex-1 bg-[#385b4f] text-white rounded-xl py-2.5 font-bold text-sm hover:bg-[#2c473e] transition-colors disabled:opacity-40">
                    Salva
                  </button>
                </div>
              </div>
            )}
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
                  ) : contacts.slice().sort((a, b) => (a.surname || '').localeCompare(b.surname || '')).map(c => (
                    <div key={c.id} className="flex items-center justify-between px-5 py-3 hover:bg-slate-50 border-b border-slate-50">
                      <div className="cursor-pointer flex-1 min-w-0" onClick={() => handleViewContactClick(c)}>
                        <p className="font-semibold text-sm truncate">{c.surname} {c.name}</p>
                        <p className="text-xs text-slate-400">{c.role} · {c.phone}</p>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {c.phone && (
                          <button
                            onClick={(e) => { e.stopPropagation(); messageContact(c); }}
                            className="text-green-500 hover:text-green-600 p-1.5"
                            title="Scrivi su WhatsApp"
                          >
                            <MessageCircle size={16} />
                          </button>
                        )}
                        <ChevronRight size={16} className="text-slate-300" />
                      </div>
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
                    <p className="text-sm font-semibold text-slate-800">
                      {currentContact.pay ? `${currentContact.pay} (${(currentContact.payType || 'hourly') === 'fixed' ? 'fissa' : '€/h'})` : '—'}
                    </p>
                  </div>
                </div>
                {currentContact.phone && (
                  <button
                    onClick={() => messageContact(currentContact)}
                    className="w-full bg-green-500 text-white rounded-xl py-2.5 font-bold text-sm hover:bg-green-600 transition-colors flex items-center justify-center gap-2"
                  >
                    <MessageCircle size={16} /> Scrivi su WhatsApp
                  </button>
                )}
                <div className="flex gap-3 pt-1">
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
                    onChange={e => setCurrentContact(p => ({ ...p, role: e.target.value, pay: getDefaultPay(e.target.value), payType: getDefaultPayType(e.target.value) }))}>
                    {ROLES.map(r => <option key={r}>{r}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-500 font-medium block mb-1">Paga default</label>
                  <div className="flex gap-2">
                    <input className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#385b4f]/30"
                      value={currentContact?.pay || ''}
                      onChange={e => setCurrentContact(p => ({ ...p, pay: e.target.value }))}
                      placeholder="es. 12/h" />
                    {/* F5.1 — toggle tipo paga */}
                    <div className="flex rounded-xl border border-slate-200 overflow-hidden flex-shrink-0">
                      <button
                        type="button"
                        className={`px-3 text-xs font-bold transition-colors ${(currentContact?.payType || 'hourly') === 'hourly' ? 'bg-[#385b4f] text-white' : 'bg-white text-slate-500'}`}
                        onClick={() => setCurrentContact(p => ({ ...p, payType: 'hourly' }))}
                      >
                        €/h
                      </button>
                      <button
                        type="button"
                        className={`px-3 text-xs font-bold transition-colors ${currentContact?.payType === 'fixed' ? 'bg-[#385b4f] text-white' : 'bg-white text-slate-500'}`}
                        onClick={() => setCurrentContact(p => ({ ...p, payType: 'fixed' }))}
                      >
                        Fissa
                      </button>
                    </div>
                  </div>
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

function StaffSlot({ emp, idx, event, contacts, locations, activeDropdownId, setActiveDropdownId, updateStaffMember, applyContactToSlot, removeStaffMember, formatWhatsAppMessage, formatReminderMessage, formatReminder7daysMessage }) {
  const [isExpanded, setIsExpanded] = useState(false);

  const dropdownId = `${event.id}-${emp.id}`;
  const isDropdownOpen = activeDropdownId === dropdownId;

  const hasName = emp.name && emp.surname;
  const isConfirmed = emp.confirmed;
  const isSent = emp.sent;
  const isEmpty = !hasName;

  // Fase A: ha un nome ma non ancora inviato e non confermato
  // Fase B: inviato, in attesa di conferma
  // Fase C: confermato

  let cardStyle = "border-slate-200 bg-white";
  let headerStyle = "hover:bg-slate-50";
  let badge = null;

  if (isEmpty) {
    cardStyle = "border-slate-300 border-dashed bg-slate-50 opacity-80";
    badge = <span className="text-[10px] font-bold text-slate-400 bg-slate-200 px-2 py-0.5 rounded-md">VUOTO</span>;
  } else if (isConfirmed) {
    cardStyle = "border-green-400 bg-green-50/30 shadow-sm ring-2 ring-green-200/60";
    headerStyle = "bg-green-50/50 hover:bg-green-100/50";
    badge = <span className="text-[10px] font-bold text-green-700 bg-green-200 px-2 py-0.5 rounded-md flex items-center gap-1 flex-shrink-0 whitespace-nowrap"><CheckCircle2 size={12} /> CONFERMATO</span>;
  } else if (isSent) {
    // F2.4 — badge "WA inviato" ben visibile anche a slot collassato
    cardStyle = "border-amber-300 bg-amber-50/30 shadow-sm";
    headerStyle = "bg-amber-50/50 hover:bg-amber-100/50";
    badge = <span className="text-[10px] font-bold text-amber-800 bg-amber-200 px-2 py-0.5 rounded-md flex items-center gap-1 flex-shrink-0 whitespace-nowrap"><Send size={11} /> WA INVIATO</span>;
  } else {
    badge = <span className="text-[10px] font-bold text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md flex-shrink-0 whitespace-nowrap">DA INVIARE</span>;
  }

  const displayName = hasName ? `${emp.surname} ${emp.name}` : 'Slot da assegnare';
  const timeString = `incontro ${emp.meetTime || '17:30'} · fine ${emp.endTime || '02:00'}`;

  // F3.1 — stima paga slot
  const payAmount = parsePayAmount(emp.pay);
  const slotEstimate = calcSlotEstimate(emp);
  const isHourly = (emp.payType || 'hourly') === 'hourly';

  const inputStyle = "w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-[#385b4f] focus:ring-1 focus:ring-[#385b4f] transition-all shadow-inner";
  const labelStyle = "text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block ml-1";
  const sectionTitleStyle = "text-[11px] font-black text-[#385b4f] bg-[#e8f0ee] rounded-lg px-2 py-1 flex items-center gap-1.5";

  return (
    <div className={`border-2 rounded-xl mb-2 transition-all duration-200 ${cardStyle}`}>

      {/* Testata fisarmonica */}
      <div
        className={`flex items-center justify-between p-3.5 cursor-pointer transition-colors rounded-t-xl ${headerStyle} ${isExpanded && !isEmpty ? 'border-b border-slate-200/50' : ''}`}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="min-w-0">
            <p className={`font-black text-sm truncate ${isEmpty ? 'text-slate-400' : 'text-slate-800'}`}>
              {displayName}
            </p>
            <p className="text-[11px] font-medium text-slate-500 truncate mt-0.5">
              <span className={isEmpty ? '' : 'text-[#385b4f] font-bold'}>{emp.role || 'Barman'}</span>
              <span className="mx-1.5 opacity-40">|</span>
              {timeString}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {badge}
          {isExpanded ? <ChevronDown size={18} className="text-slate-400" /> : <ChevronRight size={18} className="text-slate-400" />}
        </div>
      </div>

      {/* Corpo dettagli */}
      {isExpanded && (
        <div className="p-4 space-y-5">

          {/* Selettore rubrica + rimuovi */}
          <div className="flex items-center justify-between pb-2 border-b border-slate-200/50">
            <div className="relative flex-1 mr-3" onClick={e => e.stopPropagation()}>
              <button
                className="w-full bg-white border border-slate-300 shadow-sm rounded-lg px-3 py-2 text-sm text-left flex items-center justify-between hover:border-[#385b4f] transition-colors"
                onClick={e => { e.stopPropagation(); setActiveDropdownId(isDropdownOpen ? null : dropdownId); }}
              >
                <span className={hasName ? 'text-[#385b4f] font-bold' : 'text-slate-500 font-medium'}>
                  {hasName ? '🔄 Cambia da rubrica...' : '🔍 Cerca in rubrica...'}
                </span>
                <ChevronDown size={16} className="text-slate-400" />
              </button>
              {isDropdownOpen && (
                <div className="absolute top-full left-0 right-0 bg-white border border-slate-200 rounded-lg shadow-xl z-30 mt-1 max-h-48 overflow-y-auto">
                  {contacts.length === 0
                    ? <p className="text-xs text-slate-400 p-4 text-center">Nessun contatto</p>
                    : contacts.slice().sort((a, b) => (a.surname || '').localeCompare(b.surname || '')).map(c => (
                      <button key={c.id} className="w-full text-left px-3 py-2.5 hover:bg-slate-50 text-sm border-b border-slate-100 last:border-0"
                        onClick={e => { e.stopPropagation(); applyContactToSlot(event.id, emp.id, c); }}>
                        <span className="font-bold text-slate-700">{c.surname} {c.name}</span>
                        <span className="text-[10px] font-medium text-slate-500 ml-2 bg-slate-200 px-1.5 py-0.5 rounded">{c.role}</span>
                      </button>
                    ))
                  }
                </div>
              )}
            </div>
            <button onClick={e => { e.stopPropagation(); removeStaffMember(event.id, emp.id); }} className="text-red-400 hover:text-red-600 bg-red-50 hover:bg-red-100 p-2 rounded-lg transition-colors" title="Rimuovi Slot">
              <Trash2 size={16} />
            </button>
          </div>

          {/* Anagrafica */}
          <div className="space-y-3">
            <h4 className={sectionTitleStyle}><User size={14} className="text-[#385b4f]"/> ANAGRAFICA</h4>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={labelStyle}>Nome</label><input className={inputStyle} value={emp.name || ''} onChange={e => updateStaffMember(event.id, emp.id, 'name', e.target.value)} onClick={e => e.stopPropagation()}/></div>
              <div><label className={labelStyle}>Cognome</label><input className={inputStyle} value={emp.surname || ''} onChange={e => updateStaffMember(event.id, emp.id, 'surname', e.target.value)} onClick={e => e.stopPropagation()}/></div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><label className={labelStyle}>Telefono (WhatsApp)</label><input className={inputStyle} value={emp.phone || ''} onChange={e => updateStaffMember(event.id, emp.id, 'phone', e.target.value)} placeholder="39333..." onClick={e => e.stopPropagation()}/></div>
              <div>
                <label className={labelStyle}>Ruolo</label>
                <select className={inputStyle} value={emp.role || 'Barman'} onChange={e => updateStaffMember(event.id, emp.id, 'role', e.target.value)} onClick={e => e.stopPropagation()}>
                  {['Barman','Cameriere','Aiuto Barman','Videomaker','Responsabile','Altro'].map(r => <option key={r}>{r}</option>)}
                </select>
              </div>
            </div>
            {/* F5.1 — paga con toggle €/h ↔ Fissa + F3.1 stima */}
            <div onClick={e => e.stopPropagation()}>
              <label className={labelStyle}>Paga</label>
              <div className="flex gap-2">
                <input className={`w-24 ${inputStyle} text-center`} value={emp.pay || ''} onChange={e => updateStaffMember(event.id, emp.id, 'pay', e.target.value)} placeholder="10/h" />
                <div className="flex rounded-lg border border-slate-200 overflow-hidden">
                  <button
                    type="button"
                    className={`px-3 text-xs font-bold transition-colors ${isHourly ? 'bg-[#385b4f] text-white' : 'bg-white text-slate-500'}`}
                    onClick={e => { e.stopPropagation(); updateStaffMember(event.id, emp.id, 'payType', 'hourly'); }}
                  >
                    €/h
                  </button>
                  <button
                    type="button"
                    className={`px-3 text-xs font-bold transition-colors ${!isHourly ? 'bg-[#385b4f] text-white' : 'bg-white text-slate-500'}`}
                    onClick={e => { e.stopPropagation(); updateStaffMember(event.id, emp.id, 'payType', 'fixed'); }}
                  >
                    Fissa
                  </button>
                </div>
              </div>
              {payAmount > 0 && (
                <p className="text-[11px] font-bold text-[#385b4f] mt-1 ml-1">
                  {isHourly ? `Stima: €${formatEuro(slotEstimate)} totali` : `€${formatEuro(payAmount)} fissi`}
                </p>
              )}
            </div>
          </div>

          {/* Tempi e luogo */}
          <div className="space-y-3 pt-2">
            <h4 className={sectionTitleStyle}><Clock size={14} className="text-[#385b4f]"/> TEMPI E LUOGO</h4>
            <div onClick={e => e.stopPropagation()}>
              <label className={labelStyle}>Data</label>
              <input type="date" className={inputStyle} value={emp.date || event.date || ''} onChange={e => updateStaffMember(event.id, emp.id, 'date', e.target.value)} />
            </div>
            {/* F5.2 — tre orari: incontro / inizio evento / fine */}
            <div className="grid grid-cols-3 gap-3">
              <div onClick={e => e.stopPropagation()}>
                <label className={labelStyle}>Orario incontro</label>
                <input type="time" className={inputStyle} value={emp.meetTime || '17:30'} onChange={e => updateStaffMember(event.id, emp.id, 'meetTime', e.target.value)} />
              </div>
              <div onClick={e => e.stopPropagation()}>
                <label className={labelStyle}>Inizio evento</label>
                <input type="time" className={inputStyle} value={emp.startTime || '18:00'} onChange={e => updateStaffMember(event.id, emp.id, 'startTime', e.target.value)} />
              </div>
              <div onClick={e => e.stopPropagation()}>
                <label className={labelStyle}>Fine</label>
                <input type="time" className={inputStyle} value={emp.endTime || '02:00'} onChange={e => updateStaffMember(event.id, emp.id, 'endTime', e.target.value)} />
              </div>
            </div>
            <div onClick={e => e.stopPropagation()}>
              <label className={labelStyle}>Link Maps (Posizione)</label>
              <div className="flex gap-2">
                <select className="w-1/3 bg-slate-50 border border-slate-200 rounded-lg px-2 py-2 text-[11px] font-bold text-[#385b4f] focus:outline-none focus:border-[#385b4f]"
                  value="" onChange={e => { if (e.target.value) updateStaffMember(event.id, emp.id, 'mapsLink', e.target.value); }}>
                  <option value="">📍 Copia da...</option>
                  {event.locationMaps && <option value={event.locationMaps}>Evento</option>}
                  {(locations || []).map(l => l.maps && <option key={l.id} value={l.maps}>{l.name}</option>)}
                </select>
                <input className={`w-2/3 ${inputStyle}`} value={emp.mapsLink || ''} onChange={e => updateStaffMember(event.id, emp.id, 'mapsLink', e.target.value)} placeholder="https://maps.google.com/..." />
              </div>
            </div>
          </div>

          {/* Info operative */}
          <div className="space-y-3 pt-2">
            <h4 className={sectionTitleStyle}><List size={14} className="text-[#385b4f]"/> INFO OPERATIVE</h4>
            <div>
              <label className={labelStyle}>Divisa Richiesta</label>
              <select className={inputStyle} value={emp.uniformColor || ''} onChange={e => updateStaffMember(event.id, emp.id, 'uniformColor', e.target.value)} onClick={e => e.stopPropagation()}>
                {['Nera (Camicia nera, pantaloni neri)','Bianca (Camicia bianca, pantaloni neri)','Elegante (Giacca, camicia bianca)','Casual (A scelta)'].map(u => <option key={u}>{u}</option>)}
              </select>
            </div>
            {emp.role === 'Barman' && (
              <div>
                <label className={labelStyle}>Drink List</label>
                <input className={inputStyle} value={emp.drinkList || ''} onChange={e => updateStaffMember(event.id, emp.id, 'drinkList', e.target.value)} placeholder="URL menu o lista drink" onClick={e => e.stopPropagation()}/>
              </div>
            )}
            <div>
              <label className={labelStyle}>Note Extra</label>
              <input className={inputStyle} value={emp.notes || ''} onChange={e => updateStaffMember(event.id, emp.id, 'notes', e.target.value)} placeholder="Es: Porta ghiaccio, pinze..." onClick={e => e.stopPropagation()}/>
            </div>
          </div>

          {/* ==============================
              PULSANTIERA — FASI A / B / C
          ============================== */}
          {hasName && (
            <div className="pt-4 mt-2 border-t border-slate-200">

              {/* FASE A — DA INVIARE: unico mega-pulsante verde WhatsApp */}
              {!isSent && !isConfirmed && (
                <button
                  className="w-full py-5 rounded-2xl text-white font-black text-lg flex items-center justify-center gap-3 shadow-xl active:scale-95 transition-transform disabled:opacity-40"
                  style={{ backgroundColor: '#25D366', fontSize: '18px', boxShadow: '0 4px 20px rgba(37,211,102,0.45)' }}
                  disabled={!emp.phone}
                  onClick={e => { e.stopPropagation(); formatWhatsAppMessage(event, emp); updateStaffMember(event.id, emp.id, 'sent', true); }}
                >
                  <MessageCircle size={28} /> INVIA SU WHATSAPP
                </button>
              )}

              {/* FASE B — IN ATTESA: banner giallo + Conferma + Reinvia */}
              {isSent && !isConfirmed && (
                <div className="space-y-3">
                  <div className="bg-amber-50 border border-amber-300 rounded-xl px-4 py-3 text-center">
                    <p className="text-amber-800 font-black text-sm">⏳ In attesa di conferma dal dipendente</p>
                    <p className="text-amber-600 text-xs mt-0.5">Appena ti risponde, segna qui sotto</p>
                  </div>
                  <button
                    className="w-full py-4 rounded-xl text-white font-black text-base flex items-center justify-center gap-2 shadow-md active:scale-95 transition-transform"
                    style={{ backgroundColor: '#385b4f' }}
                    onClick={e => { e.stopPropagation(); updateStaffMember(event.id, emp.id, 'confirmed', true); }}
                  >
                    ✅ SEGNA CONFERMATO
                  </button>
                  <button
                    className="w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 bg-slate-200 text-slate-600 hover:bg-slate-300 active:scale-95 transition-all disabled:opacity-40"
                    disabled={!emp.phone}
                    onClick={e => { e.stopPropagation(); formatWhatsAppMessage(event, emp); }}
                  >
                    🔄 Reinvia Info
                  </button>
                </div>
              )}

              {/* FASE C — CONFERMATO: reinvia grigio + promemoria 7gg + promemoria domani */}
              {isConfirmed && (
                <div className="space-y-2">
                  <button
                    className="w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 bg-white border-2 border-slate-200 text-slate-500 hover:bg-slate-50 active:scale-95 transition-all disabled:opacity-40"
                    disabled={!emp.phone}
                    onClick={e => { e.stopPropagation(); formatWhatsAppMessage(event, emp); }}
                  >
                    🔄 Reinvia Info
                  </button>
                  <button
                    className="w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-40"
                    style={{ backgroundColor: '#f59e0b', color: 'white' }}
                    disabled={!emp.phone}
                    onClick={e => { e.stopPropagation(); formatReminder7daysMessage(event, emp); }}
                  >
                    <Bell size={16} /> 📱 Promemoria -7gg
                  </button>
                  <button
                    className="w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-40"
                    style={{ backgroundColor: '#f97316', color: 'white' }}
                    disabled={!emp.phone}
                    onClick={e => { e.stopPropagation(); formatReminderMessage(event, emp); }}
                  >
                    <Bell size={16} /> 📱 Promemoria Domani
                  </button>
                </div>
              )}

            </div>
          )}

        </div>
      )}
    </div>
  );
}

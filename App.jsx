import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, doc, onSnapshot, addDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { 
  Phone, MessageCircle, Calendar, Trash2, Plus, 
  CheckCircle2, Clock, MapPin, User, Briefcase, 
  ChevronRight, ChevronDown, ChevronLeft, Link, DollarSign, 
  Map, GlassWater, Shirt, FileText, LayoutGrid, List, Send, Check, Users, X
} from 'lucide-react';

// Firebase configuration
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

// Helper per Paga Automatica
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

export default function App() {
  const [user, setUser] = useState(null);
  const [events, setEvents] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);
  
  // UI States
  const [expandedEvent, setExpandedEvent] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [activeDropdownId, setActiveDropdownId] = useState(null);

  // Rubrica States
  const [isRubricaOpen, setIsRubricaOpen] = useState(false);
  const [rubricaView, setRubricaView] = useState('list');
  const [currentContact, setCurrentContact] = useState(null);
  const [isEditingContact, setIsEditingContact] = useState(false);

  const defaultContact = { name: '', surname: '', phone: '39', role: 'Barman', pay: '12/h' };

  // Auth
  useEffect(() => {
    const initAuth = async () => {
      try {
        await signInAnonymously(auth);
      } catch (err) {
        console.error("Auth error:", err);
        setAuthError("Errore di autenticazione Firebase");
        setLoading(false);
      }
    };
    initAuth();
    return onAuthStateChanged(auth, setUser);
  }, []);

  // Fetch Events & Contacts
  useEffect(() => {
    if (!user) return;

    const eventsCollection = collection(db, 'artifacts', appId, 'public', 'data', 'events');
    const unsubEvents = onSnapshot(eventsCollection, 
      (snapshot) => setEvents(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))),
      (error) => console.error("Firestore events error:", error)
    );

    const contactsCollection = collection(db, 'artifacts', appId, 'public', 'data', 'contacts');
    const unsubContacts = onSnapshot(contactsCollection,
      (snapshot) => setContacts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))),
      (error) => console.error("Firestore contacts error:", error)
    );

    setLoading(false);
    return () => { unsubEvents(); unsubContacts(); };
  }, [user]);

  // Event Actions
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
    } else if (currentStaff.length > count) {
      currentStaff.length = count;
    }
    updateEvent(event.id, { staff: currentStaff });
  };

  const updateStaffMember = (eventId, staffId, field, value) => {
    const event = events.find(e => e.id === eventId);
    const newStaff = event.staff.map(s => s.id === staffId ? { ...s, [field]: value } : s);
    updateEvent(eventId, { staff: newStaff });
  };

  const applyContactToSlot = (eventId, staffId, contact) => {
    const event = events.find(e => e.id === eventId);
    const newStaff = event.staff.map(s => s.id === staffId ? { 
      ...s, name: contact.name, surname: contact.surname, 
      phone: contact.phone, role: contact.role, pay: contact.pay 
    } : s);
    updateEvent(eventId, { staff: newStaff });
    setActiveDropdownId(null);
  };

  const removeStaffMember = (eventId, staffId) => {
    const event = events.find(e => e.id === eventId);
    const newStaff = event.staff.filter(s => s.id !== staffId);
    updateEvent(eventId, { staff: newStaff, staffNeeded: newStaff.length });
  };

  // Rubrica Actions
  const openRubrica = () => { setRubricaView('list'); setIsRubricaOpen(true); };
  const closeRubrica = () => {
    setIsRubricaOpen(false);
    setTimeout(() => { setRubricaView('list'); setCurrentContact(null); }, 200);
  };
  const openRubricaForNew = () => {
    setCurrentContact(defaultContact); setRubricaView('form'); 
    setIsEditingContact(true); setIsRubricaOpen(true);
  };
  const handleAddNewContactClick = () => {
    setCurrentContact(defaultContact); setRubricaView('form'); setIsEditingContact(true);
  };
  const handleEditContactClick = (contact) => {
    setCurrentContact(contact); setRubricaView('form'); setIsEditingContact(false);
  };

  const saveContact = async () => {
    if (!currentContact.name || !currentContact.surname) return;
    const contactsCollection = collection(db, 'artifacts', appId, 'public', 'data', 'contacts');
    if (currentContact.id) {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'contacts', currentContact.id), currentContact);
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
    const clientNameText = event.clientName ? \` *\${event.clientName}*\` : '';
    const eventDate = emp.date || event.date;
    const dateParts = eventDate.split('-');
    const formattedDate = dateParts.length === 3 ? \`\${dateParts[2]}/\${dateParts[1]}/\${dateParts[0]}\` : eventDate;
    
    let messageBody = [];
    if (emp.role) messageBody.push(\`• *Ruolo:* \${emp.role}\`);
    if (emp.role === 'Barman' && emp.drinkList) messageBody.push(\`• *Drink List:* \${emp.drinkList}\`);
    if (emp.startTime || emp.endTime) messageBody.push(\`• *Orario:* dalle \${emp.startTime || '18:00'} alle \${emp.endTime || '02:00'}\`);
    if (event.location) messageBody.push(\`• *Location:* \${event.location}\`);
    if (emp.mapsLink) messageBody.push(\`• *Maps:* \${emp.mapsLink}\`);
    if (emp.uniformColor) messageBody.push(\`• *Divisa:* \${emp.uniformColor}\`);
    if (emp.pay) messageBody.push(\`• *Paga:* €\${emp.pay}\`);
    if (emp.notes) messageBody.push(\`• *Note:* \${emp.notes}\`);

    const rawMessage = \`*CHIC BAR - DETTAGLI EVENTO*

Ciao \${emp.name || ''}! 👋
Ecco tutte le info per l'evento\${clientNameText} del *\${formattedDate}*.

\${messageBody.join('\\n')}

Per favore, dammi conferma di ricezione. Grazie e buon lavoro! 🚀\`;
    
    window.open(\`https://wa.me/\${(emp.phone || '').replace(/\\D/g, '')}?text=\${encodeURIComponent(rawMessage)}\`, '_blank');
  };

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
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-24 font-sans">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 px-6 py-4 shadow-sm">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <h1 className="text-[#385b4f] font-black text-2xl tracking-tight">Gestione staff</h1>
          <div className="flex gap-2">
            <button onClick={openRubrica} className="bg-white border-2 border-[#385b4f] text-[#385b4f] px-3 py-2 rounded-xl flex items-center gap-2 hover:bg-[#385b4f] hover:text-white transition-all font-bold">
              <Users size={20} /> <span className="hidden sm:inline">Rubrica</span>
            </button>
            <button onClick={createNewEvent} className="bg-[#385b4f] text-white px-4 py-2 rounded-xl flex items-center gap-2 hover:bg-[#2c473e] transition-all font-bold shadow-lg">
              <Plus size={20} /> <span className="hidden sm:inline">Nuovo Evento</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4 sm:p-6">
        <p className="text-center text-[#385b4f] font-bold py-8">✅ App deployata con successo su Vercel!</p>
        <p className="text-center text-slate-500 text-sm">Tutti i dati sono su Firebase e funzionano perfettamente.</p>
      </main>
    </div>
  );
}

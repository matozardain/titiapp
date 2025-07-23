import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, collection, query, onSnapshot, updateDoc, arrayUnion } from 'firebase/firestore';

// Configuración de Firebase - ¡IMPORTANTE! No modificar directamente aquí.
// Estas variables son proporcionadas por el entorno de Canvas.
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

// Inicializa Firebase fuera del componente para evitar reinicializaciones
let app;
let db;
let auth;

// PIN fijo para la edición de medicamentos (solo para demostración)
const EDIT_PIN = "1234";

function App() {
    const [userId, setUserId] = useState(null);
    const [userName, setUserName] = useState('');
    const [isAuthReady, setIsAuthReady] = useState(false);
    const [currentDate, setCurrentDate] = useState(new Date());
    const [medicationSchedule, setMedicationSchedule] = useState({}); // Estado de toma diaria
    const [pressureReadings, setPressureReadings] = useState({ morning: '', evening: '' });
    const [dailyNotes, setDailyNotes] = useState('');
    const [selectedDateData, setSelectedDateData] = useState(null);
    const [showCalendar, setShowCalendar] = useState(false);
    const [showUserModal, setShowUserModal] = useState(false);
    const [loading, setLoading] = useState(true);

    // Nuevos estados para la edición de medicamentos
    const [isEditingMedications, setIsEditingMedications] = useState(false);
    const [showPinModal, setShowPinModal] = useState(false);
    const [pinInput, setPinInput] = useState('');
    const [pinError, setPinError] = useState('');
    const [medicationDefinitions, setMedicationDefinitions] = useState([]); // Definiciones de medicamentos

    // Estados para el formulario de añadir/editar medicamento
    const [editingMedId, setEditingMedId] = useState(null); // ID del medicamento que se está editando
    const [newMedName, setNewMedName] = useState('');
    const [newMedDose, setNewMedDose] = useState('');
    const [newMedTimeOfDay, setNewMedTimeOfDay] = useState('');
    const [newMedFrequency, setNewMedFrequency] = useState(''); // Para B12 y Vitamina D

    // Efecto para inicializar Firebase y manejar la autenticación
    useEffect(() => {
        const initializeFirebase = async () => {
            try {
                if (!app) {
                    app = initializeApp(firebaseConfig);
                    db = getFirestore(app);
                    auth = getAuth(app);
                }

                // Escuchar cambios en el estado de autenticación
                const unsubscribe = onAuthStateChanged(auth, async (user) => {
                    if (user) {
                        setUserId(user.uid);
                        // Intentar cargar el nombre de usuario
                        const userDocRef = doc(db, `artifacts/${appId}/users/${user.uid}/profile`, 'userProfile');
                        const userDocSnap = await getDoc(userDocRef);
                        if (userDocSnap.exists()) {
                            setUserName(userDocSnap.data().name);
                        } else {
                            setShowUserModal(true); // Mostrar modal si el nombre no está configurado
                        }
                    } else {
                        // Si no hay usuario, intentar iniciar sesión con el token inicial o anónimamente
                        if (initialAuthToken) {
                            await signInWithCustomToken(auth, initialAuthToken);
                        } else {
                            await signInAnonymously(auth);
                        }
                    }
                    setIsAuthReady(true);
                    setLoading(false);
                });

                return () => unsubscribe(); // Limpiar el listener al desmontar
            } catch (error) {
                console.error("Error initializing Firebase or authenticating:", error);
                setLoading(false);
            }
        };

        initializeFirebase();
    }, []);

    // Efecto para cargar las definiciones de medicamentos
    useEffect(() => {
        if (db && isAuthReady) {
            const medDefsRef = doc(db, `artifacts/${appId}/public/data/medicationDefinitions`, 'currentDefinitions');
            const unsubscribe = onSnapshot(medDefsRef, (docSnap) => {
                if (docSnap.exists() && docSnap.data().medications) {
                    setMedicationDefinitions(docSnap.data().medications);
                } else {
                    // Si no hay definiciones, cargar las iniciales y guardarlas
                    const initial = [
                        { id: 'T4', name: 'T4', dose: '30 min previos al desayuno', timeOfDay: 'Ayunas', frequency: 'daily' },
                        { id: 'Levecom_morning', name: 'Levecom', dose: '1 pastilla', timeOfDay: 'Mañana Post Desayuno', frequency: 'daily' },
                        { id: 'Deslefex', name: 'Deslefex', dose: '1 pastilla', timeOfDay: 'Mañana Post Desayuno', frequency: 'daily' },
                        { id: 'Lukast', name: 'Lukast', dose: '1 pastilla', timeOfDay: 'Mañana Post Desayuno', frequency: 'daily' },
                        { id: 'Hidrotisona_morning', name: 'Hidrotisona', dose: '1 pastilla de 10mg', timeOfDay: 'Mañana Post Desayuno', frequency: 'daily' },
                        { id: 'Valsartan', name: 'Valsartan', dose: '1 pastilla de 160mg', timeOfDay: 'Mañana Post Desayuno', frequency: 'daily' },
                        { id: 'Amlodipina', name: 'Amlodipina', dose: '1/2 pastilla de 5mg', timeOfDay: 'Mañana Post Desayuno', frequency: 'daily' },
                        { id: 'Dexlansoprazol', name: 'Dexlansoprazol', dose: '1 pastilla', timeOfDay: 'Mañana Post Desayuno', frequency: 'daily' },
                        { id: 'Hidrotisona_lunch', name: 'Hidrotisona', dose: '1 pastilla', timeOfDay: 'Antes de Comer', frequency: 'daily' },
                        { id: 'B12', name: 'B12', dose: 'Sublingual', timeOfDay: 'Antes de Comer', frequency: 'weekly', days: ['Martes', 'Jueves', 'Sábado'] },
                        { id: 'Hidrotisona_evening', name: 'Hidrotisona', dose: '1/2 pastilla', timeOfDay: 'Tarde', frequency: 'daily' },
                        { id: 'Levecom_night', name: 'Levecom', dose: '1 pastilla', timeOfDay: 'Noche', frequency: 'daily' },
                        { id: 'NovoInsomnium', name: 'Novo Insomnium', dose: '1 pastilla', timeOfDay: 'Noche', frequency: 'daily' },
                        { id: 'Reorex', name: 'Reorex', dose: '1 pastilla de 10mg', timeOfDay: 'Noche', frequency: 'daily' },
                        { id: 'VitaminaD', name: 'Vitamina D', dose: '1 vez por mes', timeOfDay: 'Último Martes del Mes', frequency: 'monthly_last_tuesday' }
                    ];
                    setMedicationDefinitions(initial);
                    // Intentar guardar estas definiciones iniciales en Firestore
                    setDoc(medDefsRef, { medications: initial }, { merge: true })
                        .then(() => console.log("Definiciones iniciales de medicamentos guardadas."))
                        .catch(error => console.error("Error al guardar definiciones iniciales de medicamentos:", error));
                }
            }, (error) => {
                console.error("Error fetching medication definitions:", error);
            });
            return () => unsubscribe();
        }
    }, [db, isAuthReady]);


    // Efecto para cargar datos del día seleccionado cuando userId y db estén listos
    useEffect(() => {
        if (userId && db && isAuthReady && medicationDefinitions.length > 0) { // Asegurarse de que las definiciones de medicamentos estén cargadas
            const formattedDate = currentDate.toISOString().split('T')[0]; // YYYY-MM-DD
            const docRef = doc(db, `artifacts/${appId}/public/data/dailyRecords`, formattedDate);

            const unsubscribe = onSnapshot(docRef, (docSnap) => {
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    setSelectedDateData(data);
                    // Asegurarse de que medicationSchedule se inicialice correctamente para todos los medicamentos definidos
                    const currentDayMedSchedule = data.medicationSchedule || {};
                    const updatedMedSchedule = {};
                    medicationDefinitions.forEach(medDef => {
                        updatedMedSchedule[medDef.id] = currentDayMedSchedule[medDef.id] || { taken: false, takenBy: null, takenAt: null };
                    });
                    setMedicationSchedule(updatedMedSchedule);
                    setPressureReadings(data.pressureReadings || { morning: '', evening: '' });
                    setDailyNotes(data.dailyNotes || '');
                } else {
                    setSelectedDateData(null);
                    // Inicializar medicationSchedule con todas las definiciones como no tomadas
                    const initialDayMedSchedule = {};
                    medicationDefinitions.forEach(medDef => {
                        initialDayMedSchedule[medDef.id] = { taken: false, takenBy: null, takenAt: null };
                    });
                    setMedicationSchedule(initialDayMedSchedule);
                    setPressureReadings({ morning: '', evening: '' });
                    setDailyNotes('');
                }
            }, (error) => {
                console.error("Error fetching daily data:", error);
            });

            return () => unsubscribe(); // Limpiar el listener
        }
    }, [userId, db, isAuthReady, currentDate, medicationDefinitions]); // Dependencia de medicationDefinitions

    // Función para guardar el nombre de usuario
    const saveUserName = async () => {
        if (userId && db && userName.trim() !== '') {
            try {
                const userDocRef = doc(db, `artifacts/${appId}/users/${userId}/profile`, 'userProfile');
                await setDoc(userDocRef, { name: userName }, { merge: true });
                setShowUserModal(false);
            } catch (error) {
                console.error("Error saving user name:", error);
            }
        }
    };

    // Función para manejar el cambio de fecha en el calendario
    const handleDateChange = (date) => {
        setCurrentDate(date);
        setShowCalendar(false); // Ocultar calendario después de seleccionar fecha
    };

    // Función para guardar los datos del día
    const saveDailyData = async () => {
        if (userId && db) {
            try {
                const formattedDate = currentDate.toISOString().split('T')[0];
                const docRef = doc(db, `artifacts/${appId}/public/data/dailyRecords`, formattedDate);

                await setDoc(docRef, {
                    medicationSchedule,
                    pressureReadings,
                    dailyNotes,
                    lastUpdatedBy: userName, // Quién hizo la última actualización
                    lastUpdatedAt: new Date().toISOString()
                }, { merge: true }); // Usar merge para no sobrescribir todo el documento

                console.log("Datos guardados exitosamente.");
            } catch (error) {
                console.error("Error al guardar los datos:", error);
            }
        }
    };

    // Función para marcar una medicación como tomada
    const toggleMedicationTaken = (medicationKey) => {
        setMedicationSchedule(prev => ({
            ...prev,
            [medicationKey]: {
                ...prev[medicationKey],
                taken: !prev[medicationKey]?.taken,
                takenBy: !prev[medicationKey]?.taken ? userName : null, // Registrar quién lo tomó
                takenAt: !prev[medicationKey]?.taken ? new Date().toISOString() : null // Registrar cuándo lo tomó
            }
        }));
    };

    // Lógica para verificar el PIN
    const handlePinSubmit = () => {
        if (pinInput === EDIT_PIN) {
            setIsEditingMedications(true);
            setShowPinModal(false);
            setPinError('');
            setPinInput(''); // Limpiar el PIN
        } else {
            setPinError('PIN incorrecto. Inténtalo de nuevo.');
        }
    };

    // Función para iniciar la edición de un medicamento existente
    const startEditMedication = (med) => {
        setEditingMedId(med.id);
        setNewMedName(med.name);
        setNewMedDose(med.dose);
        setNewMedTimeOfDay(med.timeOfDay);
        setNewMedFrequency(med.frequency === 'weekly' && med.days ? med.days.join(', ') : med.frequency);
    };

    // Función para añadir o actualizar un medicamento
    const saveMedicationDefinition = async () => {
        if (newMedName.trim() === '' || newMedDose.trim() === '' || newMedTimeOfDay.trim() === '') {
            alert('Por favor, completa todos los campos del medicamento.');
            return;
        }

        let updatedMedications = [...medicationDefinitions];
        const newId = editingMedId || `med_${Date.now()}`; // Generar un ID único si es nuevo

        const newMed = {
            id: newId,
            name: newMedName.trim(),
            dose: newMedDose.trim(),
            timeOfDay: newMedTimeOfDay.trim(),
            frequency: newMedFrequency.includes(',') ? 'weekly' : (newMedFrequency || 'daily'),
            days: newMedFrequency.includes(',') ? newMedFrequency.split(',').map(d => d.trim()) : undefined
        };

        if (editingMedId) {
            // Actualizar existente
            updatedMedications = updatedMedications.map(med =>
                med.id === editingMedId ? newMed : med
            );
        } else {
            // Añadir nuevo
            updatedMedications.push(newMed);
        }

        try {
            const medDefsRef = doc(db, `artifacts/${appId}/public/data/medicationDefinitions`, 'currentDefinitions');
            await setDoc(medDefsRef, { medications: updatedMedations }, { merge: true });
            setMedicationDefinitions(updatedMedications); // Actualizar el estado local
            resetMedicationForm();
        } catch (error) {
            console.error("Error saving medication definition:", error);
            alert("Hubo un error al guardar el medicamento.");
        }
    };

    // Función para eliminar un medicamento
    const deleteMedicationDefinition = async (medId) => {
        // Reemplazar confirm() con un modal personalizado para mejor UX
        const confirmed = window.confirm('¿Estás seguro de que quieres eliminar este medicamento?');
        if (!confirmed) {
            return;
        }
        const updatedMedications = medicationDefinitions.filter(med => med.id !== medId);
        try {
            const medDefsRef = doc(db, `artifacts/${appId}/public/data/medicationDefinitions`, 'currentDefinitions');
            await setDoc(medDefsRef, { medications: updatedMedications }, { merge: true });
            setMedicationDefinitions(updatedMedications); // Actualizar el estado local
        } catch (error) {
            console.error("Error deleting medication definition:", error);
            alert("Hubo un error al eliminar el medicamento.");
        }
    };

    // Función para resetear el formulario de medicamento
    const resetMedicationForm = () => {
        setEditingMedId(null);
        setNewMedName('');
        setNewMedDose('');
        setNewMedTimeOfDay('');
        setNewMedFrequency('');
    };

    // Función para filtrar medicamentos por momento del día
    const getMedicationsByTime = (timeOfDay) => {
        const currentDayOfWeek = currentDate.toLocaleDateString('es-ES', { weekday: 'long' }).split(',')[0]; // Ej: "Martes"
        const currentDayOfMonth = currentDate.getDate();
        const currentMonth = currentDate.getMonth(); // 0-11

        return medicationDefinitions.filter(med => {
            if (med.timeOfDay !== timeOfDay) return false;

            if (med.frequency === 'weekly') {
                return med.days && med.days.includes(currentDayOfWeek);
            }
            if (med.frequency === 'monthly_last_tuesday') {
                // Lógica para el último martes del mes
                const lastDayOfMonth = new Date(currentDate.getFullYear(), currentMonth + 1, 0).getDate();
                const lastTuesdayDate = new Date(currentDate.getFullYear(), currentMonth, lastDayOfMonth);
                while (lastTuesdayDate.getDay() !== 2) { // 2 para martes
                    lastTuesdayDate.setDate(lastTuesdayDate.getDate() - 1);
                }
                return currentDate.toDateString() === lastTuesdayDate.toDateString();
            }
            return true; // daily o sin frecuencia específica
        });
    };

    // Renderizado condicional mientras carga la autenticación
    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-100">
                <p className="text-lg text-gray-700">Cargando aplicación...</p>
            </div>
        );
    }

    // Modal para el nombre de usuario
    const UserModal = () => (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-sm">
                <h2 className="text-xl font-bold mb-4 text-gray-800">Bienvenido/a</h2>
                <p className="mb-4 text-gray-700">Por favor, ingresa tu nombre para que podamos identificarte en el historial de medicación.</p>
                <input
                    type="text"
                    className="w-full p-3 border border-gray-300 rounded-md mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Tu nombre"
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                />
                <button
                    onClick={saveUserName}
                    className="w-full bg-blue-600 text-white py-3 rounded-md font-semibold hover:bg-blue-700 transition duration-200"
                    disabled={userName.trim() === ''}
                >
                    Guardar Nombre
                </button>
            </div>
        </div>
    );

    // Modal para el PIN
    const PinModal = () => (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-sm">
                <h2 className="text-xl font-bold mb-4 text-gray-800">Ingresar PIN de Edición</h2>
                <input
                    type="password"
                    className="w-full p-3 border border-gray-300 rounded-md mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="PIN"
                    value={pinInput}
                    onChange={(e) => setPinInput(e.target.value)}
                    onKeyPress={(e) => { if (e.key === 'Enter') handlePinSubmit(); }}
                />
                {pinError && <p className="text-red-500 text-sm mb-4">{pinError}</p>}
                <div className="flex justify-end space-x-2">
                    <button
                        onClick={() => { setShowPinModal(false); setPinInput(''); setPinError(''); }}
                        className="px-4 py-2 bg-gray-300 text-gray-800 rounded-md hover:bg-gray-400 transition duration-200"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handlePinSubmit}
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition duration-200"
                    >
                        Confirmar
                    </button>
                </div>
            </div>
        </div>
    );

    // Componente de calendario simple
    const SimpleCalendar = ({ onSelectDate, selectedDate }) => {
        const [displayMonth, setDisplayMonth] = useState(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1));

        const daysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
        const firstDayOfMonth = (year, month) => new Date(year, month, 1).getDay(); // 0 for Sunday, 1 for Monday

        const renderDays = () => {
            const days = [];
            const totalDays = daysInMonth(displayMonth.getFullYear(), displayMonth.getMonth());
            const startDay = firstDayOfMonth(displayMonth.getFullYear(), displayMonth.getMonth());

            // Fill leading empty cells
            for (let i = 0; i < startDay; i++) {
                days.push(<div key={`empty-${i}`} className="p-2 text-center text-gray-400"></div>);
            }

            // Fill days of the month
            for (let i = 1; i <= totalDays; i++) {
                const date = new Date(displayMonth.getFullYear(), displayMonth.getMonth(), i);
                const isSelected = selectedDate.toDateString() === date.toDateString();
                const isToday = new Date().toDateString() === date.toDateString();
                days.push(
                    <button
                        key={i}
                        onClick={() => onSelectDate(date)}
                        className={`p-2 rounded-md text-center font-medium transition duration-200
                                    ${isSelected ? 'bg-blue-600 text-white' : 'hover:bg-blue-100'}
                                    ${isToday && !isSelected ? 'border-2 border-blue-500' : ''}`}
                    >
                        {i}
                    </button>
                );
            }
            return days;
        };

        const goToPreviousMonth = () => {
            setDisplayMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
        };

        const goToNextMonth = () => {
            setDisplayMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
        };

        const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
        const dayNames = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

        return (
            <div className="bg-white p-4 rounded-lg shadow-lg max-w-md mx-auto">
                <div className="flex justify-between items-center mb-4">
                    <button onClick={goToPreviousMonth} className="p-2 rounded-full hover:bg-gray-200">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                    </button>
                    <h3 className="text-lg font-semibold text-gray-800">
                        {monthNames[displayMonth.getMonth()]} {displayMonth.getFullYear()}
                    </h3>
                    <button onClick={goToNextMonth} className="p-2 rounded-full hover:bg-gray-200">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                    </button>
                </div>
                <div className="grid grid-cols-7 gap-2 text-sm font-medium text-gray-500 mb-2">
                    {dayNames.map(day => <div key={day} className="text-center">{day}</div>)}
                </div>
                <div className="grid grid-cols-7 gap-2">
                    {renderDays()}
                </div>
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-gray-100 font-sans antialiased flex flex-col items-center py-8 px-4">
            {showUserModal && <UserModal />}
            {showPinModal && <PinModal />}

            <header className="w-full max-w-md bg-white rounded-lg shadow-md p-4 mb-6 text-center">
                <h1 className="text-2xl font-bold text-gray-800">Calendario de Medicamentos</h1>
                {userName && <p className="text-gray-600 text-sm mt-1">Usuario: {userName}</p>}
            </header>

            <main className="w-full max-w-md bg-white rounded-lg shadow-md p-6 mb-6">
                <div className="flex justify-between items-center mb-4">
                    <button
                        onClick={() => setCurrentDate(prev => {
                            const newDate = new Date(prev);
                            newDate.setDate(prev.getDate() - 1);
                            return newDate;
                        })}
                        className="p-2 rounded-full bg-blue-500 text-white hover:bg-blue-600 transition duration-200"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                    </button>
                    <h2 className="text-xl font-semibold text-gray-800">
                        {currentDate.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    </h2>
                    <button
                        onClick={() => setCurrentDate(prev => {
                            const newDate = new Date(prev);
                            newDate.setDate(prev.getDate() + 1);
                            return newDate;
                        })}
                        className="p-2 rounded-full bg-blue-500 text-white hover:bg-blue-600 transition duration-200"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                    </button>
                </div>

                <button
                    onClick={() => setShowCalendar(!showCalendar)}
                    className="w-full bg-gray-200 text-gray-700 py-2 rounded-md mb-4 hover:bg-gray-300 transition duration-200"
                >
                    {showCalendar ? 'Ocultar Calendario' : 'Seleccionar Fecha / Ver Historial'}
                </button>

                {showCalendar && (
                    <div className="mb-6">
                        <SimpleCalendar onSelectDate={handleDateChange} selectedDate={currentDate} />
                    </div>
                )}

                {/* Botón para editar medicamentos */}
                <button
                    onClick={() => {
                        if (isEditingMedications) {
                            setIsEditingMedications(false);
                            resetMedicationForm();
                        } else {
                            setShowPinModal(true);
                        }
                    }}
                    className={`w-full py-2 rounded-md font-semibold transition duration-200 mb-4
                                ${isEditingMedications ? 'bg-red-500 text-white hover:bg-red-600' : 'bg-yellow-500 text-white hover:bg-yellow-600'}`}
                >
                    {isEditingMedications ? 'Salir del Modo Edición' : 'Editar Medicamentos (Requiere PIN)'}
                </button>


                {isEditingMedications && (
                    <section className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                        <h3 className="text-lg font-semibold text-gray-700 mb-3">Formulario de Medicamento</h3>
                        <div className="space-y-3">
                            <div>
                                <label htmlFor="medName" className="block text-sm font-medium text-gray-700">Nombre</label>
                                <input
                                    type="text"
                                    id="medName"
                                    className="w-full p-2 border border-gray-300 rounded-md"
                                    value={newMedName}
                                    onChange={(e) => setNewMedName(e.target.value)}
                                />
                            </div>
                            <div>
                                <label htmlFor="medDose" className="block text-sm font-medium text-gray-700">Dosis</label>
                                <input
                                    type="text"
                                    id="medDose"
                                    className="w-full p-2 border border-gray-300 rounded-md"
                                    value={newMedDose}
                                    onChange={(e) => setNewMedDose(e.target.value)}
                                />
                            </div>
                            <div>
                                <label htmlFor="medTimeOfDay" className="block text-sm font-medium text-gray-700">Momento del Día</label>
                                <select
                                    id="medTimeOfDay"
                                    className="w-full p-2 border border-gray-300 rounded-md"
                                    value={newMedTimeOfDay}
                                    onChange={(e) => setNewMedTimeOfDay(e.target.value)}
                                >
                                    <option value="">Selecciona un momento</option>
                                    <option value="Ayunas">Ayunas</option>
                                    <option value="Mañana Post Desayuno">Mañana Post Desayuno</option>
                                    <option value="Antes de Comer">Antes de Comer (13 hs)</option>
                                    <option value="Tarde">Tarde (18 hs)</option>
                                    <option value="Noche">Noche</option>
                                    <option value="Último Martes del Mes">Último Martes del Mes</option>
                                </select>
                            </div>
                            <div>
                                <label htmlFor="medFrequency" className="block text-sm font-medium text-gray-700">Frecuencia (ej: "daily", "weekly", "Martes, Jueves, Sábado")</label>
                                <input
                                    type="text"
                                    id="medFrequency"
                                    className="w-full p-2 border border-gray-300 rounded-md"
                                    placeholder="daily, weekly, monthly_last_tuesday o días de la semana separados por coma"
                                    value={newMedFrequency}
                                    onChange={(e) => setNewMedFrequency(e.target.value)}
                                />
                            </div>
                            <div className="flex space-x-2">
                                <button
                                    onClick={saveMedicationDefinition}
                                    className="flex-1 bg-green-600 text-white py-2 rounded-md hover:bg-green-700 transition duration-200"
                                >
                                    {editingMedId ? 'Guardar Cambios' : 'Añadir Medicamento'}
                                </button>
                                {editingMedId && (
                                    <button
                                        onClick={resetMedicationForm}
                                        className="flex-1 bg-gray-400 text-white py-2 rounded-md hover:bg-gray-500 transition duration-200"
                                    >
                                        Cancelar Edición
                                    </button>
                                )}
                            </div>
                        </div>
                    </section>
                )}


                <section className="mb-6">
                    <h3 className="text-lg font-semibold text-gray-700 mb-3">Medicación Diaria</h3>
                    <div className="space-y-3">
                        {['Ayunas', 'Mañana Post Desayuno', 'Antes de Comer', 'Tarde', 'Noche', 'Último Martes del Mes'].map(time => (
                            <div key={time} className={`${time.includes('Ayunas') ? 'bg-blue-50 border-blue-200' :
                                time.includes('Mañana') ? 'bg-green-50 border-green-200' :
                                time.includes('Antes de Comer') ? 'bg-yellow-50 border-yellow-200' :
                                time.includes('Tarde') ? 'bg-orange-50 border-orange-200' :
                                time.includes('Noche') ? 'bg-purple-50 border-purple-200' :
                                'bg-indigo-50 border-indigo-200'} p-3 rounded-md border`}>
                                <h4 className="font-medium text-gray-800 mb-2">{time}</h4>
                                {medicationDefinitions.length > 0 ? ( // Solo renderiza si hay definiciones cargadas
                                    getMedicationsByTime(time).length > 0 ? (
                                        getMedicationsByTime(time).map(med => (
                                            <div key={med.id} className="flex items-center space-x-2 mt-1">
                                                <label className="flex items-center space-x-2 flex-grow">
                                                    <input
                                                        type="checkbox"
                                                        className={`form-checkbox h-5 w-5 ${time.includes('Ayunas') ? 'text-blue-600' :
                                                            time.includes('Mañana') ? 'text-green-600' :
                                                            time.includes('Antes de Comer') ? 'text-yellow-600' :
                                                            time.includes('Tarde') ? 'text-orange-600' :
                                                            time.includes('Noche') ? 'text-purple-600' :
                                                            'text-indigo-600'} rounded`}
                                                        checked={medicationSchedule[med.id]?.taken || false}
                                                        onChange={() => toggleMedicationTaken(med.id)}
                                                    />
                                                    <span className="text-gray-700">{med.name} ({med.dose})</span>
                                                    {medicationSchedule[med.id]?.taken && (
                                                        <span className="text-xs text-gray-500 ml-auto">
                                                            Tomado por: {medicationSchedule[med.id].takenBy} a las {new Date(medicationSchedule[med.id].takenAt).toLocaleTimeString('es-ES')}
                                                        </span>
                                                    )}
                                                </label>
                                                {isEditingMedications && (
                                                    <div className="flex space-x-2 ml-2">
                                                        <button
                                                            onClick={() => startEditMedication(med)}
                                                            className="p-1 bg-blue-200 text-blue-800 rounded-md hover:bg-blue-300 text-sm"
                                                            title="Editar"
                                                        >
                                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                                            </svg>
                                                        </button>
                                                        <button
                                                            onClick={() => deleteMedicationDefinition(med.id)}
                                                            className="p-1 bg-red-200 text-red-800 rounded-md hover:bg-red-300 text-sm"
                                                            title="Eliminar"
                                                        >
                                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                            </svg>
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        ))
                                    ) : (
                                        <p className="text-gray-500 text-sm">No hay medicamentos definidos para este momento del día.</p>
                                    )
                                ) : (
                                    <p className="text-gray-500 text-sm">Cargando definiciones de medicamentos...</p>
                                )}
                            </div>
                        ))}
                    </div>
                </section>

                <section className="mb-6">
                    <h3 className="text-lg font-semibold text-gray-700 mb-3">Acciones Excepcionales</h3>
                    <div className="bg-red-50 p-3 rounded-md border border-red-200 space-y-2">
                        <p className="text-gray-700"><strong>En caso de Diarrea:</strong> Miopropan</p>
                        <p className="text-gray-700"><strong>En caso de Dolor de Cabeza:</strong> Naproxeno (1 pastilla)</p>
                        <p className="text-red-700 font-semibold">
                            ⚠️ IMPORTANTE: Informar en el grupo de WhatsApp en caso de Diarrea, Fiebre o Infección.
                        </p>
                    </div>
                </section>

                <section className="mb-6">
                    <h3 className="text-lg font-semibold text-gray-700 mb-3">Presión Arterial</h3>
                    <div className="flex space-x-4 mb-3">
                        <div className="flex-1">
                            <label htmlFor="morningPressure" className="block text-sm font-medium text-gray-700 mb-1">Mañana</label>
                            <input
                                type="text"
                                id="morningPressure"
                                className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="Ej: 120/80"
                                value={pressureReadings.morning}
                                onChange={(e) => setPressureReadings(prev => ({ ...prev, morning: e.target.value }))}
                            />
                        </div>
                        <div className="flex-1">
                            <label htmlFor="eveningPressure" className="block text-sm font-medium text-gray-700 mb-1">Tarde</label>
                            <input
                                type="text"
                                id="eveningPressure"
                                className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="Ej: 125/85"
                                value={pressureReadings.evening}
                                onChange={(e) => setPressureReadings(prev => ({ ...prev, evening: e.target.value }))}
                            />
                        </div>
                    </div>
                </section>

                <section className="mb-6">
                    <h3 className="text-lg font-semibold text-gray-700 mb-3">Notas Diarias</h3>
                    <textarea
                        className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[100px]"
                        placeholder="Añade notas relevantes del día, cómo se sintió la persona, etc."
                        value={dailyNotes}
                        onChange={(e) => setDailyNotes(e.target.value)}
                    ></textarea>
                </section>

                <button
                    onClick={saveDailyData}
                    className="w-full bg-blue-600 text-white py-3 rounded-md font-semibold hover:bg-blue-700 transition duration-200"
                >
                    Guardar Cambios del Día
                </button>
            </main>

            <footer className="w-full max-w-md text-center text-gray-500 text-sm mt-6">
                <p>Aplicación de seguimiento de medicamentos</p>
            </footer>
        </div>
    );
}

export default App;

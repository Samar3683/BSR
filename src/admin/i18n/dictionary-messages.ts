/**
 * Italian for the messages the database, the server and the client raise
 * (validation, rules, sign-in, network). See dictionary.ts.
 */
export const MESSAGES: Record<string, string> = {
  "A dispatched order needs both a pickup and a delivery time":
    "Un ordine assegnato richiede sia l'orario di ritiro sia quello di consegna",
  "A field cannot move to another entity": "Un campo non può passare a un'altra entità",
  "A valid phone number is required": "Serve un numero di telefono valido",
  "An email address or a phone number is required":
    "Serve un indirizzo email o un numero di telefono",
  "An option cannot move to another field": "Un'opzione non può passare a un altro campo",
  "An order in transit cannot be left without a driver and vehicle; reassign it instead":
    "Un ordine in viaggio non può restare senza autista e veicolo: riassegnalo",
  "An order in transit needs both a driver and a vehicle":
    "Un ordine in viaggio richiede sia un autista sia un veicolo",
  "Archived orders cannot be dispatched": "Gli ordini archiviati non possono essere assegnati",
  "Assign a driver and a vehicle first": "Assegna prima un autista e un veicolo",
  "Audit records are immutable": "Le voci del registro attività non sono modificabili",
  "Choose a driver, a vehicle or both": "Scegli un autista, un veicolo o entrambi",
  "Completed or cancelled orders keep their assignment history":
    "Gli ordini completati o annullati mantengono la cronologia delle assegnazioni",
  "Confirm the order before dispatching it": "Conferma l'ordine prima di assegnarlo",
  "Entities are fixed": "Le entità sono fisse",
  "Invalid request": "Richiesta non valida",
  "Name is required": "Il nome è obbligatorio",
  "New orders start as draft or confirmed": "I nuovi ordini iniziano come bozza o confermati",
  "Only draft orders can be deleted; cancel or archive the order instead":
    "Si possono eliminare solo gli ordini in bozza: annulla o archivia l'ordine",
  "Only draft, delivered or cancelled orders can be archived":
    "Si possono archiviare solo ordini in bozza, consegnati o annullati",
  "Order not found": "Ordine non trovato",
  "Pairing not found": "Abbinamento non trovato",
  "Roles are managed outside the admin panel": "I ruoli si gestiscono fuori dal pannello",
  "Select at most 200 orders at a time": "Seleziona al massimo 200 ordini alla volta",
  "Select at most 200 records at a time": "Seleziona al massimo 200 record alla volta",
  "Set the pickup and delivery times before dispatching":
    "Imposta gli orari di ritiro e consegna prima di assegnare",
  "System bindings cannot change": "I collegamenti di sistema non si possono modificare",
  "System fields are defined by the platform": "I campi di sistema sono definiti dalla piattaforma",
  "System fields cannot be deleted": "I campi di sistema non si possono eliminare",
  "System fields cannot be disabled or archived":
    "I campi di sistema non si possono disattivare né archiviare",
  "The driver is archived or not available for dispatch":
    "L'autista è archiviato o non disponibile per il dispatch",
  "The driver or vehicle was just booked for an overlapping time. Refresh and try again.":
    "L'autista o il veicolo è appena stato prenotato in un orario sovrapposto. Aggiorna e riprova.",
  "The driver or vehicle was just paired for an overlapping period. Refresh and try again.":
    "L'autista o il veicolo è appena stato abbinato in un periodo sovrapposto. Aggiorna e riprova.",
  "The email address is not valid": "L'indirizzo email non è valido",
  "The message is empty": "Il messaggio è vuoto",
  "The message is too short": "Il messaggio è troppo corto",
  "The message was not found": "Messaggio non trovato",
  "The order has no driver or vehicle assigned":
    "All'ordine non sono assegnati né autista né veicolo",
  "The order number cannot change": "Il numero d'ordine non si può modificare",
  "The order was not found": "Ordine non trovato",
  "The order window has already ended": "La finestra dell'ordine è già terminata",
  "The phone number is not valid": "Il numero di telefono non è valido",
  "The request was not found": "Richiesta non trovata",
  "The required option must belong to a driver select field":
    "L'opzione richiesta deve appartenere a un campo di selezione dell'autista",
  "The requirement must start from an option of a vehicle select field":
    "Il requisito deve partire da un'opzione di un campo di selezione del veicolo",
  "The type of a system field cannot change":
    "Il tipo di un campo di sistema non si può modificare",
  "The user of an administrator profile cannot change":
    "L'utente di un profilo amministratore non si può modificare",
  "The vehicle is archived or not available for dispatch":
    "Il veicolo è archiviato o non disponibile per il dispatch",
  "This customer has orders; archive the customer instead":
    "Questo cliente ha ordini: archivia il cliente",
  "This driver has assignment history; archive the driver instead":
    "Questo autista ha una cronologia di assegnazioni: archivia l'autista",
  "This field names the records; choose another primary display field first":
    "Questo campo dà il nome ai record: scegli prima un altro campo principale",
  "This option is the default value of the field; change the default first":
    "Questa opzione è il valore predefinito del campo: cambia prima il predefinito",
  "This pairing has already ended": "Questo abbinamento è già terminato",
  "This request has already been converted": "Questa richiesta è già stata convertita",
  "This resource has current or upcoming order assignments; reassign them first":
    "Questa risorsa ha assegnazioni in corso o future: riassegnale prima",
  "This user already has an administrator profile":
    "Questo utente ha già un profilo amministratore",
  "This vehicle has assignment history; archive the vehicle instead":
    "Questo veicolo ha una cronologia di assegnazioni: archivia il veicolo",
  "Too many requests right now. Try again later.":
    "Troppe richieste in questo momento. Riprova più tardi.",
  "Unassign the driver and vehicle to move the order back to confirmed":
    "Rimuovi autista e veicolo per riportare l'ordine a confermato",
  "Unknown conversation": "Conversazione sconosciuta",
  "Unknown entity": "Entità sconosciuta",
  'Use "Create order" to convert a request': 'Usa "Crea ordine" per convertire una richiesta',
  "User not found": "Utente non trovato",
  "Validation failed": "Validazione non riuscita",
  "Write a reply first": "Scrivi prima una risposta",
  "A filter value is not valid for its field":
    "Il valore di un filtro non è valido per il suo campo",
  "Another option already has this label": "Un'altra opzione ha già questa etichetta",
  "Another field of this entity already uses this key":
    "Un altro campo di questa entità usa già questa chiave",
  "Attributes must be an object": "Gli attributi devono essere un oggetto",
  "Choose a range of at most 5 years": "Scegli un intervallo di al massimo 5 anni",
  "Choose a range of at most 93 days": "Scegli un intervallo di al massimo 93 giorni",
  "Choose a valid date range": "Scegli un intervallo di date valido",
  "Enter a name (120 characters max)": "Inserisci un nome (massimo 120 caratteri)",
  "Filters must be a list": "I filtri devono essere un elenco",
  "Must be after the start": "Deve essere dopo l'inizio",
  "The field is not in use": "Il campo non è in uso",
  "This field cannot be sorted": "Questo campo non si può ordinare",
  "This field is not reportable": "Questo campo non è utilizzabile nei report",
  "This field type cannot be reported": "Questo tipo di campo non è utilizzabile nei report",
  "This type cannot name records": "Questo tipo non può dare il nome ai record",
  "Unknown field": "Campo sconosciuto",
  "The server could not be reached. Check the connection and try again.":
    "Impossibile raggiungere il server. Controlla la connessione e riprova.",
  "Your session has expired. Sign in again.": "La sessione è scaduta. Accedi di nuovo.",
  "The data is not valid.": "I dati non sono validi.",
  "Your account does not have access to this action.":
    "Il tuo account non ha accesso a questa azione.",
  "This value already exists.": "Questo valore esiste già.",
  "Other records refer to this one; archive it instead.":
    "Altri record fanno riferimento a questo: archivialo invece.",
  "The driver or vehicle is already booked for an overlapping time.":
    "L'autista o il veicolo è già prenotato in un orario sovrapposto.",
  "The delivery must be after the pickup.": "La consegna deve essere dopo il ritiro.",
  "A value is outside the allowed range.": "Un valore è fuori dall'intervallo consentito.",
  "The record was not found or is no longer available.":
    "Il record non è stato trovato o non è più disponibile.",
  "Something went wrong. Try again.": "Qualcosa è andato storto. Riprova.",
  "Use upper- and lowercase letters and at least one digit":
    "Usa lettere maiuscole e minuscole e almeno una cifra",
  "The email or password is not correct.": "L'email o la password non sono corrette.",
  "Enter a new password": "Inserisci una nuova password",
  "The current password is not correct": "La password attuale non è corretta",
  "Choose a password different from the current one":
    "Scegli una password diversa da quella attuale",
  "A user with this email already exists": "Esiste già un utente con questa email",
  "The administrator profile could not be created": "Impossibile creare il profilo amministratore",
  "The invitation could not be sent": "Impossibile inviare l'invito",
  "Some fields need attention": "Alcuni campi richiedono attenzione",
  "Not authenticated": "Non autenticato",
};

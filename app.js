let stock = JSON.parse(localStorage.getItem('magazyn_stock')) || [];
let orders = JSON.parse(localStorage.getItem('magazyn_orders')) || [];
let locations = JSON.parse(localStorage.getItem('magazyn_locations')) || [];
let tools = JSON.parse(localStorage.getItem('magazyn_tools')) || [];
let html5QrcodeScanner = null;

// GLOBALNY STAN TRYBU USUWANIA NARZĘDZI
let isToolDeleteMode = false;

// LOKALIZACJE STARTOWE (JEŚLI BAZA JEST PUSTA)
if (locations.length === 0) {
    locations = [
        { name: 'Regał A-1', code: 'REG-A1', notes: 'Główny regał' },
        { name: 'Regał B-1', code: 'REG-B1', notes: 'Strefa drobna' },
        { name: 'Strefa Przyjęć', code: 'ST-PRZ', notes: 'Tymczasowe odkładanie' }
    ];
    localStorage.setItem('magazyn_locations', JSON.stringify(locations));
}

// ZAPISYWANIE DO PAMIĘCI
function saveToStorage() {
    localStorage.setItem('magazyn_stock', JSON.stringify(stock));
    localStorage.setItem('magazyn_orders', JSON.stringify(orders));
    localStorage.setItem('magazyn_locations', JSON.stringify(locations));
    localStorage.setItem('magazyn_tools', JSON.stringify(tools));
    updateBadge();
}

// PRZEŁĄCZANIE TRYBU USUWANIA NARZĘDZI (KOSZ OBOK PLUSA)
function toggleToolDeleteMode() {
    isToolDeleteMode = !isToolDeleteMode;
    const trashBtn = document.getElementById('tool-trash-btn');
    const actionDiv = document.getElementById('delete-tools-actions');

    if (isToolDeleteMode) {
        if (trashBtn) trashBtn.classList.add('active');
        if (actionDiv) actionDiv.style.display = 'block';
    } else {
        if (trashBtn) trashBtn.classList.remove('active');
        if (actionDiv) actionDiv.style.display = 'none';
    }
    renderToolsLists();
}

// POTWIERDZENIE I ZBIORCZE USUNIĘCIE ZAZNACZONYCH POZYCJI
function confirmDeleteSelectedTools() {
    const checkboxes = document.querySelectorAll('.tool-delete-checkbox:checked');
    if (checkboxes.length === 0) {
        alert('Nie zaznaczono żadnego narzędzia do usunięcia! Kliknij w okienka po lewej stronie maszyn.');
        return;
    }

    if (confirm(`Czy na pewno chcesz BEZPOWROTANIE USUNĄĆ zaznaczone narzędzia (${checkboxes.length} szt.) z bazy danych systemu?`)) {
        const codesToDelete = Array.from(checkboxes).map(cb => cb.getAttribute('data-code'));
        
        // Filtrujemy bazę odrzucając zaznaczone kody
        tools = tools.filter(t => !codesToDelete.includes(t.code));
        
        // Wyłączamy tryb usuwania po czyszczeniu
        isToolDeleteMode = false;
        const trashBtn = document.getElementById('tool-trash-btn');
        const actionDiv = document.getElementById('delete-tools-actions');
        if (trashBtn) trashBtn.classList.remove('active');
        if (actionDiv) actionDiv.style.display = 'none';

        saveToStorage();
        renderToolsLists();
        alert('Zaznaczone narzędzia zostały pomyślnie usunięte.');
    }
}

// UKRYWANIE / POKAZYWANIE FORMULARZA DODAWANIA NARZĘDZIA
function toggleAddToolForm() {
    const card = document.getElementById('add-tool-card');
    if (card) {
        card.style.display = card.style.display === 'none' ? 'block' : 'none';
    }
}

// UTWORZENIE NOWEGO NARZĘDZIA
function handleCreateTool(e) {
    e.preventDefault();
    const code = document.getElementById('tool-code').value.trim();
    const name = document.getElementById('tool-name').value.trim();
    const notes = document.getElementById('tool-notes').value.trim();

    if (tools.some(t => t.code.toLowerCase() === code.toLowerCase())) {
        alert('Narzędzie o tym kodzie (ID) już istnieje w bazie danych!');
        return;
    }

    tools.push({ code, name, notes, status: 'dostępne' });
    alert(`Dodano nowe narzędzie: ${name}`);
    document.getElementById('form-narzedzie').reset();
    saveToStorage();
    toggleAddToolForm();
    renderToolsLists();
}

// POBIERANIE SPRZĘTU (ZMIANA STATUSU NA NIEDOSTĘPNE)
function takeTool(code) {
    const tool = tools.find(t => t.code === code);
    if (tool && tool.status === 'dostępne') {
        tool.status = 'niedostępne';
        saveToStorage();
        renderToolsLists();
        alert(`Pobrano narzędzie: ${tool.name}. Status zmieniony na Niedostępne.`);
    }
}

// ODDAWANIE SPRZĘTU (ZMIANA STATUSU NA DOSTĘPNE)
function returnTool(code) {
    const tool = tools.find(t => t.code === code);
    if (tool && tool.status === 'niedostępne') {
        tool.status = 'dostępne';
        saveToStorage();
        renderToolsLists();
        alert(`Narzędzie ${tool.name} wróciło do bazy. Status: Dostępne.`);
    }
}

// GENEROWANIE LIST W KAFELKACH NARZĘDZIOWYCH (Z UWZGLĘDNIENIEM WYSZUKIWANIA I USUWANIA)
function renderToolsLists() {
    const takeContainer = document.getElementById('tools-take-list');
    const returnContainer = document.getElementById('tools-return-list');
    
    // Pobranie wartości wpisanych w filtry wyszukiwania
    const takeQuery = document.getElementById('tool-take-search')?.value.toLowerCase().trim() || '';
    const returnQuery = document.getElementById('tool-return-search')?.value.toLowerCase().trim() || '';

    // Filtrowanie bazy pod kątem wyszukiwarki (Nazwa lub Kod)
    const filteredTakeTools = tools.filter(t => 
        t.name.toLowerCase().includes(takeQuery) || t.code.toLowerCase().includes(takeQuery)
    );
    const filteredReturnTools = tools.filter(t => 
        t.name.toLowerCase().includes(returnQuery) || t.code.toLowerCase().includes(returnQuery)
    );
    
    if (takeContainer) {
        takeContainer.innerHTML = filteredTakeTools.length === 0 ? '<p style="color:#666; padding:10px;">Nie znaleziono pasujących narzędzi.</p>' : '';
        filteredTakeTools.forEach(t => {
            const isAvail = t.status === 'dostępne';
            const card = document.createElement('div');
            card.className = 'tool-row-card';
            card.innerHTML = `
                <div class="tool-info">
                    <h4>${t.name}</h4>
                    <p>Kod: <b>${t.code}</b> ${t.notes ? `| Notatka: <i>${t.notes}</i>` : ''}</p>
                </div>
                <button class="tool-action-btn take" ${!isAvail ? 'disabled style="background:#ccc; color:#666;"' : ''} onclick="takeTool('${t.code}')">
                    ${isAvail ? '🛠️ Pobierz' : 'Pobrane'}
                </button>
            `;
            takeContainer.appendChild(card);
        });
    }

    if (returnContainer) {
        returnContainer.innerHTML = filteredReturnTools.length === 0 ? '<p style="color:#666; padding:10px;">Nie znaleziono pasujących narzędzi.</p>' : '';
        filteredReturnTools.forEach(t => {
            const isAvail = t.status === 'dostępne';
            const card = document.createElement('div');
            card.className = 'tool-row-card';
            
            // GENEROWANIE OKIENKA WYBORU JEŚLI WŁĄCZONY JEST TRYB USUWANIA
            let checkboxHtml = '';
            if (isToolDeleteMode) {
                checkboxHtml = `<input type="checkbox" class="tool-delete-checkbox" data-code="${t.code}">`;
            }

            card.innerHTML = `
                <div style="display:flex; align-items:center; flex:1;">
                    ${checkboxHtml}
                    <div class="tool-info">
                        <h4>${t.name}</h4>
                        <p>Kod: <b>${t.code}</b></p>
                    </div>
                </div>
                <div style="display:flex; gap:10px; align-items:center;">
                    <span class="status-badge ${isAvail ? 'available' : 'unavailable'}">${isAvail ? 'dostępne' : 'niedostępne'}</span>
                    <button class="tool-action-btn return" ${isAvail || isToolDeleteMode ? 'style="display:none;"' : ''} onclick="returnTool('${t.code}')">
                        🔄 Oddaj
                    </button>
                </div>
            `;
            returnContainer.appendChild(card);
        });
    }
}

// INTEGRACJA: STAN PRODUKTÓW (NARZĘDZIA SĄ CAŁKOWICIE USUNIĘTE Z TEJ LISTY)
function renderStock() {
    const tbody = document.getElementById('stock-table-body');
    const searchTxt = document.getElementById('search-input').value.toLowerCase();
    if (!tbody) return;
    tbody.innerHTML = '';

    // Renderowanie wyłącznie towarów tradycyjnych (tylko ze stanem większym niż 0)
    stock.filter(item => 
        item.qty > 0 && 
        (item.name.toLowerCase().includes(searchTxt) || 
        item.code.toLowerCase().includes(searchTxt) ||
        item.location.toLowerCase().includes(searchTxt))
    ).forEach(item => {
        const idx = stock.findIndex(i => i === item);
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><small>${item.code}</small></td>
            <td><strong>${item.name}</strong></td>
            <td><span class="loc-tag">📍 ${item.location}</span></td>
            <td><b>${item.qty} szt.</b></td>
            <td>${item.flagged ? '⭐' : '-'}</td>
            <td><button class="flag-btn ${item.flagged ? 'active' : 'inactive'}" onclick="toggleFlag(${idx})">Flaga</button></td>
        `;
        tbody.appendChild(tr);
    });
}

// MECHANIZM AUTOCOMPLETE BEZ ELEMENTU DATALIST
function showSuggestions(inputId) {
    const input = document.getElementById(inputId);
    const box = document.getElementById(inputId + '-suggestions');
    if (!box) return;

    const val = input.value.toLowerCase().trim();
    box.innerHTML = '';

    const filtered = locations.filter(loc => 
        loc.name.toLowerCase().includes(val) || 
        (loc.code && loc.code.toLowerCase().includes(val))
    );

    if (filtered.length === 0) {
        box.style.display = 'none';
        return;
    }

    filtered.forEach(loc => {
        const div = document.createElement('div');
        div.className = 'suggestion-item';
        div.innerText = loc.name;
        if(loc.code) div.innerText += ` (${loc.code})`;

        div.addEventListener('mousedown', (e) => {
            e.preventDefault(); 
            input.value = loc.name;
            box.style.display = 'none';
        });
        box.appendChild(div);
    });

    box.style.display = 'block';
}

// Chowanie list podpowiedzi po kliknięciu obok
document.addEventListener('mousedown', function(e) {
    if (!e.target.closest('.scan-input-group')) {
        document.querySelectorAll('.suggestions-box').forEach(box => box.style.display = 'none');
    }
});

// SKANOWANIE KAMERĄ TELEFONU
function startScanning(targetInputId, targetNameId = null) {
    document.getElementById('scanner-modal').style.display = 'flex';
    if (!html5QrcodeScanner) { html5QrcodeScanner = new Html5Qrcode("reader"); }
    
    html5QrcodeScanner.start(
        { facingMode: "environment" }, 
        { fps: 15, qrbox: { width: 280, height: 160 } },
        (decodedText) => {
            document.getElementById(targetInputId).value = decodedText;
            if (targetNameId) { 
                autoFillName(targetInputId, targetNameId); 
            } else { 
                autoCompleteLocation(targetInputId); 
            }
            
            // Filtrowanie natychmiastowe dla wyszukiwarek sprzętowych
            if (targetInputId === 'tool-take-search' || targetInputId === 'tool-return-search') {
                renderToolsLists();
            }

            if (navigator.vibrate) navigator.vibrate(100);
            stopScanning();
        },
        (errorMessage) => {}
    ).catch(err => { alert("Nie można uruchomić kamery!"); });
}

function stopScanning() {
    document.getElementById('scanner-modal').style.display = 'none';
    if (html5QrcodeScanner) { html5QrcodeScanner.stop().then(() => {}).catch(err => {}); }
}

function autoCompleteLocation(inputId) {
    const val = document.getElementById(inputId).value.trim();
    if (!val) return;
    const matchedLoc = locations.find(l => l.code === val || l.name.toLowerCase() === val.toLowerCase());
    if (matchedLoc) { document.getElementById(inputId).value = matchedLoc.name; }
}

function checkAndAddLiveLocation(locationName) {
    const name = locationName.trim();
    if (!name) return;
    const exists = locations.some(l => l.name.toLowerCase() === name.toLowerCase());
    if (!exists) {
        locations.push({ name: name, code: '', notes: 'Dodano z automatu w formularzu' });
        saveToStorage();
    }
}

// NAWIGACJA PO KAFELKACH
function switchTab(tabId) {
    document.getElementById('dashboard').style.display = 'none';
    document.querySelectorAll('.tab-content').forEach(tab => tab.style.display = 'none');
    document.getElementById(tabId).style.display = 'block';

    // RESETOWANIE TRYBU USUWANIA PRZY ZMIANIE EKRANÓW
    isToolDeleteMode = false;
    const trashBtn = document.getElementById('tool-trash-btn');
    const actionDiv = document.getElementById('delete-tools-actions');
    if (trashBtn) trashBtn.classList.remove('active');
    if (actionDiv) actionDiv.style.display = 'none';

    // Czyszczenie starych filtrów przy wchodzeniu do zakładki
    if(document.getElementById('tool-take-search')) document.getElementById('tool-take-search').value = '';
    if(document.getElementById('tool-return-search')) document.getElementById('tool-return-search').value = '';

    if(tabId === 'stan-magazynu') renderStock();
    if(tabId === 'pobierz-narzedzie' || tabId === 'oddaj-narzedzie') renderToolsLists();
    if(tabId === 'wydania') renderOrders();
    if(tabId === 'zarzadzaj-miejscami') renderLocationsTable();
}

function showDashboard() {
    document.querySelectorAll('.tab-content').forEach(tab => tab.style.display = 'none');
    document.getElementById('dashboard').style.display = 'grid';
    updateBadge();
}

function autoFillName(codeFieldId, nameFieldId) {
    const code = document.getElementById(codeFieldId).value.trim();
    if(!code) return;
    const existingProduct = stock.find(item => item.code === code);
    if(existingProduct) { document.getElementById(nameFieldId).value = existingProduct.name; }
}

function updateBadge() {
    const pendingOrdersCount = orders.filter(o => o.status === 'Oczekuje').length;
    const badge = document.getElementById('order-badge');
    if (badge) {
        if (pendingOrdersCount > 0) { badge.innerText = pendingOrdersCount; badge.style.display = 'flex'; } else { badge.style.display = 'none'; }
    }
}

// FORMULARZ: NOWA LOKALIZACJA
function handleCreateLocation(e) {
    e.preventDefault();
    const name = document.getElementById('loc-name').value.trim();
    const code = document.getElementById('loc-code').value.trim();
    const notes = document.getElementById('loc-notes').value.trim();

    if(locations.some(l => l.name.toLowerCase() === name.toLowerCase())) { alert('Miejsce o tej nazwie już istnieje!'); return; }

    locations.push({ name, code, notes });
    document.getElementById('form-lokalizacja').reset();
    saveToStorage();
    renderLocationsTable();
    showDashboard();
}

// USUWANIE MIEJSCA Z POTWIERDZENIEM
function deleteLocation(index) {
    const targetLoc = locations[index];
    if (confirm(`Czy na pewno chcesz bezpowrotnie usunąć miejsce: "${targetLoc.name}"?`)) {
        locations.splice(index, 1);
        saveToStorage();
        renderLocationsTable();
    }
}

// GENEROWANIE TABELI LOKALIZACJI Z PRZYCISKIEM USUWANIA
function renderLocationsTable() {
    const tbody = document.getElementById('locations-table-body');
    if(!tbody) return;
    tbody.innerHTML = '';
    
    locations.forEach((l, idx) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><b>${l.name}</b></td>
            <td><small>${l.code || '-'}</small></td>
            <td><i style="color:#666">${l.notes || '-'}</i></td>
            <td>
                <button class="delete-row-btn" onclick="deleteLocation(${idx})" title="Usuń to miejsce">🗑️</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// OBSŁUGA TOWARÓW
function handleIncoming(e) {
    e.preventDefault();
    const code = document.getElementById('in-code').value.trim();
    const name = document.getElementById('in-name').value.trim();
    const location = document.getElementById('in-location').value.trim();
    const qty = parseInt(document.getElementById('in-qty').value);

    checkAndAddLiveLocation(location);

    let item = stock.find(i => i.code === code && i.location.toLowerCase() === location.toLowerCase());
    if (item) { item.qty += qty; } else { stock.push({ code, name, location, qty, flagged: false }); }

    alert(`Przyjęto produkt: ${name} do miejsca ${location}`);
    document.getElementById('form-przyjecie').reset();
    saveToStorage();
    showDashboard();
}

function handleOutgoing(e) {
    e.preventDefault();
    const code = document.getElementById('out-code').value.trim();
    const location = document.getElementById('out-location').value.trim();
    const qty = parseInt(document.getElementById('out-qty').value);

    let item = stock.find(i => i.code === code && i.location.toLowerCase() === location.toLowerCase());
    if (!item || item.qty < qty) { alert('Błąd: Brak wystarczającej ilości tego towaru na wybranym miejscu!'); return; }

    item.qty -= qty;
    alert(`Pobrano z lokalizacji: ${location}`);
    document.getElementById('form-pobranie').reset();
    saveToStorage();
    showDashboard();
}

function handleTransfer(e) {
    e.preventDefault();
    const code = document.getElementById('trans-code').value.trim();
    const fromLoc = document.getElementById('trans-from').value.trim();
    const toLoc = document.getElementById('trans-to').value.trim();
    const qty = parseInt(document.getElementById('trans-qty').value);

    checkAndAddLiveLocation(toLoc);

    let sourceItem = stock.find(i => i.code === code && i.location.toLowerCase() === fromLoc.toLowerCase());
    if (!sourceItem || sourceItem.qty < qty) { alert('Błąd: Brak towaru w miejscu źródłowym!'); return; }

    sourceItem.qty -= qty;
    let targetItem = stock.find(i => i.code === code && i.location.toLowerCase() === toLoc.toLowerCase());
    if (targetItem) { targetItem.qty += qty; } 
    else { stock.push({ code, name: sourceItem.name, location: toLoc, qty: qty, flagged: sourceItem.flagged }); }

    alert('Towar przesunięty pomyślnie!');
    document.getElementById('form-przesuniecie').reset();
    saveToStorage();
    showDashboard();
}

// ZLECENIA WYDAŃ
function handleCreateOrder(e) {
    e.preventDefault();
    const code = document.getElementById('order-code').value.trim();
    const name = document.getElementById('order-name').value.trim();
    const location = document.getElementById('order-location').value.trim();
    const qty = parseInt(document.getElementById('order-qty').value);

    orders.push({ id: Date.now(), code, name, location, qty, status: 'Oczekuje' });
    alert('Utworzono nowe zlecenie wydania!');
    document.getElementById('form-zlecenie').reset();
    saveToStorage();
    showDashboard();
}

function renderOrders() {
    const container = document.getElementById('orders-list');
    if(!container) return;
    container.innerHTML = '';
    const pending = orders.filter(o => o.status === 'Oczekuje');
    if(pending.length === 0) { container.innerHTML = '<p style="color:#666; padding:10px;">Brak aktywnych zleceń do realizacji.</p>'; return; }

    pending.forEach(order => {
        const div = document.createElement('div');
        div.className = 'order-item';
        div.innerHTML = `<div><strong>[${order.code}] ${order.name}</strong><br><small>Miejsce: ${order.location} | Do pobrania: <b>${order.qty} szt.</b></small></div>
            <button class="order-btn" onclick="executeOrder(${order.id})">Wydaj z miejsca</button>`;
        container.appendChild(div);
    });
}

function executeOrder(orderId) {
    const order = orders.find(o => o.id === orderId);
    let item = stock.find(i => i.code === order.code && i.location.toLowerCase() === order.location.toLowerCase());

    if (!item || item.qty < order.qty) { alert('Błąd: Brak wystarczającej ilości towaru na tym miejscu, by zrealizować zlecenie!'); return; }

    item.qty -= order.qty;
    order.status = 'Zrealizowano';
    alert('Zlecenie zrealizowane! Towar zdjęty ze stanu.');
    saveToStorage();
    renderOrders();
}

function toggleFlag(index) { 
    stock[index].flagged = !stock[index].flagged; 
    saveToStorage(); 
    renderStock(); 
}

// INICJALIZACJA WYŚWIETLANIA LICZNIKA WYDAŃ
updateBadge();

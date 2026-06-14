let stock = JSON.parse(localStorage.getItem('magazyn_stock')) || [];
let orders = JSON.parse(localStorage.getItem('magazyn_orders')) || [];
let locations = JSON.parse(localStorage.getItem('magazyn_locations')) || [];
let html5QrcodeScanner = null;

// BANK LOKALIZACJI NA START (Jeśli baza jest pusta, tworzy podpowiedzi początkowe)
if (locations.length === 0) {
    locations = [
        { name: 'Regał A-1', code: 'REG-A1', notes: 'Główny regał' },
        { name: 'Regał B-1', code: 'REG-B1', notes: 'Strefa drobna' },
        { name: 'Strefa Przyjęć', code: 'ST-PRZ', notes: 'Tymczasowe odkładanie' }
    ];
    localStorage.setItem('magazyn_locations', JSON.stringify(locations));
}

// MIGRACJA I ZBIERANIE MIEJSC Z ISTNIEJĄCEGO STOCKU
stock.forEach(item => { 
    if (item.wh && !item.location) { item.location = item.wh; delete item.wh; } 
    if (item.location) {
        const exists = locations.some(l => l.name.toLowerCase() === item.location.toLowerCase());
        if (!exists) { locations.push({ name: item.location, code: '', notes: 'Zmigrowano automatycznie' }); }
    }
});
orders.forEach(order => { if (order.wh && !order.location) { order.location = order.wh; delete order.wh; } });
localStorage.setItem('magazyn_locations', JSON.stringify(locations));

function saveToStorage() {
    localStorage.setItem('magazyn_stock', JSON.stringify(stock));
    localStorage.setItem('magazyn_orders', JSON.stringify(orders));
    localStorage.setItem('magazyn_locations', JSON.stringify(locations));
    updateBadge();
}

// NOWY MECHANIZM: DYNAMICZNE MOBILNE PODPOWIEDZI (BEZ DATALIST)
function showSuggestions(inputId) {
    const input = document.getElementById(inputId);
    const box = document.getElementById(inputId + '-suggestions');
    if (!box) return;

    const val = input.value.toLowerCase().trim();
    box.innerHTML = '';

    // Filtrowanie bazy miejsc po tym, co wpisano
    const filtered = locations.filter(loc => 
        loc.name.toLowerCase().includes(val) || 
        (loc.code && loc.code.toLowerCase().includes(val))
    );

    if (filtered.length === 0) {
        box.style.display = 'none';
        return;
    }

    // Generowanie elementów listy podpowiedzi
    filtered.forEach(loc => {
        const div = document.createElement('div');
        div.className = 'suggestion-item';
        div.innerText = loc.name;
        if(loc.code) div.innerText += ` (${loc.code})`;

        // Używamy mousedown zamiast click, żeby telefon zdążył kliknąć przed zamknięciem klawiatury
        div.addEventListener('mousedown', (e) => {
            e.preventDefault(); // Blokuje domyślne zamknięcie (blur) pola
            input.value = loc.name;
            box.style.display = 'none';
        });
        box.appendChild(div);
    });

    box.style.display = 'block';
}

// Zamknięcie wszystkich list podpowiedzi, gdy klikniemy gdziekolwiek indziej na ekranie
document.addEventListener('mousedown', function(e) {
    if (!e.target.closest('.scan-input-group')) {
        document.querySelectorAll('.suggestions-box').forEach(box => box.style.display = 'none');
    }
});

// SKANOWANIE APARATEM
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
                // Jeśli skanowaliśmy miejsce, sprawdź czy kod odpowiada jakiejś przyjaznej nazwie
                autoCompleteLocation(targetInputId); 
            }
            if (navigator.vibrate) navigator.vibrate(100);
            stopScanning();
        },
        (errorMessage) => {}
    ).catch(err => { alert("Błąd kamery!"); });
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
        locations.push({ name: name, code: '', notes: 'Dodano w locie' });
        saveToStorage();
    }
}

// NAWIGACJA
function switchTab(tabId) {
    document.getElementById('dashboard').style.display = 'none';
    document.querySelectorAll('.tab-content').forEach(tab => tab.style.display = 'none');
    document.getElementById(tabId).style.display = 'block';

    if(tabId === 'stan-magazynu') renderStock();
    if(tabId === 'wydania') renderOrders();
    if(tabId === 'flagi') renderFlags();
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
    if (pendingOrdersCount > 0) { badge.innerText = pendingOrdersCount; badge.style.display = 'flex'; } else { badge.style.display = 'none'; }
}

// FORMULARZ: DODAWANIE MIEJSCA
function handleCreateLocation(e) {
    e.preventDefault();
    const name = document.getElementById('loc-name').value.trim();
    const code = document.getElementById('loc-code').value.trim();
    const notes = document.getElementById('loc-notes').value.trim();

    if(locations.some(l => l.name.toLowerCase() === name.toLowerCase())) { alert('Miejsce o tej nazwie już istnieje!'); return; }

    locations.push({ name, code, notes });
    alert(`Dodano miejsce: ${name}`);
    document.getElementById('form-lokalizacja').reset();
    saveToStorage();
    renderLocationsTable();
    showDashboard();
}

function renderLocationsTable() {
    const tbody = document.getElementById('locations-table-body');
    if(!tbody) return;
    tbody.innerHTML = '';
    locations.forEach(l => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td><b>${l.name}</b></td><td><small>${l.code || '-'}</small></td><td><i style="color:#666">${l.notes || '-'}</i></td>`;
        tbody.appendChild(tr);
    });
}

// OPERACJE TOWAROWE
function handleIncoming(e) {
    e.preventDefault();
    const code = document.getElementById('in-code').value.trim();
    const name = document.getElementById('in-name').value.trim();
    const location = document.getElementById('in-location').value.trim();
    const qty = parseInt(document.getElementById('in-qty').value);

    checkAndAddLiveLocation(location);

    let item = stock.find(i => i.code === code && i.location.toLowerCase() === location.toLowerCase());
    if (item) { item.qty += qty; } else { stock.push({ code, name, location, qty, flagged: false }); }

    alert(`Przyjęto: ${name} do miejsca ${location}`);
    document.getElementById('form-przyjecie').reset();
    saveToStorage();
    showDashboard();
}

function handleOutgoing(e) {
    e.preventDefault();
    const code = document.getElementById('out-code').value.trim();
    const name = document.getElementById('out-name').value.trim();
    const location = document.getElementById('out-location').value.trim();
    const qty = parseInt(document.getElementById('out-qty').value);

    let item = stock.find(i => i.code === code && i.location.toLowerCase() === location.toLowerCase());
    if (!item || item.qty < qty) { alert('Błąd: Brak wystarczającej ilości towaru w tym miejscu!'); return; }

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

    alert('Przesunięto pomyślnie!');
    document.getElementById('form-przesuniecie').reset();
    saveToStorage();
    showDashboard();
}

function handleCreateOrder(e) {
    e.preventDefault();
    const code = document.getElementById('order-code').value.trim();
    const name = document.getElementById('order-name').value.trim();
    const location = document.getElementById('order-location').value.trim();
    const qty = parseInt(document.getElementById('order-qty').value);

    orders.push({ id: Date.now(), code, name, location, qty, status: 'Oczekuje' });
    alert('Utworzono zlecenie wydania!');
    document.getElementById('form-zlecenie').reset();
    saveToStorage();
    showDashboard();
}

function renderOrders() {
    const container = document.getElementById('orders-list');
    container.innerHTML = '';
    const pending = orders.filter(o => o.status === 'Oczekuje');
    if(pending.length === 0) { container.innerHTML = '<p>Brak aktywnych zleceń.</p>'; return; }

    pending.forEach(order => {
        const div = document.createElement('div');
        div.className = 'order-item';
        div.innerHTML = `<div><strong>[${order.code}] ${order.name}</strong><br><small>Miejsce: ${order.location} | Ilość: <b>${order.qty} szt.</b></small></div>
            <button class="order-btn" onclick="executeOrder(${order.id})">Wydaj z miejsca</button>`;
        container.appendChild(div);
    });
}

function executeOrder(orderId) {
    const order = orders.find(o => o.id === orderId);
    let item = stock.find(i => i.code === order.code && i.location.toLowerCase() === order.location.toLowerCase());

    if (!item || item.qty < order.qty) { alert('Błąd: Brak towaru w tym miejscu!'); return; }

    item.qty -= order.qty;
    order.status = 'Zrealizowano';
    alert('Towar wydany z lokalizacji!');
    saveToStorage();
    renderOrders();
}

// INTEGRACJA: STAN PRODUKTÓW (UKRYWA TOWARY ZE STANEM "0")
function renderStock() {
    const tbody = document.getElementById('stock-table-body');
    const searchTxt = document.getElementById('search-input').value.toLowerCase();
    tbody.innerHTML = '';

    stock.filter(item => 
        item.qty > 0 && 
        (item.name.toLowerCase().includes(searchTxt) || 
        item.code.toLowerCase().includes(searchTxt) ||
        item.location.toLowerCase().includes(searchTxt))
    ).forEach(item => {
        const idx = stock.findIndex(i => i === item);
        const tr = document.createElement('tr');
        tr.innerHTML = `<td><small>${item.code}</small></td><td><strong>${item.name}</strong></td><td><span class="loc-tag">📍 ${item.location}</span></td><td><b>${item.qty} szt.</b></td><td>${item.flagged ? '⭐' : '-'}</td>
            <td><button class="flag-btn ${item.flagged ? 'active' : 'inactive'}" onclick="toggleFlag(${idx})">Flaga</button></td>`;
        tbody.appendChild(tr);
    });
}

function toggleFlag(index) { stock[index].flagged = !stock[index].flagged; saveToStorage(); renderStock(); }

function renderFlags() {
    const tbody = document.getElementById('flag-table-body');
    tbody.innerHTML = '';
    stock.filter(item => item.flagged && item.qty > 0).forEach(item => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${item.code}</td><td><strong>${item.name}</strong></td><td>📍 ${item.location}</td><td><b>${item.qty} szt.</b></td>`;
        tbody.appendChild(tr);
    });
}

// INICJALIZACJA SYSTEMU
updateBadge();

let stock = JSON.parse(localStorage.getItem('magazyn_stock')) || [];
let orders = JSON.parse(localStorage.getItem('magazyn_orders')) || [];
let locations = JSON.parse(localStorage.getItem('magazyn_locations')) || [];
let html5QrcodeScanner = null;

// AUTOMATYCZNA MIGRACJA (ze starej wersji systemu "wh" -> "location")
stock.forEach(item => { if (item.wh && !item.location) { item.location = item.wh; delete item.wh; } });
orders.forEach(order => { if (order.wh && !order.location) { order.location = order.wh; delete order.wh; } });

function saveToStorage() {
    localStorage.setItem('magazyn_stock', JSON.stringify(stock));
    localStorage.setItem('magazyn_orders', JSON.stringify(orders));
    localStorage.setItem('magazyn_locations', JSON.stringify(locations));
    updateBadge();
}

// INTEGELENTNE PODPOWIEDZI DLA APARATU
function startScanning(targetInputId, targetNameId = null) {
    document.getElementById('scanner-modal').style.display = 'flex';
    
    if (!html5QrcodeScanner) {
        html5QrcodeScanner = new Html5Qrcode("reader");
    }
    
    html5QrcodeScanner.start(
        { facingMode: "environment" }, 
        { fps: 15, qrbox: { width: 280, height: 160 } },
        (decodedText) => {
            document.getElementById(targetInputId).value = decodedText;
            
            // Jeśli skanowaliśmy produkt (przekazany targetNameId)
            if (targetNameId) {
                autoFillName(targetInputId, targetNameId);
            } else {
                // Jeśli skanowaliśmy miejsce
                autoCompleteLocation(targetInputId);
            }
            
            if (navigator.vibrate) navigator.vibrate(100);
            stopScanning();
        },
        (errorMessage) => {}
    ).catch(err => {
        alert("Błąd kamery! Brak uprawnień lub połączenia HTTPS.");
    });
}

function stopScanning() {
    document.getElementById('scanner-modal').style.display = 'none';
    if (html5QrcodeScanner) {
        html5QrcodeScanner.stop().then(() => {}).catch(err => {});
    }
}

// SPRAWDZANIE I AUTOUZUPEŁNIANIE KODÓW MIEJSC
function autoCompleteLocation(inputId) {
    const val = document.getElementById(inputId).value.trim();
    if (!val) return;

    // Szukamy czy wpisany/zeskanowany ciąg pasuje do kodu kreskowego zapisanego miejsca
    const matchedLoc = locations.find(l => l.code === val || l.name.toLowerCase() === val.toLowerCase());
    if (matchedLoc) {
        document.getElementById(inputId).value = matchedLoc.name; // zamień kod na ładną nazwę
    }
}

// AKTUALIZACJA OPTYMALNEJ LISTY ROZWIJANEJ W HTML
function renderLocationDatalist() {
    const dl = document.getElementById('locations-list-options');
    if (!dl) return;
    dl.innerHTML = '';
    
    locations.forEach(loc => {
        const option = document.createElement('option');
        option.value = loc.name;
        if (loc.code) option.label = `Kod: ${loc.code}`;
        dl.appendChild(option);
    });
}

// SPRAWDZANIE CZY WPISANE NOWE MIEJSCE TRZEBA DOPISAĆ DO BAZY PODPOWIEDZI
function checkAndAddLiveLocation(locationName) {
    const name = locationName.trim();
    if (!name) return;
    
    const exists = locations.some(l => l.name.toLowerCase() === name.toLowerCase());
    if (!exists) {
        locations.push({ name: name, code: '', notes: 'Dodano automatycznie podczas operacji' });
        saveToStorage();
        renderLocationDatalist();
    }
}

// NAWIGACJA ZAKŁADEK
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
    if(existingProduct) {
        document.getElementById(nameFieldId).value = existingProduct.name;
    }
}

function updateBadge() {
    const pendingOrdersCount = orders.filter(o => o.status === 'Oczekuje').length;
    const badge = document.getElementById('order-badge');
    if (pendingOrdersCount > 0) { badge.innerText = pendingOrdersCount; badge.style.display = 'flex'; } 
    else { badge.style.display = 'none'; }
}

// DODAWANIE NOWEGO MIEJSCA
function handleCreateLocation(e) {
    e.preventDefault();
    const name = document.getElementById('loc-name').value.trim();
    const code = document.getElementById('loc-code').value.trim();
    const notes = document.getElementById('loc-notes').value.trim();

    if(locations.some(l => l.name.toLowerCase() === name.toLowerCase())) {
        alert('Miejsce o tej nazwie już istnieje!');
        return;
    }

    locations.push({ name, code, notes });
    alert(`Dodano miejsce: ${name}`);
    document.getElementById('form-lokalizacja').reset();
    saveToStorage();
    renderLocationDatalist();
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

function renderStock() {
    const tbody = document.getElementById('stock-table-body');
    const searchTxt = document.getElementById('search-input').value.toLowerCase();
    tbody.innerHTML = '';

    stock.filter(item => 
        item.name.toLowerCase().includes(searchTxt) || 
        item.code.toLowerCase().includes(searchTxt) ||
        item.location.toLowerCase().includes(searchTxt)
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
    stock.filter(item => item.flagged).forEach(item => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${item.code}</td><td><strong>${item.name}</strong></td><td>📍 ${item.location}</td><td><b>${item.qty} szt.</b></td>`;
        tbody.appendChild(tr);
    });
}

// INICJALIZACJA SYSTEMU NA START
renderLocationDatalist();
updateBadge();

let stock = JSON.parse(localStorage.getItem('magazyn_stock')) || [];
let orders = JSON.parse(localStorage.getItem('magazyn_orders')) || [];
let locations = JSON.parse(localStorage.getItem('magazyn_locations')) || [];
let tools = JSON.parse(localStorage.getItem('magazyn_tools')) || [];
let requisitions = JSON.parse(localStorage.getItem('magazyn_requisitions')) || [];
// Nowa baza logów historii ruchu na magazynie
let logs = JSON.parse(localStorage.getItem('magazyn_logs')) || [];

let html5QrcodeScanner = null;
let isToolDeleteMode = false;
let selectedReportDate = null; // Zmienna pomocnicza wybranego dnia

if (locations.length === 0) {
    locations = [
        { name: 'Regał A-1', code: 'REG-A1', notes: 'Główny regał' },
        { name: 'Regał B-1', code: 'REG-B1', notes: 'Strefa drobna' },
        { name: 'Strefa Przyjęć', code: 'ST-PRZ', notes: 'Tymczasowe odkładanie' }
    ];
    localStorage.setItem('magazyn_locations', JSON.stringify(locations));
}

function saveToStorage() {
    localStorage.setItem('magazyn_stock', JSON.stringify(stock));
    localStorage.setItem('magazyn_orders', JSON.stringify(orders));
    localStorage.setItem('magazyn_locations', JSON.stringify(locations));
    localStorage.setItem('magazyn_tools', JSON.stringify(tools));
    localStorage.setItem('magazyn_requisitions', JSON.stringify(requisitions));
    localStorage.setItem('magazyn_logs', JSON.stringify(logs)); // Zapis logów do localstorage
    updateBadge();
}

// ==========================================
// FUNKCJA GENEROWANIA LOGU AUTOMATYCZNEGO
// ==========================================
function addLog(type, description) {
    const now = new Date();
    
    // Budujemy czytelny format daty ISO (RRRR-MM-DD) do łatwego sortowania dni
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;

    // Format godziny: minuta: sekunda
    const timeStr = now.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    logs.push({
        id: Date.now(),
        date: dateStr,
        time: timeStr,
        type: type,
        description: description
    });
    saveToStorage();
}

// ==========================================
// FUNKCJE OBSŁUGI MODUŁU RAPORTÓW DZIENNYCH
// ==========================================
function renderReportsDates() {
    const grid = document.getElementById('reports-days-grid');
    if (!grid) return;
    grid.innerHTML = '';

    // Pobranie unikalnych dat operacji, odwrócone (najnowsze dni na początku)
    const uniqueDates = [...new Set(logs.map(l => l.date))].sort().reverse();

    if (uniqueDates.length === 0) {
        grid.innerHTML = '<p style="color:#94a3b8; grid-column:1/-1; text-align:center; padding:20px;">Brak historii operacji. Magazyn jest pusty.</p>';
        return;
    }

    uniqueDates.forEach(date => {
        const count = logs.filter(l => l.date === date).length;
        const card = document.createElement('div');
        card.className = 'tile';
        card.style.padding = '15px 10px';
        card.style.border = '1px solid #cbd5e1';
        card.innerHTML = `
            <div style="font-size: 24px; margin-bottom: 5px;">📅</div>
            <div style="font-weight: bold; font-size: 14px;">${date}</div>
            <div style="font-size: 12px; color: #64748b; margin-top: 5px;">Ruchów: <b>${count}</b></div>
        `;
        card.onclick = () => openReportDetail(date);
        grid.appendChild(card);
    });
}

function openReportDetail(date) {
    selectedReportDate = date;
    document.getElementById('reports-date-list-view').style.display = 'none';
    document.getElementById('report-detail-view').style.display = 'block';
    
    document.getElementById('report-view-title').innerText = `Szczegóły operacji z dnia: ${date}`;
    renderReportTable(date);
}

function exitReportDetail() {
    selectedReportDate = null;
    document.getElementById('reports-date-list-view').style.display = 'block';
    document.getElementById('report-detail-view').style.display = 'none';
    renderReportsDates();
}

function renderReportTable(date) {
    const tbody = document.getElementById('report-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    // Filtrowanie wpisów z danego dnia, najnowsze godziny od góry
    const dayLogs = logs.filter(l => l.date === date).sort((a,b) => b.id - a.id);

    dayLogs.forEach(log => {
        const tr = document.createElement('tr');
        
        let typeColor = '#34495e';
        if (log.type.includes('Przyjęcie')) typeColor = '#2ecc71';
        if (log.type.includes('Pobranie')) typeColor = '#e74c3c';
        if (log.type.includes('Przesunięcie')) typeColor = '#3498db';
        if (log.type.includes('Narzędzie')) typeColor = '#9b59b6';
        if (log.type.includes('Zlecenie')) typeColor = '#e67e22';

        tr.innerHTML = `
            <td><code>${log.time}</code></td>
            <td><span style="color: ${typeColor}; font-weight: bold;">${log.type}</span></td>
            <td>${log.description}</td>
        `;
        tbody.appendChild(tr);
    });
}

function clearSelectedDayLogs() {
    if (!selectedReportDate) return;
    if (confirm(`Czy na pewno chcesz permanentnie skasować historię raportu z dnia ${selectedReportDate}?`)) {
        logs = logs.filter(l => l.date !== selectedReportDate);
        saveToStorage();
        exitReportDetail();
    }
}

function generateReportPDF() {
    if (!selectedReportDate) return;
    
    const element = document.getElementById('report-pdf-area');
    const header = document.getElementById('report-pdf-header');
    const meta = document.getElementById('report-pdf-meta');

    meta.innerText = `Raport dla dnia: ${selectedReportDate} | Wyciąg pobrano: ${new Date().toLocaleString('pl-PL')}`;
    header.style.display = 'block';

    const opt = {
        margin:       12,
        filename:     `Raport_Magazynowy_${selectedReportDate}.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    html2pdf().set(opt).from(element).save().then(() => {
        header.style.display = 'none';
    }).catch(err => {
        console.error("Błąd PDF:", err);
        header.style.display = 'none';
    });
}

// ==========================================
// MODUŁ ZAPOTRZEBOWANIA
// ==========================================
function handleCreateRequisition(e) {
    e.preventDefault();
    const name = document.getElementById('req-name').value.trim();
    const qty = parseInt(document.getElementById('req-qty').value);
    const unit = document.getElementById('req-unit').value.trim();

    requisitions.push({ id: Date.now(), name, qty, unit });
    saveToStorage();
    renderRequisitions();
    document.getElementById('form-zapotrzebowanie').reset();
    document.getElementById('req-qty').value = 1;
}

function deleteRequisition(id) {
    requisitions = requisitions.filter(item => item.id !== id);
    saveToStorage();
    renderRequisitions();
}

function clearAllRequisitions() {
    if (confirm('Czy na pewno wyczyścić listę?')) {
        requisitions = [];
        saveToStorage();
        renderRequisitions();
    }
}

function renderRequisitions() {
    const tbody = document.getElementById('requisitions-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (requisitions.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:#94a3b8; padding:20px;">Brak wpisów.</td></tr>`;
        return;
    }

    requisitions.forEach(item => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${item.name}</strong></td>
            <td><b>${item.qty}</b></td>
            <td><span style="color:#64748b;">${item.unit}</span></td>
            <td class="pdf-hide-col" style="text-align:center;"><button class="delete-row-btn" onclick="deleteRequisition(${item.id})">❌</button></td>
        `;
        tbody.appendChild(tr);
    });
}

function generateRequisitionPDF() {
    if (requisitions.length === 0) return;
    const element = document.getElementById('pdf-print-area');
    const header = document.getElementById('pdf-only-header');
    const timestamp = document.getElementById('pdf-timestamp');
    const now = new Date();
    
    timestamp.innerText = `Wygenerowano: ${now.toLocaleDateString('pl-PL')} o ${now.toLocaleTimeString('pl-PL')}`;
    header.style.display = 'block';
    const hideCols = document.querySelectorAll('.pdf-hide-col');
    hideCols.forEach(col => col.style.display = 'none');

    const opt = {
        margin:       12,
        filename:     `Zapotrzebowanie_${now.toISOString().slice(0,10)}.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    html2pdf().set(opt).from(element).save().then(() => {
        header.style.display = 'none';
        hideCols.forEach(col => col.style.display = '');
    }).catch(err => {
        header.style.display = 'none';
        hideCols.forEach(col => col.style.display = '');
    });
}

// ==========================================
// POZOSTAŁE FUNKCJE MAGAZYNU + DOPISANIE LOGOWANIA
// ==========================================
function handleIncoming(e) {
    e.preventDefault();
    const code = document.getElementById('in-code').value.trim();
    const name = document.getElementById('in-name').value.trim();
    const location = document.getElementById('in-location').value.trim();
    const qty = parseInt(document.getElementById('in-qty').value);

    checkAndAddLiveLocation(location);

    let item = stock.find(i => i.code === code && i.location.toLowerCase() === location.toLowerCase());
    if (item) { item.qty += qty; } else { stock.push({ code, name, location, qty, flagged: false }); }

    // AUTOMATYCZNY LOG
    addLog('Przyjęcie', `Dodano do stanu: ${qty} szt. towaru [${code}] "${name}" na miejsce: ${location}`);

    alert(`Przyjęto produkt: ${name}`);
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
    if (!item || item.qty < qty) { alert('Błąd: Brak wystarczającej ilości towaru!'); return; }

    item.qty -= qty;

    // AUTOMATYCZNY LOG
    addLog('Pobranie', `Pobrano na stałe: ${qty} szt. towaru [${code}] "${item.name}" z miejsca: ${location}`);

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
    if (targetItem) { targetItem.qty += qty; } else { stock.push({ code, name: sourceItem.name, location: toLoc, qty: qty, flagged: sourceItem.flagged }); }

    // AUTOMATYCZNY LOG
    addLog('Przesunięcie', `Przeniesiono ${qty} szt. [${code}] "${sourceItem.name}" z miejsca [${fromLoc}] do [${toLoc}]`);

    alert('Towar przesunięty!');
    document.getElementById('form-przesuniecie').reset();
    saveToStorage();
    showDashboard();
}

function takeTool(code) {
    const tool = tools.find(t => t.code === code);
    if (tool && tool.status === 'dostępne') {
        tool.status = 'niedostępne';
        
        // AUTOMATYCZNY LOG
        addLog('Narzędzie - Pobranie', `Wydano pracownikowi narzędzie: "${tool.name}" [ID: ${tool.code}]`);

        saveToStorage();
        renderToolsLists();
        alert(`Pobrano narzędzie: ${tool.name}.`);
    }
}

function returnTool(code) {
    const tool = tools.find(t => t.code === code);
    if (tool && tool.status === 'niedostępne') {
        tool.status = 'dostępne';
        
        // AUTOMATYCZNY LOG
        addLog('Narzędzie - Zwrot', `Zwrócono na bazę narzędzie: "${tool.name}" [ID: ${tool.code}]`);

        saveToStorage();
        renderToolsLists();
        alert(`Narzędzie ${tool.name} wróciło do bazy.`);
    }
}

function executeOrder(orderId) {
    const order = orders.find(o => o.id === orderId);
    let item = stock.find(i => i.code === order.code && i.location.toLowerCase() === order.location.toLowerCase());

    if (!item || item.qty < order.qty) { alert('Błąd: Brak towaru na miejscu!'); return; }

    item.qty -= order.qty;
    order.status = 'Zrealizowano';

    // AUTOMATYCZNY LOG
    addLog('Zlecenie - Wydanie', `Zrealizowano oficjalne zlecenie wydania: ${order.qty} szt. [${order.code}] "${order.name}" z miejsca: ${order.location}`);

    saveToStorage();
    renderOrders();
}

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

function confirmDeleteSelectedTools() {
    const checkboxes = document.querySelectorAll('.tool-delete-checkbox:checked');
    if (checkboxes.length === 0) { alert('Nie zaznaczono narzędzi!'); return; }
    if (confirm(`Usunąć permanentnie ${checkboxes.length} szt. narzędzi?`)) {
        const codesToDelete = Array.from(checkboxes).map(cb => cb.getAttribute('data-code'));
        tools = tools.filter(t => !codesToDelete.includes(t.code));
        isToolDeleteMode = false;
        document.getElementById('tool-trash-btn').classList.remove('active');
        document.getElementById('delete-tools-actions').style.display = 'none';
        saveToStorage();
        renderToolsLists();
    }
}

function toggleAddToolForm() {
    const card = document.getElementById('add-tool-card');
    if (card) card.style.display = card.style.display === 'none' ? 'block' : 'none';
}

function handleCreateTool(e) {
    e.preventDefault();
    const code = document.getElementById('tool-code').value.trim();
    const name = document.getElementById('tool-name').value.trim();
    const notes = document.getElementById('tool-notes').value.trim();

    if (tools.some(t => t.code.toLowerCase() === code.toLowerCase())) { alert('Kod już istnieje!'); return; }

    tools.push({ code, name, notes, status: 'dostępne' });
    document.getElementById('form-narzedzie').reset();
    saveToStorage();
    toggleAddToolForm();
    renderToolsLists();
}

function renderToolsLists() {
    const takeContainer = document.getElementById('tools-take-list');
    const returnContainer = document.getElementById('tools-return-list');
    const takeQuery = document.getElementById('tool-take-search')?.value.toLowerCase().trim() || '';
    const returnQuery = document.getElementById('tool-return-search')?.value.toLowerCase().trim() || '';

    const filteredTakeTools = tools.filter(t => t.name.toLowerCase().includes(takeQuery) || t.code.toLowerCase().includes(takeQuery));
    const filteredReturnTools = tools.filter(t => t.name.toLowerCase().includes(returnQuery) || t.code.toLowerCase().includes(returnQuery));
    
    if (takeContainer) {
        takeContainer.innerHTML = filteredTakeTools.length === 0 ? '<p style="color:#666; padding:10px;">Brak.</p>' : '';
        filteredTakeTools.forEach(t => {
            const isAvail = t.status === 'dostępne';
            const card = document.createElement('div');
            card.className = 'tool-row-card';
            card.innerHTML = `<div class="tool-info"><h4>${t.name}</h4><p>Kod: <b>${t.code}</b></p></div><button class="tool-action-btn take" ${!isAvail ? 'disabled style="background:#ccc;"' : ''} onclick="takeTool('${t.code}')">${isAvail ? '🛠️ Pobierz' : 'Pobrane'}</button>`;
            takeContainer.appendChild(card);
        });
    }
    if (returnContainer) {
        returnContainer.innerHTML = filteredReturnTools.length === 0 ? '<p style="color:#666; padding:10px;">Brak.</p>' : '';
        filteredReturnTools.forEach(t => {
            const isAvail = t.status === 'dostępne';
            const card = document.createElement('div');
            card.className = 'tool-row-card';
            let checkboxHtml = isToolDeleteMode ? `<input type="checkbox" class="tool-delete-checkbox" data-code="${t.code}">` : '';
            card.innerHTML = `<div style="display:flex; align-items:center; flex:1;">${checkboxHtml}<div class="tool-info"><h4>${t.name}</h4><p>Kod: <b>${t.code}</b></p></div></div><div style="display:flex; gap:10px; align-items:center;"><span class="status-badge ${isAvail ? 'available' : 'unavailable'}">${isAvail ? 'dostępne' : 'niedostępne'}</span><button class="tool-action-btn return" ${isAvail || isToolDeleteMode ? 'style="display:none;"' : ''} onclick="returnTool('${t.code}')">🔄 Oddaj</button></div>`;
            returnContainer.appendChild(card);
        });
    }
}

function renderStock() {
    const tbody = document.getElementById('stock-table-body');
    const searchTxt = document.getElementById('search-input').value.toLowerCase();
    if (!tbody) return;
    tbody.innerHTML = '';
    stock.filter(item => item.qty > 0 && (item.name.toLowerCase().includes(searchTxt) || item.code.toLowerCase().includes(searchTxt) || item.location.toLowerCase().includes(searchTxt))).forEach(item => {
        const idx = stock.findIndex(i => i === item);
        const tr = document.createElement('tr');
        tr.innerHTML = `<td><small>${item.code}</small></td><td><strong>${item.name}</strong></td><td><span class="loc-tag">📍 ${item.location}</span></td><td><b>${item.qty} szt.</b></td><td>${item.flagged ? '⭐' : '-'}</td><td><button class="flag-btn ${item.flagged ? 'active' : 'inactive'}" onclick="toggleFlag(${idx})">Flaga</button></td>`;
        tbody.appendChild(tr);
    });
}

function showSuggestions(inputId) {
    const input = document.getElementById(inputId);
    const box = document.getElementById(inputId + '-suggestions');
    if (!box) return;
    const val = input.value.toLowerCase().trim();
    box.innerHTML = '';
    const filtered = locations.filter(loc => loc.name.toLowerCase().includes(val) || (loc.code && loc.code.toLowerCase().includes(val)));
    if (filtered.length === 0) { box.style.display = 'none'; return; }
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

document.addEventListener('mousedown', function(e) {
    if (!e.target.closest('.scan-input-group')) { document.querySelectorAll('.suggestions-box').forEach(box => box.style.display = 'none'); }
});

function startScanning(targetInputId, targetNameId = null) {
    document.getElementById('scanner-modal').style.display = 'flex';
    if (!html5QrcodeScanner) { html5QrcodeScanner = new Html5Qrcode("reader"); }
    html5QrcodeScanner.start(
        { facingMode: "environment" }, { fps: 15, qrbox: { width: 280, height: 160 } },
        (decodedText) => {
            document.getElementById(targetInputId).value = decodedText;
            if (targetNameId) { autoFillName(targetInputId, targetNameId); } else { autoCompleteLocation(targetInputId); }
            if (targetInputId === 'tool-take-search' || targetInputId === 'tool-return-search') { renderToolsLists(); }
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
    if (!locations.some(l => l.name.toLowerCase() === name.toLowerCase())) {
        locations.push({ name: name, code: '', notes: 'Dodano z automatu' });
        saveToStorage();
    }
}

function switchTab(tabId) {
    document.getElementById('dashboard').style.display = 'none';
    document.querySelectorAll('.tab-content').forEach(tab => tab.style.display = 'none');
    document.getElementById(tabId).style.display = 'block';

    isToolDeleteMode = false;
    if(document.getElementById('tool-trash-btn')) document.getElementById('tool-trash-btn').classList.remove('active');
    if(document.getElementById('delete-tools-actions')) document.getElementById('delete-tools-actions').style.display = 'none';

    if(tabId === 'stan-magazynu') renderStock();
    if(tabId === 'pobierz-narzedzie' || tabId === 'oddaj-narzedzie') renderToolsLists();
    if(tabId === 'wydania') renderOrders();
    if(tabId === 'zarzadzaj-miejscami') renderLocationsTable();
    if(tabId === 'zapotrzebowanie') renderRequisitions();
    
    // Odpalenie widoku raportów
    if(tabId === 'raporty') exitReportDetail(); 
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

function handleCreateLocation(e) {
    e.preventDefault();
    const name = document.getElementById('loc-name').value.trim();
    const code = document.getElementById('loc-code').value.trim();
    const notes = document.getElementById('loc-notes').value.trim();
    if(locations.some(l => l.name.toLowerCase() === name.toLowerCase())) { alert('Miejsce istnieje!'); return; }
    locations.push({ name, code, notes });
    document.getElementById('form-lokalizacja').reset();
    saveToStorage();
    renderLocationsTable();
    showDashboard();
}

function deleteLocation(index) {
    if (confirm(`Usunąć miejsce: "${locations[index].name}"?`)) { locations.splice(index, 1); saveToStorage(); renderLocationsTable(); }
}

function renderLocationsTable() {
    const tbody = document.getElementById('locations-table-body');
    if(!tbody) return;
    tbody.innerHTML = '';
    locations.forEach((l, idx) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td><b>${l.name}</b></td><td><small>${l.code || '-'}</small></td><td><i style="color:#666">${l.notes || '-'}</i></td><td><button class="delete-row-btn" onclick="deleteLocation(${idx})">🗑️</button></td>`;
        tbody.appendChild(tr);
    });
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
    if(!container) return;
    container.innerHTML = '';
    const pending = orders.filter(o => o.status === 'Oczekuje');
    if(pending.length === 0) { container.innerHTML = '<p style="color:#666; padding:10px;">Brak zleceń.</p>'; return; }
    pending.forEach(order => {
        const div = document.createElement('div');
        div.className = 'order-item';
        div.innerHTML = `<div><strong>[${order.code}] ${order.name}</strong><br><small>Miejsce: ${order.location} | Ilość: <b>${order.qty} szt.</b></small></div><button class="order-btn" onclick="executeOrder(${order.id})">Wydaj</button>`;
        container.appendChild(div);
    });
}

function toggleFlag(index) { stock[index].flagged = !stock[index].flagged; saveToStorage(); renderStock(); }

updateBadge();

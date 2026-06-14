let stock = JSON.parse(localStorage.getItem('magazyn_stock')) || [];
let orders = JSON.parse(localStorage.getItem('magazyn_orders')) || [];
let html5QrcodeScanner = null; // Zmienna trzymająca instancję aparatu

function saveToStorage() {
    localStorage.setItem('magazyn_stock', JSON.stringify(stock));
    localStorage.setItem('magazyn_orders', JSON.stringify(orders));
    updateBadge();
}

// LOGIKA APARATU / SKANERA
function startScanning(targetInputId, targetNameId) {
    // Pokazuje wyskakujące okno z kamerą
    document.getElementById('scanner-modal').style.display = 'flex';
    
    // Tworzymy instancję tylko jeśli nie została stworzona wcześniej
    if (!html5QrcodeScanner) {
        html5QrcodeScanner = new Html5Qrcode("reader");
    }
    
    html5QrcodeScanner.start(
        { facingMode: "environment" }, 
        {
            fps: 15,
            qrbox: { width: 280, height: 160 }
        },
        (decodedText) => {
            document.getElementById(targetInputId).value = decodedText;
            autoFillName(targetInputId, targetNameId);
            
            if (navigator.vibrate) navigator.vibrate(100);
            stopScanning();
        },
        (errorMessage) => {
            // ignorujemy błędy szukania kodu w klatce obrazu
        }
    ).catch(err => {
        console.error("Nie udało się uruchomić kamery:", err);
        alert("Błąd kamery! Aplikacja nie ma uprawnień lub nie używasz bezpiecznego połączenia HTTPS.");
    });
}

function stopScanning() {
    // ZASADA BEZPIECZEŃSTWA: Najpierw bezwzględnie zamykamy okno w UI, 
    // żeby użytkownik nie został zablokowany na czarnym ekranie.
    document.getElementById('scanner-modal').style.display = 'none';

    if (html5QrcodeScanner) {
        // Próbujemy bezpiecznie wyłączyć strumień wideo, jeśli wystartował
        html5QrcodeScanner.stop().then(() => {
            console.log("Strumień kamery wyłączony.");
        }).catch(err => {
            // Jeśli kamera w ogóle nie ruszyła, stop() zwróci błąd, który tutaj po prostu ignorujemy
            console.log("Kamera nie była aktywna, zamknięto samo okno.");
        });
    }
}

function stopScanning() {
    if (html5QrcodeScanner) {
        html5QrcodeScanner.stop().then(() => {
            document.getElementById('scanner-modal').style.display = 'none';
        }).catch(err => {
            document.getElementById('scanner-modal').style.display = 'none';
        });
    } else {
        document.getElementById('scanner-modal').style.display = 'none';
    }
}

// RESTA LOGIKI APLIKACJI
function switchTab(tabId) {
    document.getElementById('dashboard').style.display = 'none';
    document.querySelectorAll('.tab-content').forEach(tab => tab.style.display = 'none');
    
    document.getElementById(tabId).style.display = 'block';

    if(tabId === 'stan-magazynu') renderStock();
    if(tabId === 'wydania') renderOrders();
    if(tabId === 'flagi') renderFlags();
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
    if (pendingOrdersCount > 0) {
        badge.innerText = pendingOrdersCount;
        badge.style.display = 'flex';
    } else {
        badge.style.display = 'none';
    }
}

function handleOperation(e) {
    e.preventDefault();
    const code = document.getElementById('op-code').value.trim();
    const name = document.getElementById('op-name').value.trim();
    const wh = document.getElementById('op-wh').value.trim();
    const qty = parseInt(document.getElementById('op-qty').value);
    const type = document.getElementById('op-type').value;

    let item = stock.find(i => i.code === code && i.wh.toLowerCase() === wh.toLowerCase());

    if (type === 'in') {
        if (item) { item.qty += qty; } 
        else { stock.push({ code, name, wh, qty, flagged: false }); }
        alert(`Przyjęto: ${name} (${qty} szt.)`);
    } else {
        if (!item || item.qty < qty) { alert('Błąd: Brak towaru!'); return; }
        item.qty -= qty;
        alert(`Pobrano: ${name} (${qty} szt.)`);
    }

    document.getElementById('form-operacja').reset();
    saveToStorage();
    showDashboard();
}

function handleTransfer(e) {
    e.preventDefault();
    const code = document.getElementById('trans-code').value.trim();
    const fromWh = document.getElementById('trans-from').value.trim();
    const toWh = document.getElementById('trans-to').value.trim();
    const qty = parseInt(document.getElementById('trans-qty').value);

    let sourceItem = stock.find(i => i.code === code && i.wh.toLowerCase() === fromWh.toLowerCase());
    if (!sourceItem || sourceItem.qty < qty) { alert('Błąd: Brak towaru w źródle!'); return; }

    sourceItem.qty -= qty;
    let targetItem = stock.find(i => i.code === code && i.wh.toLowerCase() === toWh.toLowerCase());
    if (targetItem) { targetItem.qty += qty; } 
    else { stock.push({ code, name: sourceItem.name, wh: toWh, qty: qty, flagged: sourceItem.flagged }); }

    alert('Przesunięto pomyślnie!');
    document.getElementById('form-przesuniecie').reset();
    saveToStorage();
    showDashboard();
}

function handleCreateOrder(e) {
    e.preventDefault();
    const code = document.getElementById('order-code').value.trim();
    const name = document.getElementById('order-name').value.trim();
    const wh = document.getElementById('order-wh').value.trim();
    const qty = parseInt(document.getElementById('order-qty').value);

    orders.push({ id: Date.now(), code, name, wh, qty, status: 'Oczekuje' });
    alert('Utworzono zlecenie wydania!');
    document.getElementById('form-zlecenie').reset();
    saveToStorage();
    showDashboard();
}

function renderOrders() {
    const container = document.getElementById('orders-list');
    container.innerHTML = '';
    const pending = orders.filter(o => o.status === 'Oczekuje');

    if(pending.length === 0) { container.innerHTML = '<p>Brak zleceń.</p>'; return; }

    pending.forEach(order => {
        const div = document.createElement('div');
        div.className = 'order-item';
        div.innerHTML = `
            <div>
                <strong>[${order.code}] ${order.name}</strong><br>
                <small>Magazyn: ${order.wh} | Ilość: <b>${order.qty} szt.</b></small>
            </div>
            <button class="order-btn" onclick="executeOrder(${order.id})">Wydaj z magazynu</button>
        `;
        container.appendChild(div);
    });
}

function executeOrder(orderId) {
    const order = orders.find(o => o.id === orderId);
    let item = stock.find(i => i.code === order.code && i.wh.toLowerCase() === order.wh.toLowerCase());

    if (!item || item.qty < order.qty) { alert('Błąd: Brak towaru na stanie!'); return; }

    item.qty -= order.qty;
    order.status = 'Zrealizowano';
    alert('Wydano z magazynu!');
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
        item.wh.toLowerCase().includes(searchTxt)
    ).forEach(item => {
        const idx = stock.findIndex(i => i === item);
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><small>${item.code}</small></td>
            <td><strong>${item.name}</strong></td>
            <td>${item.wh}</td>
            <td><b>${item.qty} szt.</b></td>
            <td>${item.flagged ? '⭐' : '-'}</td>
            <td><button class="flag-btn ${item.flagged ? 'active' : 'inactive'}" onclick="toggleFlag(${idx})">Flaga</button></td>
        `;
        tbody.appendChild(tr);
    });
}

function toggleFlag(index) {
    stock[index].flagged = !stock[index].flagged;
    saveToStorage();
    renderStock();
}

function renderFlags() {
    const tbody = document.getElementById('flag-table-body');
    tbody.innerHTML = '';
    stock.filter(item => item.flagged).forEach(item => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${item.code}</td><td><strong>${item.name}</strong></td><td>${item.wh}</td><td><b>${item.qty} szt.</b></td>`;
        tbody.appendChild(tr);
    });
}

updateBadge();
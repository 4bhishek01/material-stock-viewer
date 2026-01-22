document.getElementById('fileInput').addEventListener('change', handleFile);
document.getElementById('searchInput').addEventListener('input', debounceSearch);
document.getElementById('clearBtn').addEventListener('click', clearStoredData);

// IndexedDB setup
const dbName = 'MaterialStockDB';
const storeName = 'stockData';
let db;

function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(dbName, 1);
        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(storeName)) {
                db.createObjectStore(storeName);
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function storeData(data) {
    if (!db) db = await openDB();
    const tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).put(data, 'rows');
}

async function getStoredData() {
    if (!db) db = await openDB();
    return new Promise((resolve) => {
        const tx = db.transaction(storeName, 'readonly');
        const request = tx.objectStore(storeName).get('rows');
        request.onsuccess = () => resolve(request.result || []);
    });
}

async function clearData() {
    if (!db) db = await openDB();
    const tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).clear();
}

// Expected columns (0-based: A=0, B=1, etc.)
const columnMap = {
    materialNo: 1,      // B column (Material No)
    description: 2,     // C column (Material Description) - adjust if wrong
    binNo: 5,           // F column (Bin No)
    valStock: 6,        // G column (Val. Stock)
    mvgAvgPrice: 7      // H column (Mvg. Avg. Price)
};

let data = [];
let filteredData = [];
let currentPage = 1;
const rowsPerPage = 100;

// Auto-load on page open
window.onload = async function() {
    data = await getStoredData();
    if (data.length > 0) {
        filteredData = [...data];
        renderTableHeader(['Material No', 'Material Description', 'Bin No', 'Val. Stock', 'Mvg. Avg. Price']);
        renderPage(currentPage);
    }
};

function handleFile(event) {
    const file = event.target.files[0];
    if (!file) return;

    const password = prompt('Enter password to upload/update Excel:');
    if (password !== 'Kirito01') {
        alert('Incorrect password. Upload denied.');
        return;
    }

    const reader = new FileReader();
    reader.onload = async function(e) {
        const workbook = XLSX.read(e.target.result, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        if (data.length > 0) {
            renderTableHeader(data[0].length > 0 ? data[0] : ['Material No', 'Material Description', 'Bin No', 'Val. Stock', 'Mvg. Avg. Price']);
            data.shift();
            filteredData = [...data];
            await storeData(data);
            renderPage(currentPage);
            alert('Excel uploaded and stored!');
            event.target.value = '';  // Reset file input to allow re-selecting the same file
        }
    };
    reader.readAsBinaryString(file);
}

function renderTableHeader(headers) {
    const thead = document.getElementById('tableHead');
    thead.innerHTML = '<tr>' + headers.map(h => `<th>${h}</th>`).join('') + '</tr>';
}

function renderPage(page) {
    const tbody = document.getElementById('tableBody');
    tbody.innerHTML = '';

    const start = (page - 1) * rowsPerPage;
    const end = start + rowsPerPage;
    const pageData = filteredData.slice(start, end);

    pageData.forEach(row => {
        const tr = document.createElement('tr');
        [columnMap.materialNo, columnMap.description, columnMap.binNo, columnMap.valStock, columnMap.mvgAvgPrice].forEach(colIndex => {
            const td = document.createElement('td');
            td.textContent = row[colIndex] || '';
            tr.appendChild(td);
        });
        tbody.appendChild(tr);
    });

    updatePagination();
}

function updatePagination() {
    const totalPages = Math.ceil(filteredData.length / rowsPerPage);
    document.getElementById('pageInfo').textContent = `Page ${currentPage} of ${totalPages}`;
    document.getElementById('prevBtn').disabled = currentPage === 1;
    document.getElementById('nextBtn').disabled = currentPage === totalPages;
}

function debounceSearch() {
    clearTimeout(window.searchTimeout);
    window.searchTimeout = setTimeout(() => {
        const query = document.getElementById('searchInput').value.toLowerCase().trim();
        if (query === '') {
            filteredData = [...data];
        } else {
            filteredData = data.filter(row =>
                [columnMap.materialNo, columnMap.description, columnMap.binNo, columnMap.valStock, columnMap.mvgAvgPrice].some(colIndex =>
                    String(row[colIndex] || '').toLowerCase().includes(query)
                )
            );
        }
        currentPage = 1;
        renderPage(currentPage);
    }, 300);
}

async function clearStoredData() {
    const password = prompt('Enter password to clear stored data:');
    if (password === 'Kirito01') {
        await clearData();
        data = [];
        filteredData = [];
        document.getElementById('tableHead').innerHTML = '';
        document.getElementById('tableBody').innerHTML = '';
        document.getElementById('pageInfo').textContent = '';
        alert('Stored data cleared!');
    } else {
        alert('Incorrect password. Clear denied.');
    }
}

document.getElementById('prevBtn').addEventListener('click', () => {
    if (currentPage > 1) {
        currentPage--;
        renderPage(currentPage);
    }
});

document.getElementById('nextBtn').addEventListener('click', () => {
    const totalPages = Math.ceil(filteredData.length / rowsPerPage);
    if (currentPage < totalPages) {
        currentPage++;
        renderPage(currentPage);
    }
});
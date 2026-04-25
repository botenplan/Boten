let db;
const request = indexedDB.open("BotenDatabase", 1);

request.onupgradeneeded = (e) => {
    db = e.target.result;
    if (!db.objectStoreNames.contains("boten")) {
        db.createObjectStore("boten", { keyPath: "id", autoIncrement: true });
    }
};

request.onsuccess = (e) => { 
    db = e.target.result; 
    const nameInput = document.getElementById('newBoatName');
    if (nameInput) {
        // Container voor suggesties aanmaken onder het invoerveld
        const suggestionDiv = document.createElement('div');
        suggestionDiv.id = 'nameSuggestions';
        suggestionDiv.style.cssText = "display: none; background: #f9f9f9; border-radius: 8px; margin-top: 5px; border: 1px solid #eee; max-height: 200px; overflow-y: auto; position: relative; z-index: 500;";
        nameInput.parentNode.appendChild(suggestionDiv);

        nameInput.addEventListener('input', showNameSuggestions);
    }
};

let geselecteerdeFotos = [];

// SUBTIELE SUGGESTIES ONDER HET TYPEN (ALLEEN NAAM)
function showNameSuggestions() {
    const input = document.getElementById('newBoatName');
    const container = document.getElementById('nameSuggestions');
    const query = input.value.trim().toLowerCase();

    if (query.length < 1 || !db) {
        container.style.display = 'none';
        return;
    }

    const transaction = db.transaction(["boten"], "readonly");
    const store = transaction.objectStore("boten");
    container.innerHTML = "";
    let foundCount = 0;

    store.openCursor().onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) {
            const naam = cursor.value.naam;
            if (naam.toLowerCase().includes(query)) {
                foundCount++;
                const div = document.createElement('div');
                div.className = "boat-card";
                div.style.padding = "12px";
                div.style.borderBottom = "1px solid #eee";
                div.style.background = "white";
                div.innerText = naam.toUpperCase(); 
                
                div.onclick = () => {
                    showDetails(cursor.value.id);
                    container.style.display = 'none';
                };
                container.appendChild(div);
            }
            cursor.continue();
        } else {
            container.style.display = foundCount > 0 ? 'block' : 'none';
        }
    };
}

function toggleMix(show) { 
    const panel = document.getElementById('mixPanel');
    if (panel) panel.style.display = show ? 'block' : 'none'; 
}

function handleFileSelect(event) {
    const files = event.target.files;
    for (let file of files) {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (e) => {
            geselecteerdeFotos.push(e.target.result);
            renderPreviews();
        };
    }
}

function renderPreviews() {
    const container = document.getElementById('imagePreviewContainer');
    if (!container) return;
    container.innerHTML = "";
    geselecteerdeFotos.forEach((src, index) => {
        const wrapper = document.createElement('div');
        wrapper.style.position = 'relative';
        wrapper.style.display = 'inline-block';
        wrapper.innerHTML = `
            <img src="${src}" class="preview-thumb">
            <div onclick="removePhoto(${index})" style="position:absolute; top:-5px; right:-5px; background:red; color:white; border-radius:50%; width:20px; height:20px; font-size:12px; display:flex; align-items:center; justify-content:center; cursor:pointer; border:2px solid white; z-index:100;">✕</div>
        `;
        container.appendChild(wrapper);
    });
}

function removePhoto(index) {
    geselecteerdeFotos.splice(index, 1);
    renderPreviews();
}

function saveBoat() {
    const naam = document.getElementById('newBoatName').value.trim();
    const editId = document.getElementById('editId').value;
    if (!naam) return alert("Voer een bootnaam in");
    
    const getVal = (sel) => Array.from(document.querySelectorAll(sel + ':checked')).map(c => c.value);
    
    const bootData = {
        naam: naam,
        systeem: getVal('.sys-check'),
        mixData: {
            isMix: document.getElementById('mixTrigger').checked,
            bayVan: document.getElementById('bayVan').value,
            bayTot: document.getElementById('bayTot').value
        },
        baren: getVal('.baren'),
        lashing: getVal('.lashing'),
        draad: getVal('.draad'),
        tb: getVal('.tb'),
        c20: getVal('.c20'),
        tegen: document.getElementById('tegenElkaar').checked,
        opkuis: getVal('.opkuis'), 
        fotos: geselecteerdeFotos,
        notities: document.getElementById('extraNotes').value
    };

    const transaction = db.transaction(["boten"], "readwrite");
    const store = transaction.objectStore("boten");
    if (editId) {
        bootData.id = parseInt(editId);
        store.put(bootData);
    } else {
        store.add(bootData);
    }
    transaction.oncomplete = () => {
        alert("Opgeslagen!");
        location.reload();
    };
}

function searchBoat() {
    const term = document.getElementById('searchBar').value.toLowerCase();
    const list = document.getElementById('liveBoatList');
    if (!db || !term) { list.style.display = "none"; return; }

    const store = db.transaction(["boten"], "readonly").objectStore("boten");
    list.innerHTML = "";
    let found = false;
    
    store.openCursor().onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) {
            if (cursor.value.naam.toLowerCase().includes(term)) {
                found = true;
                const div = document.createElement('div');
                div.className = "boat-card";
                div.innerText = cursor.value.naam.toUpperCase();
                const bid = cursor.value.id;
                div.onclick = () => showDetails(bid);
                list.appendChild(div);
            }
            cursor.continue();
        } else {
            list.style.display = found ? "block" : "none";
        }
    };
}

function showDetails(id) {
    const store = db.transaction(["boten"], "readonly").objectStore("boten");
    store.get(id).onsuccess = (e) => {
        const b = e.target.result;
        if (!b) return;

        document.getElementById('mainView').style.display = 'none';
        document.getElementById('catalogView').style.display = 'none';
        document.getElementById('detailView').style.display = 'block';
        document.getElementById('liveBoatList').style.display = 'none';
        
        const renderRow = (label, val) => {
            if (!val || (Array.isArray(val) && val.length === 0)) return "";
            return `<div class="detail-row"><span class="detail-label">${label}</span><span class="detail-value">${Array.isArray(val) ? val.join(', ') : val}</span></div>`;
        };

        let mixHtml = "";
        if(b.mixData && b.mixData.isMix) {
            mixHtml = renderRow('Mix Bays', `Van ${b.mixData.bayVan} tot ${b.mixData.bayTot}`);
        }

        document.getElementById('detailContent').innerHTML = `
            <div style="float:right;">
                <button class="action-btn" onclick="editBoat(${b.id})">✏️</button>
                <button class="action-btn" onclick="deleteBoat(${b.id})">✖</button>
            </div>
            <h1 style="margin:0 0 20px 0; text-transform: uppercase;">${b.naam}</h1>
            ${renderRow('Systeem', b.systeem)}
            ${mixHtml}
            ${renderRow('Baren', b.baren)}
            ${renderRow('Lashing', b.lashing)}
            ${renderRow('Draad', b.draad)}
            ${renderRow('Turnbuckles', b.tb)}
            ${renderRow('20FT', b.c20)}
            ${b.tegen ? renderRow('Config', 'Tegen elkaar') : ''}
            ${renderRow('Opkuis', b.opkuis)}
            <div style="margin-top:15px;"><label class="label-tiny">OPMERKINGEN</label><p style="white-space: pre-wrap;">${b.notities || '-'}</p></div>
            <div class="img-row">${b.fotos.map(f => `<img src="${f}" class="preview-thumb">`).join('')}</div>
        `;
        window.scrollTo(0,0);
    };
}

function openCatalog() {
    document.getElementById('mainView').style.display = 'none';
    document.getElementById('detailView').style.display = 'none';
    document.getElementById('catalogView').style.display = 'block';
    
    const list = document.getElementById('fullCatalogList');
    if (!list) return;
    
    let count = 0;
    list.innerHTML = `<div style="display:flex; justify-content:space-between; align-items:baseline; border-bottom:1px solid #eee; margin-bottom:20px; padding-bottom:10px;"><h2 style="margin:0">Overzicht</h2><span id="counter" style="color:#a0acba; font-size:14px;">0</span></div><div id="items"></div>`;
    
    const store = db.transaction(["boten"], "readonly").objectStore("boten");
    const itemContainer = document.getElementById('items');

    store.openCursor(null, "prev").onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) {
            count++;
            const div = document.createElement('div');
            div.className = "boat-card";
            div.innerText = cursor.value.naam.toUpperCase();
            const bid = cursor.value.id; 
            div.onclick = () => showDetails(bid);
            itemContainer.appendChild(div);
            cursor.continue();
        } else {
            document.getElementById('counter').innerText = count;
        }
    };
}

function editBoat(id) {
    const store = db.transaction(["boten"], "readonly").objectStore("boten");
    store.get(id).onsuccess = (e) => {
        const b = e.target.result;
        document.getElementById('editId').value = b.id;
        document.getElementById('newBoatName').value = b.naam;
        document.getElementById('extraNotes').value = b.notities || "";
        document.getElementById('tegenElkaar').checked = b.tegen || false;
        
        if(b.mixData) {
            document.getElementById('mixTrigger').checked = b.mixData.isMix;
            document.getElementById('bayVan').value = b.mixData.bayVan || "";
            document.getElementById('bayTot').value = b.mixData.bayTot || "";
            toggleMix(b.mixData.isMix);
        }

        const setChecks = (sel, vals) => {
            document.querySelectorAll(sel).forEach(c => {
                c.checked = (vals && vals.includes(c.value));
            });
        };
        
        setChecks('.sys-check', b.systeem);
        setChecks('.baren', b.baren);
        setChecks('.lashing', b.lashing);
        setChecks('.draad', b.draad);
        setChecks('.tb', b.tb);
        setChecks('.c20', b.c20);
        setChecks('.opkuis', b.opkuis);
        
        geselecteerdeFotos = b.fotos || [];
        renderPreviews();
        document.getElementById('saveBtn').innerText = "WIJZIGING OPSLAAN";
        document.getElementById('detailView').style.display = 'none';
        document.getElementById('catalogView').style.display = 'none';
        document.getElementById('mainView').style.display = 'block';
        window.scrollTo(0,0);
    };
}

function deleteBoat(id) {
    if (confirm("Verwijderen?")) {
        const transaction = db.transaction(["boten"], "readwrite");
        transaction.objectStore("boten").delete(id);
        transaction.oncomplete = () => location.reload();
    }
}

function showMain() { location.reload(); }

document.addEventListener('mousedown', (e) => {
    const list = document.getElementById('liveBoatList');
    const sugg = document.getElementById('nameSuggestions');
    if (list && e.target.id !== 'searchBar' && !list.contains(e.target)) {
        list.style.display = 'none';
    }
    if (sugg && e.target.id !== 'newBoatName' && !sugg.contains(e.target)) {
        sugg.style.display = 'none';
    }
});

let db;

// 1. Service Worker Registratie (VOEGEVOEGD)
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js')
        .then(() => console.log("Service Worker Geregistreerd"))
        .catch(err => console.log("SW registratie mislukt", err));
}

// Database Initialisatie
function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open("BotenDatabase", 1);
        request.onupgradeneeded = (e) => {
            db = e.target.result;
            if (!db.objectStoreNames.contains("boten")) {
                db.createObjectStore("boten", { keyPath: "id", autoIncrement: true });
            }
        };
        request.onsuccess = (e) => {
            db = e.target.result;
            resolve(db);
        };
        request.onerror = (e) => reject("DB Error: " + e.target.errorCode);
    });
}

initDB().then(() => {
    const boatInput = document.getElementById('newBoatName');
    if(boatInput) boatInput.addEventListener('input', showNameSuggestions);
});

let geselecteerdeFotos = [];

async function handleFileSelect(event) {
    const files = event.target.files;
    for (let i = 0; i < files.length; i++) {
        const compressedDataUrl = await compressImage(files[i]);
        geselecteerdeFotos.push(compressedDataUrl);
    }
    renderPreviews();
    event.target.value = ''; 
}

function compressImage(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width; 
                let height = img.height;
                const max_size = 800;
                if (width > height) {
                    if (width > max_size) { height *= max_size / width; width = max_size; }
                } else {
                    if (height > max_size) { width *= max_size / height; height = max_size; }
                }
                canvas.width = width; canvas.height = height;
                canvas.getContext('2d').drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', 0.7));
            };
        };
    });
}

function renderPreviews() {
    const container = document.getElementById('imagePreviewContainer');
    container.innerHTML = "";
    geselecteerdeFotos.forEach((src, index) => {
        const img = document.createElement('img');
        img.src = src; img.className = "preview-thumb";
        img.onclick = () => { geselecteerdeFotos.splice(index, 1); renderPreviews(); };
        container.appendChild(img);
    });
}

function saveBoat() {
    const naam = document.getElementById('newBoatName').value.trim();
    if (!naam) { alert("Voer een naam in"); return; }
    
    const getChecked = (sel) => Array.from(document.querySelectorAll(sel + ':checked')).map(cb => cb.value);
    
    const bootData = {
        naam: naam,
        systeem: getChecked('.sys-check'),
        baren: getChecked('.baren'),
        lashing: getChecked('.lashing'),
        draad: getChecked('.draad'),
        tb: getChecked('.tb'),
        c20: getChecked('.c20'),
        opkuis: getChecked('.opkuis'),
        notities: document.getElementById('extraNotes').value,
        fotos: geselecteerdeFotos,
        mix: { van: document.getElementById('bayVan').value, tot: document.getElementById('bayTot').value },
        tegenElkaar: document.getElementById('tegenElkaar').checked
    };

    const transaction = db.transaction(["boten"], "readwrite");
    const store = transaction.objectStore("boten");
    const editId = document.getElementById('editId').value;

    if (editId) {
        bootData.id = parseInt(editId);
        store.put(bootData);
    } else {
        store.add(bootData);
    }

    transaction.oncomplete = () => { 
        alert("Boot opgeslagen!"); 
        showMain(); 
    };
}

function openCatalog() {
    document.getElementById('mainView').style.display = 'none';
    document.getElementById('detailView').style.display = 'none';
    document.getElementById('liveView').style.display = 'none';
    document.getElementById('catalogView').style.display = 'block';
    document.getElementById('searchWrapper').style.display = 'none';
    
    const list = document.getElementById('fullCatalogList');
    list.innerHTML = "";

    db.transaction(["boten"], "readonly").objectStore("boten").getAll().onsuccess = (e) => {
        const boten = e.target.result.sort((a, b) => a.naam.localeCompare(b.naam));
        document.getElementById('boatCount').innerText = boten.length;
        boten.forEach(b => {
            const div = document.createElement('div');
            div.className = "input-group";
            div.style.display = "flex";
            div.style.justifyContent = "space-between";
            div.style.alignItems = "center";
            div.style.padding = "12px 0";
            div.innerHTML = `
                <div onclick="showDetails(${b.id})" style="flex:1; cursor:pointer;">
                    <div style="font-size:16px; font-weight:600; color: #333;">${b.naam}</div>
                </div>
                <div style="color:#a0acba; font-size:18px; padding:5px 10px; cursor:pointer;" onclick="event.stopPropagation(); editBoat(${b.id})">✎</div>
            `;
            list.appendChild(div);
        });
    };
}

function showDetails(id) {
    db.transaction(["boten"], "readonly").objectStore("boten").get(id).onsuccess = (e) => {
        const b = e.target.result;
        const cont = document.getElementById('detailContent');
        let html = `<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
                        <h1 style="margin:0; font-size: 20px;">${b.naam}</h1>
                        <button onclick="deleteBoat(${b.id})" style="background:none; border:none; font-size:20px; cursor:pointer;">🗑️</button>
                    </div>`;

        const addRow = (label, val) => {
            if(val && (Array.isArray(val) ? val.length > 0 : val !== "")) {
                html += `<div class="input-group"><label class="label-tiny">${label}</label>
                         <div style="font-size:16px; font-weight:500;">${Array.isArray(val) ? val.join(', ') : val}</div></div>`;
            }
        };

        let systeemTekst = b.systeem ? b.systeem.join(', ') : "";
        if(b.systeem && b.systeem.includes('Mix')) {
            systeemTekst = systeemTekst.replace('Mix', `Mix (Bay ${b.mix.van || '?'}-${b.mix.tot || '?'})`);
        }

        addRow("SYSTEEM", systeemTekst);
        addRow("BAREN", b.baren);
        addRow("LASHING", b.lashing);
        addRow("DRAAD", b.draad);
        addRow("TURNBUCKLES", b.tb);
        
        let c20data = b.c20 ? [...b.c20] : [];
        if(b.tegenElkaar) c20data.push("Tegen elkaar");
        addRow("20FT", c20data);
        
        addRow("OPKUIS", b.opkuis);
        addRow("OPMERKINGEN", b.notities);

        if(b.fotos && b.fotos.length > 0) {
            html += `<label class="label-tiny" style="margin-top:15px">FOTO'S</label><div class="img-row">`;
            b.fotos.forEach(f => { html += `<img src="${f}" style="width:120px; height:120px; border-radius:10px; object-fit:cover;">`; });
            html += `</div>`;
        }

        cont.innerHTML = html;
        // Verberg alles behalve details
        document.getElementById('mainView').style.display = 'none';
        document.getElementById('catalogView').style.display = 'none';
        document.getElementById('liveView').style.display = 'none';
        document.getElementById('searchWrapper').style.display = 'none'; // Verberg zoekbalk bij details
        document.getElementById('detailView').style.display = 'block';
        window.scrollTo(0,0);
    };
}

function editBoat(id) {
    db.transaction(["boten"], "readonly").objectStore("boten").get(id).onsuccess = (e) => {
        const b = e.target.result;
        document.getElementById('editId').value = b.id;
        document.getElementById('newBoatName').value = b.naam;
        document.getElementById('extraNotes').value = b.notities || "";
        document.getElementById('bayVan').value = (b.mix && b.mix.van) ? b.mix.van : "";
        document.getElementById('bayTot').value = (b.mix && b.mix.tot) ? b.mix.tot : "";
        document.getElementById('tegenElkaar').checked = b.tegenElkaar || false;
        
        const checkAll = (sel, vals) => {
            document.querySelectorAll(sel).forEach(cb => cb.checked = vals ? vals.includes(cb.value) : false);
        };
        checkAll('.sys-check', b.systeem);
        checkAll('.baren', b.baren);
        checkAll('.lashing', b.lashing);
        checkAll('.draad', b.draad);
        checkAll('.tb', b.tb);
        checkAll('.c20', b.c20);
        checkAll('.opkuis', b.opkuis);
        
        geselecteerdeFotos = b.fotos || [];
        renderPreviews();
        toggleMix(b.systeem && b.systeem.includes('Mix'));
        
        document.getElementById('catalogView').style.display = 'none';
        document.getElementById('detailView').style.display = 'none';
        document.getElementById('mainView').style.display = 'block';
        document.getElementById('searchWrapper').style.display = 'flex';
        document.getElementById('saveBtn').innerText = "WIJZIGINGEN OPSLAAN";
        window.scrollTo(0,0);
    };
}

function showNameSuggestions() {
    const query = this.value.toLowerCase();
    const container = document.getElementById('nameSuggestions');
    if (query.length < 2) { container.style.display = 'none'; return; }
    db.transaction(["boten"], "readonly").objectStore("boten").getAll().onsuccess = (e) => {
        const matches = e.target.result.filter(b => b.naam.toLowerCase().includes(query));
        container.innerHTML = "";
        if (matches.length > 0) {
            container.style.display = 'block';
            matches.forEach(m => {
                const d = document.createElement('div');
                d.style.padding = "10px"; d.style.borderBottom = "1px solid #eee"; d.style.cursor = "pointer";
                d.innerHTML = `Bestaat al: <b>${m.naam}</b>`;
                d.onclick = () => { container.style.display='none'; showDetails(m.id); };
                container.appendChild(d);
            });
        } else { container.style.display = 'none'; }
    };
}

function searchBoat() {
    const q = document.getElementById('searchBar').value.toLowerCase();
    const list = document.getElementById('liveBoatList');
    if (q.length < 1) { list.style.display = 'none'; return; }
    
    db.transaction(["boten"], "readonly").objectStore("boten").getAll().onsuccess = (e) => {
        const results = e.target.result.filter(b => b.naam.toLowerCase().includes(q));
        list.innerHTML = "";
        if(results.length > 0) {
            list.style.display = 'block';
            results.forEach(b => {
                const i = document.createElement('div');
                i.className = "search-result-item"; 
                i.innerHTML = b.naam;
                i.onclick = () => { 
                    showDetails(b.id); 
                    list.style.display = 'none'; 
                    document.getElementById('searchBar').value = ''; 
                };
                list.appendChild(i);
            });
        } else {
            list.style.display = 'none';
        }
    };
}

function showMain() {
    document.getElementById('editId').value = "";
    document.getElementById('newBoatName').value = "";
    document.getElementById('extraNotes').value = "";
    document.getElementById('bayVan').value = "";
    document.getElementById('bayTot').value = "";
    document.getElementById('tegenElkaar').checked = false;
    document.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
    geselecteerdeFotos = [];
    renderPreviews();
    document.getElementById('saveBtn').innerText = "OPSLAAN";
    document.getElementById('mainView').style.display = 'block';
    document.getElementById('catalogView').style.display = 'none';
    document.getElementById('detailView').style.display = 'none';
    document.getElementById('liveView').style.display = 'none';
    document.getElementById('searchWrapper').style.display = 'flex';
    document.getElementById('liveBoatList').style.display = 'none';
    toggleMix(false);
}

function toggleMix(s) { document.getElementById('mixPanel').style.display = s ? 'block' : 'none'; }
function openLivePlanning() { 
    document.getElementById('mainView').style.display = 'none'; 
    document.getElementById('catalogView').style.display = 'none'; 
    document.getElementById('detailView').style.display = 'none';
    document.getElementById('liveView').style.display = 'block'; 
    document.getElementById('searchWrapper').style.display = 'none'; 
}
function deleteBoat(id) { if(confirm("Wissen?")) db.transaction(["boten"],"readwrite").objectStore("boten").delete(id).onsuccess=()=>openCatalog(); }
function switchPlanning(t) {
    document.getElementById('frameIn').style.display = t === 'in' ? 'block' : 'none';
    document.getElementById('frameOut').style.display = t === 'out' ? 'block' : 'none';
    document.getElementById('btnIn').classList.toggle('active', t === 'in');
    document.getElementById('btnOut').classList.toggle('active', t === 'out');
}

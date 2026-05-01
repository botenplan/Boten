let db;

// Functie om de live kaart te openen of te sluiten
function toggleMap(show, mmsi = '', naam = '') {
    const wrapper = document.getElementById('mapWrapper');
    const frame = document.getElementById('liveMapFrame');
    
    if (show) {
        let url = "";
        if (mmsi && mmsi.toString().length > 5) {
            url = `https://www.vesselfinder.com/aismap?zoom=13&mmsi=${mmsi.trim()}&names=true`;
        } else {
            url = `https://www.vesselfinder.com/aismap?zoom=13&name=${encodeURIComponent(naam)}&names=true`;
        }
        
        frame.src = url;
        wrapper.style.display = 'block';
    } else {
        wrapper.style.display = 'none';
        frame.src = ""; 
    }
}

// Service Worker Registratie
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js')
        .then(() => console.log("Service Worker Geregistreerd"))
        .catch(err => console.log("SW registratie mislukt", err));
}

// Database Initialisatie
function initDB() {
    return new Promise((resolve) => {
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
        reader.onload = (e) => {
            const img = new Image();
            img.src = e.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let w = img.width; let h = img.height;
                if (w > 800) { h *= 800/w; w = 800; }
                canvas.width = w; canvas.height = h;
                canvas.getContext('2d').drawImage(img, 0, 0, w, h);
                resolve(canvas.toDataURL('image/jpeg', 0.7));
            };
        };
    });
}

function renderPreviews() {
    const cont = document.getElementById('imagePreviewContainer');
    cont.innerHTML = "";
    geselecteerdeFotos.forEach((src, index) => {
        const img = document.createElement('img');
        img.src = src; img.className = "preview-thumb";
        img.onclick = () => { geselecteerdeFotos.splice(index, 1); renderPreviews(); };
        cont.appendChild(img);
    });
}

function saveBoat() {
    const naam = document.getElementById('newBoatName').value.trim();
    const mmsi = document.getElementById('boatMmsi').value.trim();
    if (!naam) return alert("Voer een naam in");
    
    const getChecked = (sel) => Array.from(document.querySelectorAll(sel + ':checked')).map(cb => cb.value);
    
    const bootData = {
        naam: naam,
        mmsi: mmsi,
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

    transaction.oncomplete = () => { alert("Boot opgeslagen!"); showMain(); };
}

function showDetails(id) {
    db.transaction(["boten"], "readonly").objectStore("boten").get(id).onsuccess = (e) => {
        const b = e.target.result;
        toggleMap(false);
        document.getElementById('detailName').innerText = b.naam;
        document.getElementById('mapBtn').onclick = () => toggleMap(true, b.mmsi, b.naam);
        document.getElementById('delBtn').onclick = () => deleteBoat(b.id);
        
        const cont = document.getElementById('detailContent');
        let html = "";
        
        const addRow = (label, val) => {
            if(val && (Array.isArray(val) ? val.length > 0 : val !== "")) {
                html += `<div class="input-group"><label class="label-tiny">${label}</label>
                         <div style="font-size:16px; font-weight:500;">${val}</div></div>`;
            }
        };

        // AUTOMATISCHE VERWERKING: Als 'Mix' aan staat, komt er altijd "op Scheel" achter[span_2](start_span)[span_2](end_span)
        let systeemLijst = b.systeem ? [...b.systeem] : [];
        let systeemWeergave = "";

        if(systeemLijst.includes('Mix')) {
            // De tekst "op Scheel" wordt nu automatisch toegevoegd en in het klein gezet[span_3](start_span)[span_3](end_span)
            let kleinType = `<span style="color: #7f8c8d; font-size: 0.85em; font-weight: 400; margin-left: 4px;">("op Scheel")</span>`;

            let van = b.mix?.van || "";
            let tot = b.mix?.tot || "";
            
            let bayZin = "";
            if (van) {
                bayZin = van + (tot ? " t.e.m. " + tot : "");
            }

            let mixTekst = `${bayZin} ${kleinType}`.trim();
            
            // Filter 'Mix' eruit voor de lijst, maar behoud de andere systemen als die er zijn[span_4](start_span)[span_4](end_span)
            let overig = systeemLijst.filter(s => s !== 'Mix');
            systeemWeergave = overig.length > 0 ? mixTekst + ", " + overig.join(', ') : mixTekst;
        } else {
            systeemWeergave = systeemLijst.join(', ');
        }

        addRow("SYSTEEM", systeemWeergave);
        addRow("BAREN", b.baren ? b.baren.join(', ') : "");
        addRow("LASHING", b.lashing ? b.lashing.join(', ') : "");
        addRow("DRAAD", b.draad ? b.draad.join(', ') : "");
        addRow("TURNBUCKLES", b.tb ? b.tb.join(', ') : "");
        
        let c20data = b.c20 ? [...b.c20] : [];
        if(b.tegenElkaar) c20data.push("Tegen elkaar");
        addRow("20FT", c20data.join(', '));
        
        addRow("OPKUIS", b.opkuis ? b.opkuis.join(', ') : "");
        addRow("OPMERKINGEN", b.notities);

        if(b.fotos && b.fotos.length > 0) {
            html += `<label class="label-tiny" style="margin-top:15px">FOTO'S</label><div class="img-row">`;
            b.fotos.forEach(f => { 
                html += `<img src="${f}" onclick="openZoom('${f}')" style="width:120px; height:120px; border-radius:10px; object-fit:cover; cursor:pointer;">`; 
            });
            html += `</div>`;
        }
        
        html += `<div style="padding: 20px 0;"><button class="btn-flat" onclick="editBoat(${b.id})">BEWERKEN</button></div>`;
        cont.innerHTML = html;

        document.getElementById('mainView').style.display = 'none';
        document.getElementById('catalogView').style.display = 'none';
        document.getElementById('detailView').style.display = 'block';
        window.scrollTo(0,0);
    };
}

function openCatalog() {
    document.getElementById('mainView').style.display = 'none';
    document.getElementById('catalogView').style.display = 'block';
    document.getElementById('detailView').style.display = 'none';
    document.getElementById('liveView').style.display = 'none';
    
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
                <div style="color:#a0acba; font-size:18px; padding:5px 10px; cursor:pointer;" onclick="editBoat(${b.id})">✎</div>
            `;
            list.appendChild(div);
        });
    };
}

function editBoat(id) {
    db.transaction(["boten"], "readonly").objectStore("boten").get(id).onsuccess = (e) => {
        const b = e.target.result;
        document.getElementById('editId').value = b.id;
        document.getElementById('newBoatName').value = b.naam;
        document.getElementById('boatMmsi').value = b.mmsi || "";
        document.getElementById('extraNotes').value = b.notities || "";
        document.getElementById('bayVan').value = b.mix?.van || "";
        document.getElementById('bayTot').value = b.mix?.tot || "";
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

function showNameSuggestions() {
    const query = this.value.toLowerCase();
    const container = document.getElementById('nameSuggestions');
    if (!container) return;
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

function showMain() {
    document.getElementById('editId').value = "";
    document.getElementById('newBoatName').value = "";
    document.getElementById('boatMmsi').value = ""; 
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

function deleteBoat(id) { 
    if(confirm("Boot verwijderen?")) {
        db.transaction(["boten"],"readwrite").objectStore("boten").delete(id).onsuccess = () => openCatalog();
    }
}

function toggleMix(s) { 
    const panel = document.getElementById('mixPanel');
    if(panel) panel.style.display = s ? 'block' : 'none'; 
}

function openLivePlanning() { 
    document.getElementById('mainView').style.display = 'none'; 
    document.getElementById('catalogView').style.display = 'none'; 
    document.getElementById('detailView').style.display = 'none';
    document.getElementById('liveView').style.display = 'block'; 
    document.getElementById('searchWrapper').style.display = 'none'; 
}

function switchPlanning(t) {
    document.getElementById('frameIn').style.display = t === 'in' ? 'block' : 'none';
    document.getElementById('frameOut').style.display = t === 'out' ? 'block' : 'none';
    document.getElementById('btnIn').classList.toggle('active', t === 'in');
    document.getElementById('btnOut').classList.toggle('active', t === 'out');
}

function openZoom(src) {
    const overlay = document.getElementById('photoZoomOverlay');
    const zoomedImg = document.getElementById('zoomedImage');
    zoomedImg.src = src;
    overlay.style.display = 'flex';
}

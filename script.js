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
    document.getElementById('newBoatName').addEventListener('input', showNameSuggestions);
};

let geselecteerdeFotos = [];

async function handleFileSelect(event) {
    const files = event.target.files;
    for (let i = 0; i < files.length; i++) {
        const compressedDataUrl = await compressImage(files[i]);
        geselecteerdeFotos.push(compressedDataUrl);
    }
    renderPreviews();
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
                let width = img.width; let height = img.height;
                if (width > 800) { height *= 800 / width; width = 800; }
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

    transaction.oncomplete = () => { alert("Boot opgeslagen!"); location.reload(); };
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
        const boten = e.target.result;
        document.getElementById('boatCount').innerText = boten.length;
        boten.forEach(b => {
            const div = document.createElement('div');
            div.className = "input-group";
            div.style.display = "flex";
            div.style.justifyContent = "space-between";
            div.style.alignItems = "center";
            // De extra tekst onder de naam is hier nu verwijderd
            div.innerHTML = `
                <div onclick="showDetails(${b.id})" style="flex:1; padding: 10px 0;">
                    <div style="font-size:18px; font-weight:700; color: #333;">${b.naam}</div>
                </div>
                <div style="color:#a0acba; font-size:22px; padding:10px; cursor:pointer;" onclick="editBoat(${b.id})">✎</div>
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
                        <h1 style="margin:0">${b.naam}</h1>
                        <button onclick="deleteBoat(${b.id})" style="background:none; border:none; font-size:20px; cursor:pointer;">🗑️</button>
                    </div>`;

        const addRow = (label, val) => {
            if(val && val.length > 0) {
                html += `<div class="input-group"><label class="label-tiny">${label}</label>
                         <div style="font-size:18px; font-weight:500;">${Array.isArray(val) ? val.join(', ') : val}</div></div>`;
            }
        };

        if (b.systeem && b.systeem.length > 0) {
            let sysText = b.systeem.join(', ');
            if (b.systeem.includes('Mix')) sysText += ` (Bay ${b.mix.van}-${b.mix.tot})`;
            addRow("SYSTEEM", sysText);
        }
        
        addRow("BAREN", b.baren);
        addRow("LASHING", b.lashing);
        addRow("DRAAD", b.draad);
        addRow("TURNBUCKLES", b.tb);
        
        let c20Full = [...b.c20];
        if(b.tegenElkaar) c20Full.push("Tegen elkaar");
        addRow("20FT", c20Full);
        
        addRow("OPKUIS", b.opkuis);
        addRow("OPMERKINGEN", b.notities);

        if(b.fotos && b.fotos.length > 0) {
            html += `<label class="label-tiny" style="margin-top:15px">FOTO'S</label><div class="img-row">`;
            b.fotos.forEach(f => { html += `<img src="${f}" style="width:100px; height:100px; border-radius:10px; object-fit:cover;">`; });
            html += `</div>`;
        }

        cont.innerHTML = html;
        document.getElementById('catalogView').style.display = 'none';
        document.getElementById('detailView').style.display = 'block';
    };
}

function editBoat(id) {
    db.transaction(["boten"], "readonly").objectStore("boten").get(id).onsuccess = (e) => {
        const b = e.target.result;
        document.getElementById('editId').value = b.id;
        document.getElementById('newBoatName').value = b.naam;
        document.getElementById('extraNotes').value = b.notities || "";
        document.getElementById('bayVan').value = b.mix.van || "";
        document.getElementById('bayTot').value = b.mix.tot || "";
        document.getElementById('tegenElkaar').checked = b.tegenElkaar;
        
        const checkAll = (sel, vals) => {
            document.querySelectorAll(sel).forEach(cb => cb.checked = vals.includes(cb.value));
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
        toggleMix(b.systeem.includes('Mix'));
        
        document.getElementById('catalogView').style.display = 'none';
        document.getElementById('mainView').style.display = 'block';
        document.getElementById('searchWrapper').style.display = 'flex';
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
                d.style.padding = "10px"; d.innerHTML = `Bestaat al: <b>${m.naam}</b>`;
                d.onclick = () => showDetails(m.id);
                container.appendChild(d);
            });
        } else { container.style.display = 'none'; }
    };
}

function searchBoat() {
    const q = document.getElementById('searchBar').value.toLowerCase();
    const list = document.getElementById('liveBoatList');
    if (q.length < 1) { list.style.display = 'none'; return; }
    db.transaction(["boten"]).objectStore("boten").getAll().onsuccess = (e) => {
        const results = e.target.result.filter(b => b.naam.toLowerCase().includes(q));
        list.innerHTML = "";
        if(results.length > 0) {
            list.style.display = 'block';
            results.forEach(b => {
                const i = document.createElement('div');
                i.className = "search-result-item"; i.innerHTML = b.naam;
                i.onclick = () => { showDetails(b.id); list.style.display = 'none'; };
                list.appendChild(i);
            });
        }
    };
}

function showMain() { location.reload(); }
function toggleMix(s) { document.getElementById('mixPanel').style.display = s ? 'block' : 'none'; }
function openLivePlanning() { document.getElementById('mainView').style.display = 'none'; document.getElementById('liveView').style.display = 'block'; document.getElementById('searchWrapper').style.display = 'none'; }
function deleteBoat(id) { if(confirm("Wissen?")) db.transaction(["boten"],"readwrite").objectStore("boten").delete(id).onsuccess=()=>showMain(); }
function switchPlanning(t) {
    document.getElementById('frameIn').style.display = t === 'in' ? 'block' : 'none';
    document.getElementById('frameOut').style.display = t === 'out' ? 'block' : 'none';
    document.getElementById('btnIn').classList.toggle('active', t === 'in');
    document.getElementById('btnOut').classList.toggle('active', t === 'out');
}

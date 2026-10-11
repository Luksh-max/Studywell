/* Local data layer: IndexedDB first, with a localStorage fallback. */
(() => {
    const DB_NAME = "studywell-local";
    const DB_VERSION = 1;
    const STORE = "records";
    let dbPromise;
    let fallback = false;
    function openDB() {
        if (dbPromise)
            return dbPromise;
        dbPromise = new Promise((resolve, reject) => {
            if (!("indexedDB" in window)) {
                fallback = true;
                resolve(null);
                return;
            }
            let request;
            try {
                request = indexedDB.open(DB_NAME, DB_VERSION);
            }
            catch {
                fallback = true;
                resolve(null);
                return;
            }
            request.onupgradeneeded = () => {
                const db = request.result;
                if (!db.objectStoreNames.contains(STORE))
                    db.createObjectStore(STORE, { keyPath: "id" });
            };
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => {
                fallback = true;
                resolve(null);
            };
            request.onblocked = () => {
                fallback = true;
                resolve(null);
            };
        });
        return dbPromise;
    }
    function fallbackRead() {
        try {
            return JSON.parse(localStorage.getItem("studywell_records") || "[]");
        }
        catch {
            return [];
        }
    }
    function fallbackWrite(rows) {
        try {
            localStorage.setItem("studywell_records", JSON.stringify(rows));
            return true;
        }
        catch {
            return false;
        }
    }
    async function all(type) {
        const db = await openDB();
        if (!db || fallback)
            return fallbackRead().filter((row) => !type || row.type === type);
        return new Promise((resolve) => {
            const request = db.transaction(STORE, "readonly").objectStore(STORE).getAll();
            request.onsuccess = () => resolve((request.result || []).filter((row) => !type || row.type === type));
            request.onerror = () => resolve(fallbackRead().filter((row) => !type || row.type === type));
        });
    }
    async function put(type, value) {
        const row = { ...value, id: String(value.id || crypto.randomUUID()), type, updatedAt: Date.now() };
        const db = await openDB();
        if (!db || fallback) {
            const rows = fallbackRead();
            const index = rows.findIndex((item) => item.id === row.id);
            if (index >= 0)
                rows[index] = row;
            else
                rows.push(row);
            if (!fallbackWrite(rows))
                throw new Error("Storage is full or unavailable.");
            return row;
        }
        return new Promise((resolve, reject) => {
            const request = db.transaction(STORE, "readwrite").objectStore(STORE).put(row);
            request.onsuccess = () => resolve(row);
            request.onerror = () => reject(request.error || new Error("Could not save this item."));
        });
    }
    async function remove(id) {
        const db = await openDB();
        if (!db || fallback) {
            const rows = fallbackRead().filter((row) => row.id !== id);
            if (!fallbackWrite(rows))
                throw new Error("Could not update local storage.");
            return;
        }
        return new Promise((resolve, reject) => {
            const request = db.transaction(STORE, "readwrite").objectStore(STORE).delete(String(id));
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error || new Error("Could not delete this item."));
        });
    }
    async function clear() {
        const db = await openDB();
        if (!db || fallback) {
            localStorage.removeItem("studywell_records");
            return;
        }
        return new Promise((resolve, reject) => {
            const request = db.transaction(STORE, "readwrite").objectStore(STORE).clear();
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error || new Error("Could not clear local data."));
        });
    }
    async function exportAll() {
        const rows = await all();
        return { app: "StudyWell", schemaVersion: 2, exportedAt: new Date().toISOString(), records: rows, settings: Object.fromEntries(Object.keys(localStorage).filter((key) => (key.startsWith("sw_") || key.startsWith("studywell_")) && !["sw_pin_verifier", "sw_pin_attempts", "sw_pin_wait_until", "sw_unlocked"].includes(key)).map((key) => [key, localStorage.getItem(key)])) };
    }
    async function importAll(data, mode = "replace") {
        if (!data || data.app !== "StudyWell" || !Array.isArray(data.records) || data.records.length > 100000)
            throw new Error("This is not a valid StudyWell backup.");
        const allowed = new Set(["task", "chapter", "flashcard", "session", "mood", "journal", "mission", "breathing", "distraction"]);
        const hasInvalidRecord = data.records.some((row) => !row ||
            typeof row !== "object" ||
            !allowed.has(row.type) ||
            typeof row.id !== "string" ||
            row.id.length === 0 ||
            row.id.length >= 200);
        if (hasInvalidRecord) {
            throw new Error("This backup contains invalid records. Your current data has not been changed.");
        }
        const clean = data.records.map((row) => ({
            ...row,
            id: String(row.id),
            type: row.type
        }));
        if (mode === "replace") {
            await clear();
            for (const key of Object.keys(localStorage)) {
                if ((key.startsWith("sw_") || key.startsWith("studywell_")) && !["sw_pin_verifier", "sw_pin_attempts", "sw_pin_wait_until", "sw_unlocked"].includes(key))
                    localStorage.removeItem(key);
            }
        }
        for (const row of clean)
            await put(row.type, row);
        if (data.settings && typeof data.settings === "object") {
            for (const [key, value] of Object.entries(data.settings)) {
                if (/^(sw_|studywell_)/.test(key) && !["sw_pin_verifier", "sw_pin_attempts", "sw_pin_wait_until", "sw_unlocked"].includes(key) && typeof value === "string" && value.length < 200000)
                    localStorage.setItem(key, value);
            }
        }
        return clean.length;
    }
    window.SWStore = { all, put, remove, clear, exportAll, importAll, get usingFallback() { return fallback; } };
})();

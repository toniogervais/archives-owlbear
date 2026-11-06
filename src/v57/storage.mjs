const dbName = "archives-imaginaire-owlbear";
const storeName = "scenarios";

export function openScenario(room, owner) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(storeName);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(Error("Une autre vue utilise la sauvegarde. Ferme-la puis réessaie."));
    request.onsuccess = () => {
      const db = request.result;
      const key = [room, owner];
      db.onversionchange = () => db.close();
      let version;
      resolve({
        load() {
          return new Promise((resolveLoad, rejectLoad) => {
            const read = db.transaction(storeName).objectStore(storeName).get(key);
            read.onsuccess = () => {
              version = read.result?.version || 0;
              resolveLoad(read.result?.snapshot || null);
            };
            read.onerror = () => rejectLoad(read.error);
          });
        },
        save(snapshot) {
          return new Promise((resolveSave, rejectSave) => {
            const transaction = db.transaction(storeName, "readwrite");
            const store = transaction.objectStore(storeName);
            const read = store.get(key);
            let conflict = false;
            read.onsuccess = () => {
              conflict = (read.result?.version || 0) !== version;
              if (conflict) transaction.abort();
              else store.put({version:version + 1, snapshot}, key);
            };
            transaction.oncomplete = () => { version++; resolveSave(); };
            transaction.onabort = () => rejectSave(conflict
              ? Error("Une autre vue a modifié ce scénario. Télécharge ta copie avant de fermer.")
              : transaction.error || Error("Sauvegarde impossible dans ce navigateur."));
          });
        },
        close() { db.close(); }
      });
    };
  });
}

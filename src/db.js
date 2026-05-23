const DB_NAME = "FitAIDatabase";
const DB_VERSION = 1;

export function initDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = (event) => reject(event.target.error);
    request.onsuccess = (event) => resolve(event.target.result);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains("users")) {
        db.createObjectStore("users", { keyPath: "email" });
      }
      if (!db.objectStoreNames.contains("userData")) {
        db.createObjectStore("userData", { keyPath: "email" });
      }
    };
  });
}

export async function registerUser(name, email, password) {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(["users", "userData"], "readwrite");
    const usersStore = transaction.objectStore("users");
    const checkRequest = usersStore.get(email);

    checkRequest.onsuccess = () => {
      if (checkRequest.result) {
        reject(new Error("El usuario ya existe."));
        return;
      }
      
      usersStore.put({ name, email, password });
      
      const userDataStore = transaction.objectStore("userData");
      userDataStore.put({
        email,
        profile: {
          age: "25", weight: "70", startWeight: "70", targetWeight: "68", height: "175",
          sex: "hombre", trainingLevel: "intermedio", activityLevel: "media", sleepGoal: "8",
          stepsGoal: "8000", workoutMinutes: 45
        },
        goal: "definir",
        foodHistory: [], // Empezar sin comidas pre-registradas
        workoutsHistory: [], // Empezar sin entrenamientos pre-registrados
        weightHistory: [
          { date: new Date().toISOString().split('T')[0], weight: 70 }
        ],
        geminiApiKey: "", // Se usará por defecto el del sistema si está vacío
        darkMode: false,
        healthConnected: false,
        subscription: "free"
      });
    };
    
    transaction.oncomplete = () => resolve({ name, email });
    transaction.onerror = (event) => reject(event.target.error);
  });
}

export async function loginUser(email, password) {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(["users"], "readonly");
    const store = transaction.objectStore("users");
    const request = store.get(email);

    request.onsuccess = () => {
      const user = request.result;
      if (!user) {
        reject(new Error("Usuario no encontrado."));
        return;
      }
      if (user.password !== password) {
        reject(new Error("Contraseña incorrecta."));
        return;
      }
      resolve(user);
    };
    request.onerror = (event) => reject(event.target.error);
  });
}

export async function getUserData(email) {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(["userData"], "readonly");
    const store = transaction.objectStore("userData");
    const request = store.get(email);

    request.onsuccess = () => resolve(request.result);
    request.onerror = (event) => reject(event.target.error);
  });
}

export async function saveUserData(email, data) {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(["userData"], "readwrite");
    const store = transaction.objectStore("userData");
    
    const request = store.get(email);
    request.onsuccess = () => {
      const existing = request.result || { email };
      store.put({ ...existing, ...data });
    };

    transaction.oncomplete = () => resolve();
    transaction.onerror = (event) => reject(event.target.error);
  });
}

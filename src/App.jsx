import React, { useMemo, useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { motion } from "framer-motion";
import {
  Activity, ArrowLeft, Bell, Bot, Camera, CheckCircle2, ChevronLeft, ChevronRight,
  Coffee, Crown, Dumbbell, Flame, HeartPulse, Home, LineChart, Lock, Mail,
  MessageCircle, Moon, Plus, Salad, Save, Send, Settings, Sparkles, Sun, Target,
  Timer, Trash2, User, Utensils, X, Zap, Footprints, Scale, Ruler, Bed,
  TrendingUp, TrendingDown, LogOut, CreditCard, Headphones, Shield, Key
} from "lucide-react";
import "./styles.css";
import { initDB, registerUser, loginUser, getUserData, saveUserData } from "./db";

const todayKey = (() => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
})();
const monthNames = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

const goals = [
  { id: "definir", title: "Definir", desc: "Perder grasa manteniendo músculo", iconName: "Flame" },
  { id: "mantener", title: "Mantener", desc: "Mantener forma y rendimiento", iconName: "Scale" },
  { id: "volumen", title: "Volumen", desc: "Ganar masa muscular controlando grasa", iconName: "Dumbbell" },
];

function GoalIcon({ name, ...props }) {
  const map = { Flame, Scale, Dumbbell };
  const Icon = map[name] || Target;
  return <Icon {...props} />;
}

const seedWorkouts = [
  { name: "Pecho + tríceps", time: "48 min", kcal: 420, exercises: "Press banca, press inclinado, aperturas, fondos, extensiones de tríceps", dateKey: "2026-05-20", intensity: "Media" },
  { name: "Pierna completa", time: "62 min", kcal: 610, exercises: "Sentadillas, prensa, peso muerto rumano, zancadas, curl femoral", dateKey: "2026-05-21", intensity: "Alta" },
  { name: "Cardio suave", time: "30 min", kcal: 260, exercises: "Cinta + bici", dateKey: todayKey, intensity: "Baja" },
];

const seedMeals = [
  { name: "Bowl de pollo con arroz integral", kcal: 620, protein: 42, carbs: 58, fat: 18, dateKey: todayKey, confidence: 88, ingredients: ["pechuga de pollo a la plancha", "arroz integral cocido"], portions: ["pollo: 150g", "arroz: 150g"], aiNote: "Buen aporte proteico. Faltan verduras para completar el plato. Añade brócoli o espinacas para mejorar el perfil de micronutrientes.", mealType: "comida" },
  { name: "Tostadas integrales con huevo + café", kcal: 390, protein: 17, carbs: 45, fat: 14, dateKey: todayKey, confidence: 85, ingredients: ["pan integral", "huevos revueltos", "café solo"], portions: ["pan: 2 rebanadas (60g)", "huevos: 2 piezas (120g)"], aiNote: "Desayuno aceptable. Proteína insuficiente para el objetivo. Añade 1 clara extra o 30g de queso fresco para mejorar.", mealType: "desayuno" },
];

function formatDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
}

function createCalendarCells(year, month) {
  const first = new Date(year, month, 1);
  const days = new Date(year, month + 1, 0).getDate();
  const start = (first.getDay() + 6) % 7;
  const prevDays = new Date(year, month, 0).getDate();

  return Array.from({ length: 42 }, (_, i) => {
    const d = i - start + 1;
    let date;
    let currentMonth = true;
    if (d < 1) {
      date = new Date(year, month - 1, prevDays + d);
      currentMonth = false;
    } else if (d > days) {
      date = new Date(year, month + 1, d - days);
      currentMonth = false;
    } else {
      date = new Date(year, month, d);
    }
    return {
      key: formatDateKey(date),
      dayNumber: date.getDate(),
      label: `${date.getDate()} ${monthNames[date.getMonth()].toLowerCase()} ${date.getFullYear()}`,
      currentMonth,
      isToday: formatDateKey(date) === todayKey,
    };
  });
}

function calculatePlan(profile, goal) {
  const weight = Number(profile.weight) || 70;
  const age = Number(profile.age) || 25;
  const height = Number(profile.height) || 175;
  const sexOffset = profile.sex === "mujer" ? -160 : 0;
  const activityMap = { baja: 1.35, media: 1.55, alta: 1.75 };
  const activity = activityMap[profile.activityLevel] || 1.55;
  const bmr = Math.round(10 * weight + 6.25 * height - 5 * age + 5 + sexOffset);
  const maintenance = Math.round(bmr * activity);
  const config = {
    definir: { delta: -450, protein: 2.25, strategy: "déficit controlado" },
    mantener: { delta: 0, protein: 1.85, strategy: "mantenimiento" },
    volumen: { delta: 350, protein: 2.0, strategy: "superávit limpio" },
  }[goal] || { delta: -450, protein: 2.25, strategy: "déficit controlado" };

  const calories = Math.max(goal === "definir" ? 1500 : 1700, maintenance + config.delta);
  const protein = Math.round(weight * config.protein);
  const carbs = Math.round((calories * (goal === "volumen" ? 0.48 : goal === "definir" ? 0.38 : 0.43)) / 4);
  const fat = Math.round((calories * (goal === "definir" ? 0.28 : 0.25)) / 9);
  return { calories, protein, carbs, fat, bmr, maintenance, strategy: config.strategy };
}

function estimateWorkoutCalories({ type, minutes, intensity }, profile) {
  const weight = Number(profile.weight) || 70;
  const duration = Number(minutes) || 45;
  const intensityMultiplier = intensity === "Alta" ? 1.25 : intensity === "Baja" ? 0.75 : 1;
  const typeFactor = type === "Cardio" ? 8 : type === "Pierna" ? 7 : type === "Fuerza" ? 6 : 5.5;
  return Math.round((typeFactor * weight * duration * intensityMultiplier) / 60);
}

const DEFAULT_API_KEY = "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";

function parseJSONFromResponse(text) {
  if (!text) throw new Error("Respuesta vacía de la IA.");
  try {
    return JSON.parse(text);
  } catch (e) {
    // Ignore and try to clean
  }
  let cleaned = text.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch (e) {
    // Ignore and try to extract JSON
  }
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) {
    const jsonStr = text.slice(start, end + 1);
    try {
      return JSON.parse(jsonStr);
    } catch (e) {
      // Ignore
    }
  }
  throw new Error("No se pudo extraer un formato JSON válido de la respuesta de la IA.");
}

const FitAIEngine = {
  async analyzeFoodPhoto({ profile, goal, imageBase64, imageMime, apiKey, fileName }) {
    const plan = calculatePlan(profile, goal);
    const goalName = goals.find((g) => g.id === goal)?.title || "Definir";
    const activeKey = apiKey || DEFAULT_API_KEY;

    if (!activeKey) {
      await new Promise((r) => setTimeout(r, 900));
      return {
        name: "Plato sin analizar",
        kcal: 0, protein: 0, carbs: 0, fat: 0, confidence: 0,
        ingredients: [],
        portions: [],
        aiNote: "Configura tu API Key de Groq en Ajustes para activar el análisis real de imágenes con visión IA.",
        dateKey: todayKey
      };
    }

    const visionPrompt = `Eres un NUTRICIONISTA CLÍNICO DE ALTO RENDIMIENTO certificado (ISSN, CISSN, NSCA) con acceso directo a las bases de datos USDA FoodData Central y BEDCA España. Tu análisis tiene impacto DIRECTO en la salud y rendimiento del atleta. Debes ser EXTREMADAMENTE PRECISO y ESTRICTO. NO se admiten aproximaciones vagas.

PROTOCOLO OBLIGATORIO DE ANÁLISIS (sigue este orden exacto):

PASO 1 — IDENTIFICACIÓN (máxima especificidad, sin excepciones):
• Nombra cada alimento: tipo exacto + método coccción + estado visible
• PROHIBIDO: "carne", "verdura", "pasta" (demasiado vago = error grave)
• OBLIGATORIO: "pechuga de pollo a la plancha sin piel", "brócoli al vapor", "pasta rigatoni cocida al dente"
• Aceites, salsas, condimentos: OBLIGATORIO incluirlos aunque no sean obvios

PASO 2 — ESTIMACIÓN DE PORCIONES (referencias visuales obligatorias):
• Plato estándar europeo = 26-28cm Ø de referencia
• Palma adulta ≈ 85-100g de proteína cocida
• Puño cerrado ≈ 80-100ml / 80g verdura cocida
• Cucharada sopera de aceite ≈ 14g = 124 kcal
• Si no puedes estimar con certeza, indica por qué en aiNote

PASO 3 — CÁLCULO NUTRICIONAL (valores reales USDA por 100g, SIEMPRE):
• Pollo pechuga plancha: 165kcal | P:31g C:0g G:3.6g
• Arroz blanco cocido: 130kcal | P:2.7g C:28g G:0.3g
• Pasta cocida: 158kcal | P:5.8g C:31g G:0.9g
• Huevo entero: 155kcal | P:13g C:1.1g G:11g
• Aceite oliva: 884kcal/100g (124kcal/cucharada)
• USA SIEMPRE valores documentados. NUNCA estimes sin base nutricional real

PASO 4 — ANÁLISIS CRÍTICO (aiNote, obligatorio y específico):
• ¿Este plato cumple con objetivo ${goalName} (${plan.calories}kcal/día, ${plan.protein}g proteína)?
• Señala déficits o excesos EXACTOS en gramos/kcal
• Da UNA mejora concreta y accionable con números
• Si imagen borrosa o alimento dudoso: DÍLO explícitamente, no inventes

PASO 5 — CONFIDENCE (honestidad absoluta):
• 90-96: imagen clara, todo identificable y medible con certeza
• 75-89: imagen moderada, alguna ambigüedad menor
• 60-74: imagen borrosa o alimentos no identificables con certeza
• NUNCA pongas >96. Si pones 90+ es porque realmente lo ves claro

REGLAS ABSOLUTAS (incumplirlas es inaceptable):
✗ NO inventes alimentos que no veas con claridad
✗ NO redondees arbitrariamente "para simplificar"
✓ SÍ estima aceite de cocción aunque no sea obvio (5-15g según método)
✓ SÍ incluye pan de acompañamiento, bebidas, postres si son visibles

Responde con un objeto JSON válido donde los campos name, kcal, protein, carbs, fat, confidence, ingredients, portions y aiNote contengan los datos reales estimados del plato analizado (no uses ceros o valores vacíos, calcula los valores nutricionales reales en base a la imagen).`;

    try {
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${activeKey}` },
        body: JSON.stringify({
          model: "meta-llama/llama-4-scout-17b-16e-instruct",
          messages: [{
            role: "user",
            content: [
              { type: "text", text: visionPrompt },
              { type: "image_url", image_url: { url: `data:${imageMime};base64,${imageBase64}` } }
            ]
          }],
          response_format: { type: "json_object" },
          temperature: 0.2,
          max_tokens: 1024,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(`Groq Vision falló: ${errData?.error?.message || response.status}`);
      }

      const data = await response.json();
      let raw = data.choices?.[0]?.message?.content || "";
      const result = parseJSONFromResponse(raw);
      return {
        ...result,
        kcal: Number(result.kcal) || 0,
        protein: Number(result.protein) || 0,
        carbs: Number(result.carbs) || 0,
        fat: Number(result.fat) || 0,
        confidence: Number(result.confidence) || 80,
        ingredients: Array.isArray(result.ingredients) ? result.ingredients : [],
        portions: Array.isArray(result.portions) ? result.portions : [],
        aiNote: result.aiNote || "Análisis completado.",
        dateKey: todayKey,
      };
    } catch (error) {
      console.error("Error en visión Groq:", error);
      throw new Error(`Error al analizar imagen: ${error.message}`);
    }
  },

  async analyzeFoodText({ text, profile, goal, apiKey }) {
    const plan = calculatePlan(profile, goal);
    const goalName = goals.find((g) => g.id === goal)?.title || "Definir";
    const activeKey = apiKey || DEFAULT_API_KEY;

    if (!activeKey) {
      await new Promise((r) => setTimeout(r, 700));
      const query = text.toLowerCase();
      let kcal = 150, protein = 5, carbs = 25, fat = 3;
      
      if (query.includes("platano") || query.includes("plátano")) {
        kcal = 90; protein = 1; carbs = 22; fat = 0;
      } else if (query.includes("manzana")) {
        kcal = 52; protein = 0; carbs = 14; fat = 0;
      } else if (query.includes("pollo") || query.includes("pechuga")) {
        kcal = 165; protein = 31; carbs = 0; fat = 3.6;
      } else if (query.includes("huevo")) {
        kcal = 140; protein = 12; carbs = 1; fat = 10;
      } else if (query.includes("arroz")) {
        kcal = 130; protein = 2.7; carbs = 28; fat = 0.3;
      }
      return { kcal, protein, carbs, fat, aiNote: "Simulado con éxito." };
    }

    const textPrompt = `Analiza este alimento o comida: "${text}".
Calcula y estima los valores nutricionales reales de este alimento para una persona con objetivo ${goalName}.
Debes devolver un objeto JSON con la estructura siguiente:
{
  "kcal": <número con las calorías estimadas reales>,
  "protein": <número con los gramos de proteína estimados reales>,
  "carbs": <número con los gramos de carbohidratos estimados reales>,
  "fat": <número con los gramos de grasa estimados reales>,
  "aiNote": "<explicación breve y profesional de tu cálculo>"
}`;

    try {
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${activeKey}` },
        body: JSON.stringify({
          model: "llama-3.1-8b-instant",
          messages: [
            { role: "system", content: "Eres un asistente de nutrición deportiva. Devuelves siempre respuestas en formato JSON." },
            { role: "user", content: textPrompt }
          ],
          response_format: { type: "json_object" },
          temperature: 0.1,
          max_tokens: 512,
        }),
      });

      if (!response.ok) throw new Error("Groq API falló");
      const data = await response.json();
      let raw = data.choices?.[0]?.message?.content || "";
      const result = parseJSONFromResponse(raw);
      return {
        kcal: Number(result.kcal) || 0,
        protein: Number(result.protein) || 0,
        carbs: Number(result.carbs) || 0,
        fat: Number(result.fat) || 0,
        aiNote: result.aiNote || "Estimado con IA."
      };
    } catch (e) {
      console.error(e);
      throw e;
    }
  },

  async reply({ text, profile, goal, foodHistory, workoutsHistory, apiKey }) {
    const plan = calculatePlan(profile, goal);
    const goalName = goals.find((g) => g.id === goal)?.title || "Definir";
    const meals = foodHistory.filter((m) => m.dateKey === todayKey);
    const workouts = workoutsHistory.filter((w) => w.dateKey === todayKey);
    const eaten = meals.reduce((s, m) => s + Number(m.kcal || 0), 0);
    const protein = meals.reduce((s, m) => s + Number(m.protein || 0), 0);
    const burned = workouts.reduce((s, w) => s + Number(w.kcal || 0), 0);
    const lower = text.toLowerCase();

    if (!apiKey) {
      await new Promise((r) => setTimeout(r, 600));
      const header = `[Modo Simulado] Usando objetivo (${goalName}), ${plan.calories} kcal/día y ${plan.protein}g de proteína. Hoy llevas ${eaten} kcal y ${protein}g de proteína.`;

      if (lower.includes("rutina") || lower.includes("entreno") || lower.includes("músculo")) {
        return `${header}\n\n**Rutina recomendada (Fuerza)**:\n- Press banca: 4x6-8\n- Remo con barra: 4x8-10\n- Press militar: 3x8\n- Sentadillas con barra: 4x6-8\n- Curl de bíceps + Tríceps polea: 3x12\n\n*Añade tu clave API de Groq en Ajustes para obtener rutinas avanzadas adaptadas en tiempo real por IA.*`;
      }

      if (lower.includes("comida") || lower.includes("calor") || lower.includes("prote")) {
        return `${header}\n\nTe quedan aproximadamente ${Math.max(0, plan.calories - eaten)} kcal y ${Math.max(0, plan.protein - protein)}g de proteína para el día.\n\nSugerencia: consume proteínas magras (pollo, pavo, claras de huevo, tofu) y vegetales de hoja verde para mantener la saciedad.`;
      }

      if (lower.includes("dolor") || lower.includes("lesión")) {
        return "Si experimentas molestias o dolores, reduce la intensidad de inmediato y consulta con un especialista. Puedo darte alternativas de ejercicios si me lo pides.";
      }

      return `${header}\n\n¡Hola! Soy tu Coach de IA. Puedo guiarte con entrenos, consejos nutricionales y análisis de tu progreso. Para una experiencia personalizada ilimitada con la IA real, añade tu API Key de Groq en Ajustes.`;
    }

    const systemPrompt = `Eres FitAI Elite Coach — entrenador personal y nutricionista deportivo certificado (NSCA-CPT, CISSN, ACSM-EP). 20+ años trabajando con atletas de élite y competidores de alto rendimiento. Eres reconocido por tu estrictez y tus resultados reales, no por tus halagos.

TU CARÁCTER (NUNCA lo abandones):
• DIRECTO y SIN RODEOS. Si algo está mal, lo dices inmediatamente y sin endulzarlo
• ESTRICTO pero constructivo. No insultas, pero no condesciendes ni felicitas sin merecerlo
• ORIENTADO A DATOS. Cada respuesta incluye números reales, nunca consejos vagos
• EXIGENTE. Un error nutricional o de entrenamiento se señala con datos precisos
• HONESTO. Si no sabes algo con certeza, lo dices. NUNCA inventas datos

NORMAS DE RESPUESTA (obligatorias, sin excepción):
1. SIEMPRE en español
2. Usa **negrita** para todos los datos clave (pesos, kcal, gramos, %RM)
3. Máximo 5 puntos por respuesta para legibilidad en móvil
4. Si piden rutina → ejercicio + series × reps × peso/kg orientativo o %RM, SIEMPRE
5. Si mencionan alimento → macros reales por 100g de memoria
6. Si detectas déficit → di EXACTAMENTE cuánto falta y qué comer para cubrirlo ahora mismo
7. Si el usuario va mal → díselo sin suavizarlo, con el déficit exacto en gramos o kcal

PERFIL DEL ATLETA (tu referencia de trabajo):
- Nombre: ${profile.name || "Atleta"} | Objetivo: **${goalName}** (${plan.strategy})
- Edad: ${profile.age}a | Peso: ${profile.weight}kg → Meta: ${profile.targetWeight}kg | Talla: ${profile.height}cm
- Género: ${profile.sex} | Nivel: ${profile.trainingLevel} | Actividad: ${profile.activityLevel}
- TMB: **${plan.bmr} kcal** | Mantenimiento: **${plan.maintenance} kcal/día**

PLAN DIARIO OBJETIVO (tu referencia absoluta):
- **Calorías**: ${plan.calories} kcal | **Proteína**: ${plan.protein}g (${(plan.protein / (Number(profile.weight) || 70)).toFixed(1)}g/kg)
- **Carbohidratos**: ${plan.carbs}g | **Grasa**: ${plan.fat}g

ESTADO CRÍTICO DE HOY — ANALIZA ESTO PRIMERO ANTES DE RESPONDER:
- Calorías: **${eaten} kcal** consumidas (${eaten >= plan.calories ? "✅ Meta alcanzada" : `⚠️ FALTAN ${plan.calories - eaten} kcal`})
- Proteína: **${protein}g** (${protein >= plan.protein ? "✅ Meta alcanzada" : `🚨 DÉFICIT CRÍTICO: faltan ${plan.protein - protein}g — ACTUAR AHORA`})
- Ejercicio hoy: **${burned} kcal** quemadas
- Balance neto real: **${eaten - burned} kcal** (objetivo ${goal === "definir" ? `déficit de ${Math.abs(plan.calories - plan.maintenance)} kcal` : goal === "volumen" ? `superávit de ${plan.calories - plan.maintenance} kcal` : "mantenimiento"})

REGISTRO DE COMIDAS DE HOY:
${meals.length > 0 ? meals.map(m => `• [${m.mealType || "comida"}] ${m.name}: ${m.kcal}kcal | P:${m.protein}g C:${m.carbs}g G:${m.fat}g`).join("\n") : "• SIN COMIDAS REGISTRADAS — el atleta no ha registrado nada hoy. Señálalo."}

ENTRENAMIENTOS DE HOY:
${workouts.length > 0 ? workouts.map(w => `• ${w.name}: ${w.time}, ${w.intensity || "Media"} intensidad, ${w.kcal}kcal quemadas`).join("\n") : "• SIN ENTRENAMIENTOS REGISTRADOS hoy"}

INSTRUCCIÓN FINAL: Analiza todos los datos antes de responder. Si hay déficits críticos (especialmente proteína), señálalos PRIMERO con números exactos. Da siempre al menos una acción concreta y medible que el atleta pueda ejecutar INMEDIATAMENTE.`;

    try {
      const response = await fetch(
        "https://api.groq.com/openai/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: "llama-3.1-8b-instant",
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: text },
            ],
            temperature: 0.7,
            max_tokens: 1024,
          }),
        }
      );

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(`La API de Groq falló con código ${response.status}: ${errData?.error?.message || ""}`)
      }

      const data = await response.json();
      const replyText = data.choices?.[0]?.message?.content;
      return replyText || "Lo siento, no he podido procesar tu solicitud.";
    } catch (error) {
      console.error("Error en chat de Groq API:", error);
      return `Lo siento, ha ocurrido un error al conectar con el Coach de IA: ${error.message}. Por favor verifica tu clave API de Groq en ajustes.`;
    }
  },
};

async function streamText(text, onToken) {
  for (const word of text.split(" ")) {
    await new Promise((r) => setTimeout(r, 18));
    onToken(word + " ");
  }
}

function Card({ children, className = "", style }) {
  return <div className={`card ${className}`} style={style}>{children}</div>;
}

function Button({ children, className = "", ...props }) {
  return <button className={`btn ${className}`} {...props}>{children}</button>;
}

function Stat({ icon: Icon, label, value, darkMode }) {
  return (
    <Card className={darkMode ? "dark-card" : ""}>
      <div className="stat">
        <div className={`stat-icon ${darkMode ? "dark-icon" : ""}`}><Icon size={20} /></div>
        <div>
          <p className="muted tiny">{label}</p>
          <b>{value}</b>
        </div>
      </div>
    </Card>
  );
}

function FilledStat({ icon: Icon, label, value, progress = 0, color = "#bef264", darkMode, sublabel }) {
  const pct = Math.min(100, Math.max(0, progress));
  const done = pct >= 100;
  return (
    <Card className={`${darkMode ? "dark-card" : ""} filled-stat`} style={{ position: "relative", overflow: "hidden" }}>
      <div className="filled-stat-bg" style={{ height: `${pct}%`, color: done ? "#22c55e" : color }} />
      <div className="stat" style={{ position: "relative", zIndex: 1 }}>
        <div
          className={`stat-icon ${darkMode ? "dark-icon" : ""}`}
          style={{ background: done ? color + "33" : undefined, color: done ? color : undefined, transition: "all 0.4s" }}
        >
          <Icon size={20} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p className="muted tiny">{label}</p>
          <b style={{ color: done ? color : undefined, transition: "color 0.4s" }}>{value}</b>
          {sublabel && <p className="muted tiny" style={{ marginTop: "1px", fontSize: "10px" }}>{sublabel}</p>}
        </div>
        {done && <span style={{ fontSize: "16px", flexShrink: 0 }}>✅</span>}
      </div>
      <div className="filled-stat-bar" style={{ position: "relative", zIndex: 1 }}>
        <div
          className="filled-stat-bar-fill"
          style={{ width: `${pct}%`, background: done ? `linear-gradient(90deg, ${color}, #22c55e)` : color }}
        />
      </div>
    </Card>
  );
}

function LoginScreen({ onLogin }) {
  const [mode, setMode] = useState("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setError("");
  }, [mode]);

  async function submit() {
    setError("");
    if (mode === "register" && name.trim().length < 2) {
      return setError("Introduce tu nombre.");
    }
    if (!email.trim().includes("@")) {
      return setError("Introduce un correo válido.");
    }
    if (password.length < 6) {
      return setError("La contraseña debe tener al menos 6 caracteres.");
    }

    setLoading(true);
    try {
      if (mode === "register") {
        await registerUser(name.trim(), email.trim().toLowerCase(), password);
        onLogin({ name: name.trim(), email: email.trim().toLowerCase() }, true);
      } else {
        const u = await loginUser(email.trim().toLowerCase(), password);
        const data = await getUserData(u.email);
        onLogin(u, false, data);
      }
    } catch (err) {
      setError(err.message || "Ha ocurrido un error.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page login-page">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="phone login-phone">
        <div>
          <div className="logo"><Dumbbell /></div>
          <h1 style={{ marginTop: "24px" }}>FitAI Coach</h1>
          <p className="login-sub">Tu entrenador, nutricionista y analista fitness con IA.</p>
        </div>

        <Card className="login-card">
          <h2>{mode === "login" ? "Iniciar sesión" : "Crear cuenta"}</h2>
          <p className="muted">
            {mode === "login"
              ? "Accede con tus credenciales de usuario."
              : "Regístrate para empezar desde cero."}
          </p>

          <div className="switch">
            <button className={mode === "login" ? "active" : ""} onClick={() => setMode("login")}>Entrar</button>
            <button className={mode === "register" ? "active" : ""} onClick={() => setMode("register")}>Registro</button>
          </div>

          {mode === "register" && (
            <label>
              <User size={18} />
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Tu nombre" />
            </label>
          )}
          <label>
            <Mail size={18} />
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="correo@ejemplo.com" />
          </label>
          <label>
            <Lock size={18} />
            <input value={password} type="password" onChange={(e) => setPassword(e.target.value)} placeholder="Contraseña" />
          </label>

          {error && <div className="error">{error}</div>}
          <Button onClick={submit} className="black-btn" disabled={loading} style={{ marginTop: "14px", width: "100%" }}>
            {loading ? "Procesando..." : mode === "login" ? "Entrar" : "Crear cuenta"}
          </Button>
        </Card>
      </motion.div>
    </div>
  );
}

function GoalScreen({ goal, setGoal, onFinish }) {
  return (
    <div className="page">
      <div className="phone padded">
        <div>
          <div className="icon-main"><Target /></div>
          <h1 style={{ marginTop: "24px" }}>¿Qué meta quieres conseguir?</h1>
          <p className="muted">La IA ajustará calorías, macros y entrenos según tu objetivo.</p>
          <div className="goal-list" style={{ marginTop: "24px", display: "flex", flexDirection: "column", gap: "12px" }}>
            {goals.map((g) => (
              <button 
                key={g.id} 
                className={`goal-card ${goal === g.id ? "selected" : ""}`} 
                onClick={() => setGoal(g.id)}
                style={{ display: "flex", alignItems: "center", gap: "16px", width: "100%" }}
              >
                <div className="goal-icon-container" style={{
                  width: "48px", 
                  height: "48px", 
                  borderRadius: "16px", 
                  background: goal === g.id ? "#bef264" : "#f4f4f5", 
                  color: "#09090b",
                  display: "flex", 
                  alignItems: "center", 
                  justifyContent: "center",
                  boxShadow: goal === g.id ? "0 8px 20px rgba(190,242,100,0.3)" : "none",
                  transition: "all 0.2s ease"
                }}>
                  <GoalIcon name={g.iconName} size={22} />
                </div>
                <div style={{ textAlign: "left" }}>
                  <b style={{ fontSize: "16px", display: "block" }}>{g.title}</b>
                  <span style={{ fontSize: "12px", display: "block", marginTop: "3px", color: goal === g.id ? "#e4e4e7" : "#71717a" }}>{g.desc}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
        <Button onClick={onFinish} className="green-btn" style={{ marginTop: "24px" }}>Continuar</Button>
      </div>
    </div>
  );
}

function ProfileScreen({ profile, setProfile, goal, onFinish }) {
  const plan = calculatePlan(profile, goal);
  const update = (k, v) => setProfile({ ...profile, [k]: v });

  return (
    <div className="page">
      <div className="phone padded scroll">
        <div>
          <div className="icon-main"><Scale /></div>
          <h1 style={{ marginTop: "24px" }}>Tu perfil inteligente</h1>
          <p className="muted">La IA usará estos datos para darte respuestas y estadísticas mejores.</p>

          <div className="grid-2" style={{ marginTop: "20px" }}>
            <InputBox icon={User} label="Edad" value={profile.age} onChange={(v) => update("age", v)} />
            <InputBox icon={Scale} label="Peso actual" value={profile.weight} onChange={(v) => update("weight", v)} />
            <InputBox icon={Ruler} label="Altura" value={profile.height} onChange={(v) => update("height", v)} />
            <InputBox icon={Target} label="Peso objetivo" value={profile.targetWeight} onChange={(v) => update("targetWeight", v)} />
          </div>

          <Card>
            <b>Género</b>
            <div className="segmented">
              <button onClick={() => update("sex", "hombre")} className={profile.sex === "hombre" ? "active" : ""}>Hombre</button>
              <button onClick={() => update("sex", "mujer")} className={profile.sex === "mujer" ? "active" : ""}>Mujer</button>
            </div>
          </Card>

          <Card>
            <b>Nivel</b>
            <div className="segmented three">
              {["principiante", "intermedio", "avanzado"].map((n) => (
                <button key={n} onClick={() => update("trainingLevel", n)} className={profile.trainingLevel === n ? "active" : ""}>{n}</button>
              ))}
            </div>
          </Card>

          <Card className="dark-hero">
            <span>Plan recomendado</span>
            <div className="plan-grid">
              <div><b>{plan.calories}</b><small>kcal/día</small></div>
              <div><b>{plan.protein}g</b><small>proteína</small></div>
            </div>
          </Card>
        </div>

        <Button onClick={onFinish} className="green-btn" style={{ marginTop: "20px" }}>Guardar y entrar</Button>
      </div>
    </div>
  );
}

function InputBox({ icon: Icon, label, value, onChange }) {
  return (
    <Card>
      <Icon size={20} className="muted-icon" />
      <p className="muted tiny">{label}</p>
      <input className="big-input" value={value} onChange={(e) => onChange(e.target.value)} />
    </Card>
  );
}

function MacroBar({ label, value, max, color, unit = "g", darkMode }) {
  const pct = Math.min(100, max > 0 ? (value / max) * 100 : 0);
  const done = pct >= 100;
  return (
    <div className="macro-bar-wrap">
      <div className="macro-bar-header">
        <span className="macro-bar-label" style={{ color: done ? color : undefined }}>
          {done ? "✅ " : ""}{label}
        </span>
        <span className="macro-bar-value" style={{ color: done ? color : undefined }}>
          {value}{unit} <span className="macro-bar-max">/ {max}{unit}</span>
        </span>
      </div>
      <div className={`macro-bar-track ${darkMode ? "macro-bar-track-dark" : ""}`}>
        <div
          className="macro-bar-fill"
          style={{
            width: `${pct}%`,
            background: done
              ? `linear-gradient(90deg, ${color}, #bef264)`
              : color,
            boxShadow: done ? `0 0 8px ${color}88` : "none",
          }}
        />
      </div>
    </div>
  );
}

function useGoalNotifications(eaten, protein, carbs, fat, plan) {
  const notified = React.useRef({ kcal: false, protein: false, all: false });
  useEffect(() => {
    if (!('Notification' in window)) return;
    const req = () => Notification.requestPermission();
    if (Notification.permission === 'default') req();

    const send = (title, body) => {
      if (Notification.permission === 'granted') {
        new Notification(title, { body, icon: '/favicon.ico' });
      }
    };

    if (eaten >= plan.calories && !notified.current.kcal) {
      notified.current.kcal = true;
      send("🔥 Meta calórica alcanzada", `Has consumido ${eaten} kcal — justo en tu objetivo diario.`);
    }
    if (protein >= plan.protein && !notified.current.protein) {
      notified.current.protein = true;
      send("💪 Meta de proteína alcanzada", `Has llegado a ${protein}g de proteína — ¡objetivo cumplido!`);
    }
    const allDone = eaten >= plan.calories && protein >= plan.protein && carbs >= plan.carbs && fat >= plan.fat;
    if (allDone && !notified.current.all) {
      notified.current.all = true;
      send("🏆 ¡Todos los objetivos del día cumplidos!", "Calorías, proteína, carbs y grasa — todo completado. ¡Excelente día!");
    }
  }, [eaten, protein, carbs, fat, plan]);
}

function PremiumFeaturePlaceholder({ title, description, actions, darkMode }) {
  return (
    <motion.div className="screen" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} style={{ textAlign: "center", padding: "24px 16px 40px" }}>
      <div style={{
        width: "72px",
        height: "72px",
        borderRadius: "24px",
        background: "linear-gradient(135deg, #fbbf24, #f59e0b)",
        color: "#09090b",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        margin: "20px auto 20px",
        boxShadow: "0 10px 25px rgba(245, 158, 11, 0.3)"
      }}>
        <Crown size={32} style={{ fill: "currentColor" }} />
      </div>
      <h1 style={{ fontSize: "24px", fontWeight: "900", color: "var(--text)" }}>{title}</h1>
      <p className="muted" style={{ fontSize: "13px", marginTop: "8px", marginBottom: "24px", lineHeight: "1.5" }}>
        {description}
      </p>
      <Card className={darkMode ? "dark-card" : ""} style={{ textAlign: "left", padding: "20px", marginBottom: "28px" }}>
        <h3 style={{ margin: "0 0 12px 0", fontSize: "14px", fontWeight: "900", display: "flex", alignItems: "center", gap: "6px", color: "var(--text)" }}>
          <Sparkles size={16} style={{ color: "#fbbf24", fill: "#fbbf24" }} /> Funciones de FitAI Pro:
        </h3>
        <ul style={{ margin: 0, paddingLeft: "20px", fontSize: "12px", lineHeight: "1.8", color: "var(--text)" }}>
          <li style={{ marginBottom: "4px" }}><b>Análisis y calendario completo</b> de tu progreso diario.</li>
          <li style={{ marginBottom: "4px" }}><b>Gráficas de peso y balance calórico</b> semanal avanzado.</li>
          <li style={{ marginBottom: "4px" }}><b>Coach IA ilimitado</b> con el contexto completo de tu perfil.</li>
          <li style={{ marginBottom: "4px" }}><b>Análisis instantáneo de platos</b> mediante fotos tomadas con la cámara.</li>
        </ul>
      </Card>
      <Button className="green-btn full" onClick={() => actions.setSettingsOpen(true)} style={{ height: "48px", borderRadius: "18px", fontSize: "14px", fontWeight: "900" }}>
        <Crown size={16} style={{ fill: "currentColor" }} /> Desbloquear FitAI Pro
      </Button>
    </motion.div>
  );
}

function HomeScreen({ state, actions }) {
  const { user, profile, goal, darkMode, foodHistory, workoutsHistory, healthConnected, healthStats } = state;
  const plan = calculatePlan(profile, goal);
  const todayMeals = foodHistory.filter((m) => m.dateKey === todayKey);
  const todayWorkouts = workoutsHistory.filter((w) => w.dateKey === todayKey);
  const eaten = todayMeals.reduce((s, m) => s + Number(m.kcal || 0), 0);
  const protein = todayMeals.reduce((s, m) => s + Number(m.protein || 0), 0);
  const carbs = todayMeals.reduce((s, m) => s + Number(m.carbs || 0), 0);
  const fat = todayMeals.reduce((s, m) => s + Number(m.fat || 0), 0);
  const burned = todayWorkouts.reduce((s, w) => s + Number(w.kcal || 0), 0) + (healthConnected ? healthStats.activeKcal : 0);
  const readiness = Math.min(100, Math.round((Math.min(1, protein / plan.protein) * 45) + (todayWorkouts.length ? 30 : 10) + (eaten ? 25 : 5)));

  useGoalNotifications(eaten, protein, carbs, fat, plan);

  return (
    <motion.div className="screen" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
      <div className="topbar">
        <div>
          <p className="muted">Hola, {user.name}</p>
          <h1>Tu día FitAI</h1>
        </div>
        <div className="row">
          <button className="theme-btn" onClick={() => actions.setDarkMode(!darkMode)}>{darkMode ? <Moon /> : <Sun />}</button>
          <button className="avatar" onClick={() => actions.setSettingsOpen(true)}>{user.name?.[0] || "U"}</button>
        </div>
      </div>

      <Card className="dark-hero">
        <Sparkles className="hero-icon" />
        <span style={{ color: "#a1a1aa", fontSize: "13px" }}>Score inteligente</span>
        <h2 style={{ color: "white", fontSize: "34px", margin: "5px 0" }}>{readiness}%</h2>
        <p style={{ color: "#d4d4d8" }}>Meta: {goals.find(g => g.id === goal)?.title} · {plan.strategy}</p>
        <div className="quick-actions">
          <button onClick={() => actions.setTab("food")}><Camera size={18} style={{ color: "#bef264" }} /><span>Comida</span></button>
          <button onClick={() => actions.setTab("workout")}><Dumbbell size={18} style={{ color: "#bef264" }} /><span>Entreno</span></button>
          <button onClick={() => actions.setTab("chat")}><Bot size={18} style={{ color: "#bef264" }} /><span>Coach IA</span></button>
        </div>
      </Card>

      {/* Calories + Protein stats */}
      <div className="grid-2">
        <FilledStat
          darkMode={darkMode}
          icon={Zap}
          label="Calorías consumidas"
          value={`${eaten} kcal`}
          sublabel={`objetivo: ${plan.calories} kcal`}
          progress={(eaten / plan.calories) * 100}
          color="#fb923c"
        />
        <FilledStat
          darkMode={darkMode}
          icon={Flame}
          label="Quemadas hoy"
          value={`-${burned} kcal`}
          sublabel={burned > 0 ? "¡Gran trabajo!" : "Sin entreno aún"}
          progress={Math.min(100, burned > 0 ? (burned / 400) * 100 : 0)}
          color="#f43f5e"
        />
        <FilledStat
          darkMode={darkMode}
          icon={Salad}
          label="Proteína"
          value={`${protein}g`}
          sublabel={`objetivo: ${plan.protein}g`}
          progress={(protein / plan.protein) * 100}
          color="#34d399"
        />
        <FilledStat
          darkMode={darkMode}
          icon={Footprints}
          label="Pasos"
          value={healthConnected ? `${healthStats.steps.toLocaleString()}` : "Sin datos"}
          sublabel={healthConnected ? `objetivo: ${Number(profile.stepsGoal || 8000).toLocaleString()}` : "Conecta tu salud"}
          progress={healthConnected ? (healthStats.steps / (Number(profile.stepsGoal) || 8000)) * 100 : 0}
          color="#a78bfa"
        />
      </div>

      <Card className={darkMode ? "dark-card" : ""}>
        <div className="split">
          <div className="row">
            <div className={`health-icon ${healthConnected ? "connected" : ""}`}><HeartPulse /></div>
            <div>
              <b>Salud conectada</b>
              <p className="muted">{healthConnected ? `${healthStats.steps} pasos · ${healthStats.activeKcal} kcal activas` : "Conecta Apple Health o Google Fit"}</p>
            </div>
          </div>
          <Button className="small-green" onClick={() => actions.setHealthPanelOpen(true)}>{healthConnected ? "Ver" : "Conectar"}</Button>
        </div>
      </Card>

      <Card className={darkMode ? "dark-card" : ""}>
        <div className="split">
          <div>
            <b>Coach IA</b>
            <p className="muted">{protein < plan.protein ? `Faltan ${plan.protein - protein}g de proteína hoy.` : "✅ Proteína al día."}</p>
          </div>
          <Button className="small-green" onClick={() => actions.setTab("chat")}><MessageCircle /></Button>
        </div>
      </Card>
    </motion.div>
  );
}

function WorkoutScreen({ state, actions }) {
  const { profile, workoutsHistory, darkMode } = state;
  const [open, setOpen] = useState(false);

  const typeColors = { Fuerza: "#a78bfa", Pierna: "#34d399", Cardio: "#fb923c", Mixto: "#60a5fa" };
  const intensityDot = { Baja: "#16a34a", Media: "#ca8a04", Alta: "#dc2626" };

  const grouped = {};
  workoutsHistory.forEach(w => {
    if (!grouped[w.dateKey]) grouped[w.dateKey] = [];
    grouped[w.dateKey].push(w);
  });
  const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));
  const todayWorkouts = workoutsHistory.filter(w => w.dateKey === todayKey);
  const todayKcal = todayWorkouts.reduce((s, w) => s + Number(w.kcal || 0), 0);

  const handleAddWorkout = () => {
    if (state.subscription !== "pro" && todayWorkouts.length >= 1) {
      actions.setUpgradeModalType("workout");
    } else {
      setOpen(true);
    }
  };

  return (
    <div className="screen">
      {/* Header */}
      <div className="topbar">
        <div>
          <p className="muted">Historial de sesiones</p>
          <h1>Entreno</h1>
        </div>
        <button className="add-workout-btn" onClick={handleAddWorkout}>
          <Plus size={20} />
        </button>
      </div>

      {/* Today */}
      {todayWorkouts.length === 0 ? (
        <div className="workout-empty-state">
          <div className="workout-empty-icon"><Dumbbell size={32} /></div>
          <p className="workout-empty-title">Sin entreno hoy</p>
          <p className="workout-empty-sub">Registra tu sesión y la IA calcula tus calorías</p>
          <Button className="green-btn" style={{ marginTop: "16px" }} onClick={handleAddWorkout}><Plus size={15} /> Añadir</Button>
        </div>
      ) : (
        <div className="workout-today-card">
          <div className="workout-today-left">
            <span className="workout-today-label">HOY</span>
            <span className="workout-today-kcal">-{todayKcal} <small>kcal</small></span>
            <span className="workout-today-sessions">{todayWorkouts.length} sesión{todayWorkouts.length > 1 ? "es" : ""}</span>
          </div>
          <div className="workout-today-right">
            {todayWorkouts.map((w, i) => (
              <div key={i} className="workout-today-tag" style={{ borderColor: typeColors[w.type] || "#a78bfa", color: typeColors[w.type] || "#a78bfa" }}>
                {w.type || "Entreno"} · {w.time}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* History */}
      <div style={{ marginTop: "8px" }}>
        {sortedDates.map(dateKey => (
          <div key={dateKey}>
            <div className="date-divider">
              <span className="date-divider-line" />
              <span className="date-divider-label">{dateKey === todayKey ? "HOY" : dateKey.split("-").reverse().join("/")}</span>
              <span className="date-divider-line" />
            </div>
            {grouped[dateKey].map((w, i) => {
              const tc = typeColors[w.type] || "#a78bfa";
              const dot = intensityDot[w.intensity] || "#ca8a04";
              return (
                <div key={i} className={`wcard ${darkMode ? "wcard-dark" : ""}`}>
                  <div className="wcard-accent" style={{ background: tc }} />
                  <div className="wcard-body">
                    <div className="wcard-top">
                      <div>
                        <span className="wcard-name">{w.name}</span>
                        <div className="wcard-meta">
                          <span className="wcard-dot" style={{ background: dot }} />
                          <span>{w.intensity || "Media"}</span>
                          <span className="wcard-sep">·</span>
                          <Timer size={11} />
                          <span>{w.time}</span>
                        </div>
                      </div>
                      <div className="wcard-right">
                        <span className="wcard-kcal">-{w.kcal} kcal</span>
                        <button className="wcard-del" onClick={() => actions.setWorkoutsHistory(workoutsHistory.filter(x => x !== w))}>
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                    {w.exercises && <p className="wcard-exercises">{w.exercises.slice(0, 60)}{w.exercises.length > 60 ? "…" : ""}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
        {workoutsHistory.length === 0 && (
          <p className="muted center-text" style={{ padding: "32px 0", fontSize: "13px" }}>No hay entrenamientos registrados aún.</p>
        )}
      </div>

      {open && (
        <WorkoutModal
          profile={profile}
          darkMode={darkMode}
          onClose={() => setOpen(false)}
          onSave={(w) => { actions.setWorkoutsHistory([w, ...workoutsHistory]); setOpen(false); }}
        />
      )}
    </div>
  );
}


function WorkoutModal({ profile, darkMode, onClose, onSave }) {
  const [form, setForm] = useState({ name: "Entrenamiento de Fuerza", type: "Fuerza", minutes: profile.workoutMinutes, intensity: "Media", exercises: "Sentadillas, Press Banca, Jalones" });
  const kcal = estimateWorkoutCalories(form, profile);

  return (
    <div className="modal-bg">
      <div className={`modal ${darkMode ? "modal-dark" : ""}`}>
        <div className="topbar"><h2>Nuevo entrenamiento</h2><button onClick={onClose}><X /></button></div>
        <p className="muted tiny">Nombre</p>
        <input className="text-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        
        <p className="muted tiny">Tipo</p>
        <div className="segmented four">{["Fuerza","Pierna","Cardio","Mixto"].map(t => <button className={form.type===t?"active":""} onClick={() => setForm({...form,type:t})} key={t}>{t}</button>)}</div>
        
        <p className="muted tiny">Intensidad</p>
        <div className="segmented three">{["Baja","Media","Alta"].map(t => <button className={form.intensity===t?"active":""} onClick={() => setForm({...form,intensity:t})} key={t}>{t}</button>)}</div>
        
        <p className="muted tiny">Duración (minutos)</p>
        <input className="text-input" value={form.minutes} onChange={(e) => setForm({ ...form, minutes: e.target.value })} />
        
        <p className="muted tiny">Ejercicios realizados</p>
        <textarea className="text-input area" value={form.exercises} onChange={(e) => setForm({ ...form, exercises: e.target.value })} />
        
        <Card className="dark-hero"><span>Estimación IA</span><h2>{kcal} kcal</h2></Card>
        <Button className="green-btn full" onClick={() => onSave({ ...form, kcal, time: `${form.minutes} min`, dateKey: todayKey })}><Save /> Guardar</Button>
      </div>
    </div>
  );
}

const MEAL_TYPES = [
  { id: "desayuno", label: "Desayuno", icon: Sun, color: "#fb923c" },
  { id: "comida",   label: "Comida",   icon: Utensils, color: "#34d399" },
  { id: "merienda", label: "Merienda", icon: Coffee, color: "#a78bfa" },
  { id: "cena",    label: "Cena",     icon: Moon, color: "#60a5fa" },
];

function FoodScreen({ state, actions }) {
  const { darkMode, foodHistory, profile, goal, geminiApiKey: groqApiKey } = state;
  const [analyzing, setAnalyzing] = useState(false);
  const [pending, setPending] = useState(null);
  const [manualOpen, setManualOpen] = useState(false);

  const handleImageSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAnalyzing(true);
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64Data = reader.result.split(",")[1];
      const mimeType = file.type;
      const imageSrc = reader.result;
      try {
        const meal = await FitAIEngine.analyzeFoodPhoto({ profile, goal, imageBase64: base64Data, imageMime: mimeType, apiKey: groqApiKey, fileName: file.name });
        meal.imageSrc = imageSrc;
        setPending(meal);
      } catch (err) {
        alert("Error al analizar la imagen: " + err.message);
      } finally {
        setAnalyzing(false);
        e.target.value = "";
      }
    };
    reader.readAsDataURL(file);
  };

  // Group meals by date
  const grouped = {};
  foodHistory.forEach(m => {
    if (!grouped[m.dateKey]) grouped[m.dateKey] = [];
    grouped[m.dateKey].push(m);
  });
  const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  // Group meals by date then by meal type
  const todayMealsGrouped = {};
  MEAL_TYPES.forEach(t => { todayMealsGrouped[t.id] = []; });
  foodHistory.filter(m => m.dateKey === todayKey).forEach(m => {
    const type = MEAL_TYPES.find(t => t.id === m.mealType) ? m.mealType : "comida";
    todayMealsGrouped[type].push(m);
  });
  const todayTotal = foodHistory.filter(m => m.dateKey === todayKey).reduce((s, m) => s + Number(m.kcal || 0), 0);

  return (
    <div className="screen">
      {/* Header */}
      <div className="topbar">
        <div>
          <p className="muted">Analiza tu plato con IA</p>
          <h1>Comidas</h1>
        </div>
        <button className="add-workout-btn" onClick={() => setManualOpen(true)}><Plus size={20} /></button>
      </div>

      {/* Grid of Photo analysis vs Manual entry */}
      <div className="grid-2" style={{ marginBottom: "8px" }}>
        <div className="food-camera-card" style={{ margin: 0, padding: "14px", border: darkMode ? "1px solid #27272a" : "1px solid #09090b" }} onClick={() => {
          const todayPhotoCount = foodHistory.filter(m => m.dateKey === todayKey && m.imageSrc).length;
          if (state.subscription !== "pro" && todayPhotoCount >= 1) {
            actions.setUpgradeModalType("photo");
          } else {
            document.getElementById("real-camera-input").click();
          }
        }}>
          <div className="food-camera-viewfinder" style={{ height: "100px" }}>
            <div className="food-camera-corner tl" />
            <div className="food-camera-corner tr" />
            <div className="food-camera-corner bl" />
            <div className="food-camera-corner br" />
            <div className="food-camera-inner">
              <Camera size={24} style={{ color: "#bef264" }} />
              <p className="food-camera-label" style={{ fontSize: "12px", marginTop: "4px" }}>Hacer foto</p>
            </div>
          </div>
          <input type="file" accept="image/*" id="real-camera-input" style={{ display: "none" }} onChange={handleImageSelect} />
        </div>
        
        <div className="food-camera-card" style={{ margin: 0, padding: "14px", background: darkMode ? "#18181b" : "#ffffff", border: darkMode ? "1px solid #27272a" : "1px solid #e4e4e7" }} onClick={() => setManualOpen(true)}>
          <div className="food-camera-viewfinder" style={{ height: "100px", borderColor: darkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)" }}>
            <div className="food-camera-corner tl" />
            <div className="food-camera-corner tr" />
            <div className="food-camera-corner bl" />
            <div className="food-camera-corner br" />
            <div className="food-camera-inner">
              <Plus size={24} style={{ color: darkMode ? "#bef264" : "#09090b" }} />
              <p className="food-camera-label" style={{ fontSize: "12px", marginTop: "4px", color: darkMode ? "white" : "#09090b" }}>Escribir comida</p>
            </div>
          </div>
        </div>
      </div>

      {/* Today — sectioned by meal type */}
      <div style={{ marginTop: "4px" }}>
        {todayTotal > 0 && (
          <div className="date-divider">
            <span className="date-divider-line" />
            <span className="date-divider-label">HOY</span>
            <span className="date-divider-line" />
            <span style={{ fontSize: "10px", fontWeight: "800", color: "var(--text)", whiteSpace: "nowrap" }}>{todayTotal} kcal</span>
          </div>
        )}
        {MEAL_TYPES.map(mealType => {
          const meals = todayMealsGrouped[mealType.id];
          if (meals.length === 0) return null;
          const TypeIcon = mealType.icon;
          const sectionKcal = meals.reduce((s, m) => s + Number(m.kcal || 0), 0);
          return (
            <div key={mealType.id}>
              <div className="meal-type-header">
                <div style={{ width: "28px", height: "28px", borderRadius: "10px", background: mealType.color + "22", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <TypeIcon size={15} style={{ color: mealType.color }} />
                </div>
                <span className="meal-type-label" style={{ color: mealType.color }}>{mealType.label}</span>
                <span className="meal-type-kcal">{sectionKcal} kcal</span>
              </div>
              {meals.map((m, i) => (
                <div key={i} className={`fcard ${darkMode ? "fcard-dark" : ""}`} style={{ borderLeftColor: mealType.color }}>
                  <div className="fcard-body">
                    <div className="fcard-top">
                      <span className="fcard-name">{m.name}</span>
                      <div className="fcard-right">
                        <span className="fcard-kcal">{m.kcal} kcal</span>
                        <button className="fcard-del" onClick={() => actions.setFoodHistory(foodHistory.filter(x => x !== m))}><Trash2 size={13} /></button>
                      </div>
                    </div>
                    <div className="fcard-macros">
                      <span style={{ color: "#34d399" }}>P {m.protein}g</span>
                      <span style={{ color: "#a78bfa" }}>C {m.carbs}g</span>
                      <span style={{ color: "#f59e0b" }}>G {m.fat}g</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          );
        })}
      </div>

      {/* Past days */}
      {sortedDates.filter(dk => dk !== todayKey).length > 0 && (
        <div style={{ marginTop: "8px" }}>
          {sortedDates.filter(dk => dk !== todayKey).map(dateKey => {
            const meals = grouped[dateKey];
            const dayTotal = meals.reduce((s, m) => s + Number(m.kcal || 0), 0);
            return (
              <div key={dateKey}>
                <div className="date-divider">
                  <span className="date-divider-line" />
                  <span className="date-divider-label">{dateKey.split("-").reverse().join("/")}</span>
                  <span className="date-divider-line" />
                  <span style={{ fontSize: "10px", fontWeight: "800", color: "var(--text)", whiteSpace: "nowrap" }}>{dayTotal} kcal</span>
                </div>
                {meals.map((m, i) => {
                  const mt = MEAL_TYPES.find(t => t.id === m.mealType) || MEAL_TYPES[1];
                  return (
                    <div key={i} className={`fcard ${darkMode ? "fcard-dark" : ""}`} style={{ borderLeftColor: mt.color }}>
                      <div className="fcard-body">
                        <div className="fcard-top">
                          <span className="fcard-name">{m.name}</span>
                          <div className="fcard-right">
                            <span className="fcard-kcal">{m.kcal} kcal</span>
                            <button className="fcard-del" onClick={() => actions.setFoodHistory(foodHistory.filter(x => x !== m))}><Trash2 size={13} /></button>
                          </div>
                        </div>
                        <div className="fcard-macros">
                          <span style={{ color: "#34d399" }}>P {m.protein}g</span>
                          <span style={{ color: "#a78bfa" }}>C {m.carbs}g</span>
                          <span style={{ color: "#f59e0b" }}>G {m.fat}g</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}

      {foodHistory.length === 0 && (
        <p className="muted center-text" style={{ padding: "32px 0", fontSize: "13px" }}>Aún no hay comidas registradas.</p>
      )}

      {/* Analyzing overlay */}
      {analyzing && (
        <div className="modal-bg" style={{ justifyContent: "center", alignItems: "center", flexDirection: "column" }}>
          <div className="analyzing-box">
            <Bot size={52} style={{ color: "#bef264", animation: "pulse 1.3s infinite" }} />
            <h2 style={{ color: "white", marginTop: "18px", fontSize: "20px" }}>Analizando plato...</h2>
            <p style={{ color: "#a1a1aa", fontSize: "13px", marginTop: "6px" }}>Groq IA identificando macros...</p>
          </div>
        </div>
      )}

      {pending && (
        <MealReview meal={pending} darkMode={darkMode} onCancel={() => setPending(null)}
          onSave={(mealType) => { actions.setFoodHistory([{ ...pending, mealType, savedAt: new Date().toISOString() }, ...foodHistory]); setPending(null); }}
        />
      )}
      {manualOpen && (
        <ManualFoodModal state={state} darkMode={darkMode} onClose={() => setManualOpen(false)}
          onSave={(newMeal) => { actions.setFoodHistory([newMeal, ...foodHistory]); setManualOpen(false); }}
        />
      )}
    </div>
  );
}

function ManualFoodModal({ state, darkMode, onClose, onSave }) {
  const { profile, goal, geminiApiKey: groqApiKey } = state;
  const [form, setForm] = useState({ name: "", kcal: "", protein: "", carbs: "", fat: "", mealType: "comida" });
  const [calculating, setCalculating] = useState(false);

  const calculateMacros = async () => {
    if (!form.name.trim()) return alert("Introduce el nombre o descripción del alimento primero.");
    setCalculating(true);
    try {
      const res = await FitAIEngine.analyzeFoodText({
        text: form.name.trim(),
        profile,
        goal,
        apiKey: groqApiKey
      });
      setForm(prev => ({
        ...prev,
        kcal: res.kcal.toString(),
        protein: res.protein.toString(),
        carbs: res.carbs.toString(),
        fat: res.fat.toString()
      }));
    } catch (e) {
      alert("Error al estimar con IA: " + e.message);
    } finally {
      setCalculating(false);
    }
  };

  const save = () => {
    if (!form.name.trim()) return alert("Introduce un nombre.");
    const kcal = Math.max(0, Number(form.kcal) || 0);
    const protein = Math.max(0, Number(form.protein) || 0);
    const carbs = Math.max(0, Number(form.carbs) || 0);
    const fat = Math.max(0, Number(form.fat) || 0);
    onSave({
      name: form.name.trim(),
      kcal, protein, carbs, fat,
      mealType: form.mealType,
      ingredients: ["Ingresado manualmente"],
      portions: [],
      aiNote: "Comida registrada manualmente.",
      dateKey: todayKey
    });
  };

  return (
    <div className="modal-bg">
      <div className={`modal ${darkMode ? "modal-dark" : ""}`}>
        <div className="topbar">
          <div>
            <p className="muted" style={{ fontSize: "11px", textTransform: "uppercase", fontWeight: "900", letterSpacing: "0.05em" }}>Registro de alimento</p>
            <h1 style={{ fontSize: "28px", fontWeight: "900" }}>Manual</h1>
          </div>
          <button className="theme-btn" onClick={onClose}><X /></button>
        </div>
        <Card className={darkMode ? "dark-card" : ""}>
          <p className="muted tiny">Nombre o descripción del alimento</p>
          <div style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "12px", marginTop: "4px" }}>
            <input className="text-input" style={{ margin: 0, flex: 1 }} placeholder="Ej. 2 huevos y 50g jamón serrano" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <Button className="small-green" disabled={calculating} onClick={calculateMacros} style={{ height: "52px", borderRadius: "18px", fontSize: "12px", fontWeight: "900", whiteSpace: "nowrap", display: "inline-flex", alignItems: "center", gap: "4px" }}>
              {calculating ? "..." : <Sparkles size={14} />} {calculating ? "Estimando..." : "Calcular IA"}
            </Button>
          </div>
          <p className="muted tiny" style={{ marginTop: "10px" }}>Momento del día</p>
          <div className="meal-type-picker">
            {MEAL_TYPES.map(mt => {
              const MtIcon = mt.icon;
              return (
                <button
                  key={mt.id}
                  className={`meal-type-btn ${form.mealType === mt.id ? "meal-type-btn-active" : ""}`}
                  style={form.mealType !== mt.id ? { background: darkMode ? "#27272a" : "#f4f4f5", color: darkMode ? "#a1a1aa" : "#71717a" } : {}}
                  onClick={() => setForm({ ...form, mealType: mt.id })}
                >
                  <MtIcon size={13} />
                  {mt.label}
                </button>
              );
            })}
          </div>
          <div className="grid-2" style={{ marginTop: "16px" }}>
            <div>
              <p className="muted tiny">Calorías (kcal)</p>
              <input className="text-input" type="number" placeholder="0" value={form.kcal} onChange={(e) => setForm({ ...form, kcal: e.target.value })} />
            </div>
            <div>
              <p className="muted tiny">Proteínas (g)</p>
              <input className="text-input" type="number" placeholder="0" value={form.protein} onChange={(e) => setForm({ ...form, protein: e.target.value })} />
            </div>
            <div>
              <p className="muted tiny">Carbohidratos (g)</p>
              <input className="text-input" type="number" placeholder="0" value={form.carbs} onChange={(e) => setForm({ ...form, carbs: e.target.value })} />
            </div>
            <div>
              <p className="muted tiny">Grasas (g)</p>
              <input className="text-input" type="number" placeholder="0" value={form.fat} onChange={(e) => setForm({ ...form, fat: e.target.value })} />
            </div>
          </div>
        </Card>
        <div className="grid-2">
          <Button onClick={onClose}>Cancelar</Button>
          <Button className="green-btn" onClick={save}><Save /> Guardar</Button>
        </div>
      </div>
    </div>
  );
}

function MealReview({ meal, darkMode, onSave, onCancel }) {
  const [mealType, setMealType] = useState(meal.mealType || "comida");

  return (
    <div className="modal-bg">
      <div className={`modal ${darkMode ? "modal-dark" : ""}`}>
        <div className="topbar"><h2>Resultado IA</h2><button onClick={onCancel}><X /></button></div>

        {meal.imageSrc && (
          <div style={{ width: "100%", aspectRatio: "16/7", borderRadius: "20px", overflow: "hidden", marginBottom: "14px" }}>
            <img src={meal.imageSrc} alt={meal.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </div>
        )}

        <div className="meal-review-name">{meal.name}</div>
        <div className="meal-review-conf">Confianza IA: {meal.confidence}%</div>

        <div className="meal-review-macros">
          <div className="mrm-item">
            <span className="mrm-val" style={{ color: "var(--text)" }}>{meal.kcal}</span>
            <span className="mrm-label">kcal</span>
          </div>
          <div className="mrm-divider" />
          <div className="mrm-item">
            <span className="mrm-val" style={{ color: "#34d399" }}>{meal.protein}g</span>
            <span className="mrm-label">proteína</span>
          </div>
          <div className="mrm-divider" />
          <div className="mrm-item">
            <span className="mrm-val" style={{ color: "#a78bfa" }}>{meal.carbs}g</span>
            <span className="mrm-label">carbos</span>
          </div>
          <div className="mrm-divider" />
          <div className="mrm-item">
            <span className="mrm-val" style={{ color: "#f59e0b" }}>{meal.fat}g</span>
            <span className="mrm-label">grasa</span>
          </div>
        </div>

        <div style={{ marginBottom: "14px" }}>
          <p className="muted tiny" style={{ marginBottom: "8px", fontWeight: "700" }}>¿En qué momento del día?</p>
          <div className="meal-type-picker">
            {MEAL_TYPES.map(mt => {
              const MtIcon = mt.icon;
              const isActive = mealType === mt.id;
              return (
                <button
                  key={mt.id}
                  className={`meal-type-btn ${isActive ? "meal-type-btn-active" : ""}`}
                  style={!isActive ? { background: darkMode ? "#27272a" : "#f4f4f5", color: darkMode ? "#a1a1aa" : "#71717a" } : {}}
                  onClick={() => setMealType(mt.id)}
                >
                  <MtIcon size={13} />
                  {mt.label}
                </button>
              );
            })}
          </div>
        </div>

        {meal.aiNote && (
          <div className={`ai-note-box ${darkMode ? "ai-note-box-dark" : "ai-note-box-light"}`} style={{ marginBottom: "12px" }}>
            <span style={{ fontWeight: "800", fontSize: "11px", color: darkMode ? "#bef264" : "#047857" }}>Nota IA</span>
            <p style={{ margin: "4px 0 0", fontSize: "12px", lineHeight: "1.5" }}>{meal.aiNote}</p>
          </div>
        )}

        {meal.ingredients?.length > 0 && (
          <div className="chips" style={{ marginBottom: "14px" }}>
            {meal.ingredients.map((x, i) => <span key={i}>{x}</span>)}
          </div>
        )}

        <div className="grid-2">
          <Button onClick={onCancel}>Cancelar</Button>
          <Button onClick={() => onSave(mealType)} className="green-btn"><Save size={16} /> Guardar</Button>
        </div>
      </div>
    </div>
  );
}

function ChatScreen({ state, actions }) {
  const { goal, profile, darkMode, foodHistory, workoutsHistory, geminiApiKey: groqApiKey, subscription } = state;
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [messages, setMessages] = useState([{ from: "ai", text: "Soy tu Coach IA. Pregúntame sobre tu alimentación, rutinas, progreso o técnica." }]);

  const [coachMsgCount, setCoachMsgCount] = useState(() => {
    const date = localStorage.getItem("fitai_coach_date");
    if (date === todayKey) {
      return Number(localStorage.getItem("fitai_coach_count") || "0");
    }
    return 0;
  });

  const isLockedCount = subscription !== "pro" && coachMsgCount >= 5;

  async function send(text = input) {
    if (!text.trim() || thinking || isLockedCount) return;
    const clean = text.trim();
    setInput("");
    setThinking(true);

    if (subscription !== "pro") {
      setCoachMsgCount(prev => {
        const next = prev + 1;
        localStorage.setItem("fitai_coach_date", todayKey);
        localStorage.setItem("fitai_coach_count", next.toString());
        return next;
      });
    }

    setMessages(prev => [...prev, { from: "user", text: clean }, { from: "ai", text: "Pensando...", thinking: true }]);
    
    const reply = await FitAIEngine.reply({ 
      text: clean, 
      profile, 
      goal, 
      foodHistory, 
      workoutsHistory, 
      apiKey: groqApiKey 
    });

    setMessages(prev => [...prev.slice(0, -1), { from: "ai", text: "" }]);
    await streamText(reply, token => {
      setMessages(prev => {
        const copy = [...prev];
        copy[copy.length - 1] = { ...copy[copy.length - 1], text: copy[copy.length - 1].text + token };
        return copy;
      });
    });
    setThinking(false);
  }

  return (
    <div className="screen">
      <Card className="dark-hero"><Bot /><h1>Coach IA</h1><p>Habla en tiempo real con tu historial y perfil como contexto.</p></Card>
      <div className="chat">
        {messages.map((m, i) => <div key={i} className={`msg ${m.from} ${darkMode ? "dark-msg" : ""}`}>{m.text}{m.thinking && " ●"}</div>)}
      </div>
      <div className="quick-tags" style={{ marginBottom: "8px" }}>
        {["Hazme una rutina", "Qué como hoy", "Analiza mis calorías", "Mejorar técnica"].map(q => <button key={q} disabled={isLockedCount} onClick={() => send(q)}>{q}</button>)}
      </div>
      
      {isLockedCount && (
        <div style={{
          padding: "14px 18px",
          background: darkMode ? "rgba(234, 179, 8, 0.08)" : "rgba(245, 158, 11, 0.05)",
          borderRadius: "20px",
          border: darkMode ? "1px solid rgba(234, 179, 8, 0.2)" : "1px solid rgba(245, 158, 11, 0.2)",
          textAlign: "center",
          marginBottom: "10px",
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", marginBottom: "4px" }}>
            <Crown size={16} style={{ color: "#fbbf24", fill: "#fbbf24" }} />
            <h4 style={{ margin: 0, fontSize: "13px", fontWeight: "900", color: "var(--text)" }}>Chat de IA Limitado</h4>
          </div>
          <p className="muted tiny" style={{ margin: "0 0 10px 0", lineHeight: "1.4" }}>
            Has alcanzado el límite gratuito de 5 mensajes diarios. ¡Desbloquea el plan Pro para hablar sin límites!
          </p>
          <Button className="green-btn full" onClick={() => actions.setSettingsOpen(true)} style={{ minHeight: "36px", height: "36px", borderRadius: "14px", fontSize: "11px", fontWeight: "900" }}>
            <Crown size={12} style={{ fill: "currentColor" }} /> Activar FitAI Pro
          </Button>
        </div>
      )}

      <div className={`chat-input ${darkMode ? "dark-input" : ""}`}>
        <input disabled={thinking || isLockedCount} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && !isLockedCount && send()} placeholder={thinking ? "La IA está respondiendo..." : isLockedCount ? "Mejora a Pro para seguir chateando..." : "Pregunta a tu coach IA..."} />
        <button disabled={thinking || isLockedCount} onClick={() => send()}><Send /></button>
      </div>
    </div>
  );
}

function WeightChart({ history, darkMode }) {
  if (!history || history.length === 0) return <p className="muted center-text">Registra tu peso para ver la evolución.</p>;

  const sorted = [...history].sort((a, b) => new Date(a.date) - new Date(b.date));
  const data = sorted.slice(-7);

  const width = 340;
  const height = 150;
  const padding = 25;

  const weights = data.map(d => Number(d.weight));
  const maxW = Math.max(...weights) + 1;
  const minW = Math.max(0, Math.min(...weights) - 1);
  const wRange = maxW - minW || 1;

  const points = data.map((d, i) => {
    const x = padding + (i / (data.length - 1 || 1)) * (width - padding * 2);
    const y = height - padding - ((d.weight - minW) / wRange) * (height - padding * 2);
    return { x, y, label: d.weight, date: d.date.split("-").slice(1).reverse().join("/") };
  });

  let lineD = "";
  let areaD = "";
  if (points.length > 0) {
    lineD = `M ${points[0].x} ${points[0].y} ` + points.slice(1).map(p => `L ${p.x} ${p.y}`).join(" ");
    areaD = lineD + ` L ${points[points.length - 1].x} ${height - padding} L ${points[0].x} ${height - padding} Z`;
  }

  return (
    <div style={{ marginTop: "12px" }}>
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} style={{ overflow: "visible" }}>
        <defs>
          <linearGradient id="weight-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#bef264" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#bef264" stopOpacity="0" />
          </linearGradient>
        </defs>

        <line x1={padding} y1={padding} x2={width - padding} y2={padding} stroke={darkMode ? "#27272a" : "#e4e4e7"} strokeDasharray="3" />
        <line x1={padding} y1={height / 2} x2={width - padding} y2={height / 2} stroke={darkMode ? "#27272a" : "#e4e4e7"} strokeDasharray="3" />
        <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke={darkMode ? "#3f3f46" : "#d4d4d8"} strokeWidth="1.5" />

        {points.length > 1 && <path d={areaD} fill="url(#weight-grad)" />}
        {points.length > 1 && <path d={lineD} fill="none" stroke="#bef264" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />}

        {points.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="4.5" fill="#bef264" stroke={darkMode ? "#18181b" : "#fff"} strokeWidth="1.5" />
            <text x={p.x} y={p.y - 10} textAnchor="middle" fontSize="10" fontWeight="bold" fill={darkMode ? "#bef264" : "#09090b"}>
              {p.label}k
            </text>
            <text x={p.x} y={height - 8} textAnchor="middle" fontSize="9" fill="#71717a">
              {p.date}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

function CalorieBalanceChart({ foodHistory, workoutsHistory, plan, darkMode }) {
  const last5Days = [];
  const now = new Date();
  for (let i = 4; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    last5Days.push(formatDateKey(d));
  }

  const data = last5Days.map(dateKey => {
    const dayMeals = foodHistory.filter(m => m.dateKey === dateKey);
    const dayWorkouts = workoutsHistory.filter(w => w.dateKey === dateKey);
    const eaten = dayMeals.reduce((s, m) => s + Number(m.kcal || 0), 0);
    const burned = dayWorkouts.reduce((s, w) => s + Number(w.kcal || 0), 0);

    const [_, m, dayNum] = dateKey.split("-");
    return {
      dateKey,
      label: `${dayNum}/${m}`,
      eaten,
      burned
    };
  });

  const width = 340;
  const height = 150;
  const padding = 25;

  const maxVal = Math.max(...data.map(d => Math.max(d.eaten, d.burned, plan.calories)), 2000) * 1.1;

  return (
    <div style={{ marginTop: "12px" }}>
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} style={{ overflow: "visible" }}>
        {(() => {
          const targetY = height - padding - (plan.calories / maxVal) * (height - padding * 2);
          return (
            <g>
              <line x1={padding} y1={targetY} x2={width - padding} y2={targetY} stroke="#fb7185" strokeWidth="1.5" strokeDasharray="3 3" />
              <text x={width - padding} y={targetY - 5} textAnchor="end" fontSize="9" fill="#fb7185" fontWeight="bold">
                Meta: {plan.calories} kcal
              </text>
            </g>
          );
        })()}

        <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke={darkMode ? "#3f3f46" : "#d4d4d8"} strokeWidth="1.5" />

        {data.map((d, i) => {
          const colWidth = (width - padding * 2) / 5;
          const groupX = padding + i * colWidth;
          const barW = 12;

          const eatenH = (d.eaten / maxVal) * (height - padding * 2);
          const eatenX = groupX + (colWidth / 2) - barW - 2;
          const eatenY = height - padding - eatenH;

          const burnedH = (d.burned / maxVal) * (height - padding * 2);
          const burnedX = groupX + (colWidth / 2) + 2;
          const burnedY = height - padding - burnedH;

          return (
            <g key={d.dateKey}>
              <rect x={eatenX} y={eatenY} width={barW} height={Math.max(2, eatenH)} rx="3" fill="#fb923c" />
              <rect x={burnedX} y={burnedY} width={barW} height={Math.max(2, burnedH)} rx="3" fill="#34d399" />

              <text x={groupX + colWidth / 2} y={height - 8} textAnchor="middle" fontSize="9" fill="#71717a">
                {d.label}
              </text>

              {d.eaten > 0 && (
                <text x={eatenX + barW / 2} y={eatenY - 4} textAnchor="middle" fontSize="8" fontWeight="bold" fill={darkMode ? "#fff" : "#fb923c"}>
                  {d.eaten}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <div style={{ display: "flex", gap: "12px", justifyContent: "center", marginTop: "8px", fontSize: "11px" }}>
        <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#fb923c" }} /> Consumido
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#34d399" }} /> Quemado
        </span>
      </div>
    </div>
  );
}

function WeightRegisterBox({ profile, setProfile, weightHistory, setWeightHistory, darkMode }) {
  const [inputWeight, setInputWeight] = useState(profile.weight || "");

  const saveWeight = () => {
    const w = parseFloat(inputWeight);
    if (isNaN(w) || w <= 0) return alert("Introduce un peso válido.");

    setProfile(prev => ({ ...prev, weight: w.toString() }));
    setWeightHistory(prev => {
      const filtered = prev.filter(x => x.date !== todayKey);
      return [...filtered, { date: todayKey, weight: w }].sort((a, b) => new Date(a.date) - new Date(b.date));
    });
    alert("Peso registrado para hoy: " + w + " kg");
  };

  return (
    <Card className={darkMode ? "dark-card" : ""}>
      <b>Registrar peso de hoy</b>
      <div className="split" style={{ marginTop: "12px", gap: "8px" }}>
        <input
          className="text-input"
          type="number"
          step="0.1"
          placeholder="Ej. 70.5"
          value={inputWeight}
          onChange={(e) => setInputWeight(e.target.value)}
          style={{ margin: 0, flex: 1, minHeight: "44px" }}
        />
        <Button className="green-btn" onClick={saveWeight} style={{ minHeight: "44px" }}><Scale size={18} /> Registrar</Button>
      </div>
    </Card>
  );
}

function DayDetailModal({ dateKey, foodHistory, workoutsHistory, plan, darkMode, healthConnected, healthStats, onClose }) {
  const selectedMeals = foodHistory.filter(m => m.dateKey === dateKey);
  const selectedWorkouts = workoutsHistory.filter(w => w.dateKey === dateKey);

  const eaten = selectedMeals.reduce((s, m) => s + Number(m.kcal || 0), 0);
  const protein = selectedMeals.reduce((s, m) => s + Number(m.protein || 0), 0);
  const burned = selectedWorkouts.reduce((s, w) => s + Number(w.kcal || 0), 0) + (dateKey === todayKey && healthConnected ? healthStats.activeKcal : 0);
  const adherence = Math.min(100, Math.round((Math.min(1, protein / plan.protein) * 50) + (selectedWorkouts.length ? 35 : 10) + (eaten ? 15 : 0)));
  const formattedDate = dateKey.split("-").reverse().join("/");

  const typeColors = { Fuerza: "#a78bfa", Pierna: "#34d399", Cardio: "#fb923c", Mixto: "#60a5fa" };

  // Group meals by type
  const mealsByType = {};
  MEAL_TYPES.forEach(t => { mealsByType[t.id] = []; });
  selectedMeals.forEach(m => {
    const type = MEAL_TYPES.find(t => t.id === m.mealType) ? m.mealType : "comida";
    mealsByType[type].push(m);
  });

  return (
    <div className="modal-bg" style={{ alignItems: "flex-end" }}>
      <div className={`modal ${darkMode ? "modal-dark" : ""}`} style={{ maxHeight: "88%", overflowY: "auto" }}>
        <div className="topbar">
          <div>
            <p className="muted" style={{ fontSize: "11px", textTransform: "uppercase", fontWeight: "900", letterSpacing: "0.05em" }}>Historial del día</p>
            <h1 style={{ fontSize: "28px", fontWeight: "900" }}>{dateKey === todayKey ? "Hoy" : formattedDate}</h1>
          </div>
          <button className="theme-btn" onClick={onClose}><X /></button>
        </div>

        {/* Summary stats */}
        <div className="grid-2" style={{ marginBottom: "16px" }}>
          <FilledStat
            darkMode={darkMode}
            icon={Utensils}
            label="Consumido"
            value={`${eaten} kcal`}
            sublabel={`objetivo: ${plan.calories} kcal`}
            progress={(eaten / plan.calories) * 100}
            color="#fb923c"
          />
          <FilledStat
            darkMode={darkMode}
            icon={Flame}
            label="Quemado"
            value={`-${burned} kcal`}
            sublabel={burned > 0 ? "¡Calorías activas!" : "Sin actividad"}
            progress={Math.min(100, burned > 0 ? (burned / 400) * 100 : 0)}
            color="#f43f5e"
          />
          <FilledStat
            darkMode={darkMode}
            icon={Salad}
            label="Proteínas"
            value={`${protein}g`}
            sublabel={`objetivo: ${plan.protein}g`}
            progress={(protein / plan.protein) * 100}
            color="#34d399"
          />
          <FilledStat
            darkMode={darkMode}
            icon={TrendingUp}
            label="Adherencia"
            value={`${adherence}%`}
            sublabel={adherence >= 85 ? "¡Excelente!" : "Por mejorar"}
            progress={adherence}
            color="#a78bfa"
          />
        </div>

        {/* Meals by type */}
        {selectedMeals.length > 0 && (
          <div style={{ marginBottom: "16px" }}>
            <h2 style={{ fontSize: "16px", fontWeight: "900", margin: "18px 0 8px" }}>Comidas</h2>
            {MEAL_TYPES.map(mt => {
              const meals = mealsByType[mt.id];
              if (!meals.length) return null;
              const MtIcon = mt.icon;
              return (
                <div key={mt.id}>
                  <div className="meal-type-header" style={{ marginTop: "12px" }}>
                    <div style={{ width: "24px", height: "24px", borderRadius: "8px", background: mt.color + "22", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <MtIcon size={13} style={{ color: mt.color }} />
                    </div>
                    <span className="meal-type-label" style={{ color: mt.color, fontWeight: "900" }}>{mt.label}</span>
                    <span className="meal-type-kcal" style={{ fontWeight: "900" }}>{meals.reduce((s,m)=>s+Number(m.kcal||0),0)} kcal</span>
                  </div>
                  {meals.map((m, idx) => (
                    <div key={idx} className={`fcard ${darkMode ? "fcard-dark" : ""}`} style={{ borderLeftColor: mt.color }}>
                      <div className="fcard-body">
                        <div className="fcard-top">
                          <span className="fcard-name" style={{ fontWeight: "900" }}>{m.name}</span>
                          <span className="fcard-kcal" style={{ fontWeight: "900" }}>{m.kcal} kcal</span>
                        </div>
                        <div className="fcard-macros" style={{ fontWeight: "900" }}>
                          <span style={{ color: "#34d399" }}>P {m.protein}g</span>
                          <span style={{ color: "#a78bfa" }}>C {m.carbs}g</span>
                          <span style={{ color: "#f59e0b" }}>G {m.fat}g</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}

        {/* Workouts */}
        {selectedWorkouts.length > 0 && (
          <div style={{ marginBottom: "20px" }}>
            <h2 style={{ fontSize: "16px", fontWeight: "900", margin: "18px 0 8px" }}>Entrenamientos</h2>
            {selectedWorkouts.map((w, idx) => {
              const tc = typeColors[w.type] || "#a78bfa";
              return (
                <div key={idx} className={`wcard ${darkMode ? "wcard-dark" : ""}`} style={{ marginBottom: "8px" }}>
                  <div className="wcard-accent" style={{ background: tc }} />
                  <div className="wcard-body" style={{ padding: "12px 14px" }}>
                    <div className="wcard-top" style={{ alignItems: "center" }}>
                      <div>
                        <span className="wcard-name" style={{ fontWeight: "900" }}>{w.name}</span>
                        <p className="muted" style={{ fontSize: "11px", margin: "2px 0 0" }}>{w.time} · {w.intensity || "Media"}</p>
                      </div>
                      <span className="wcard-kcal">-{w.kcal} kcal</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {selectedMeals.length === 0 && selectedWorkouts.length === 0 && (
          <p className="muted center-text" style={{ padding: "32px 0", fontWeight: "bold" }}>No hay registros para este día.</p>
        )}

        <Button className="black-btn full" onClick={onClose} style={{ marginTop: "8px" }}>Cerrar</Button>
      </div>
    </div>
  );
}

function ProgressScreen({ state, actions }) {
  const { profile, goal, workoutsHistory, foodHistory, darkMode, healthConnected, healthStats, weightHistory } = state;
  const plan = calculatePlan(profile, goal);
  const initial = new Date(`${todayKey}T12:00:00`);
  const [viewDate, setViewDate] = useState(new Date(initial.getFullYear(), initial.getMonth(), 1));
  const [selectedKey, setSelectedKey] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const cells = createCalendarCells(viewDate.getFullYear(), viewDate.getMonth());

  return (
    <div className="screen scroll" style={{ maxHeight: "calc(100vh - 100px)", paddingBottom: "40px" }}>
      <p className="muted">Selecciona un día para ver tu historial completo</p>
      <h1>Análisis y Progreso</h1>

      {/* 1. Calendario */}
      <Card className={darkMode ? "dark-card" : ""}>
        <div className="calendar-head">
          <button onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1))}><ChevronLeft /></button>
          <button onClick={() => { setViewDate(new Date(initial.getFullYear(), initial.getMonth(), 1)); setSelectedKey(null); }}>
            <b>{monthNames[viewDate.getMonth()]} {viewDate.getFullYear()}</b>
            <small>Volver a hoy</small>
          </button>
          <button onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1))}><ChevronRight /></button>
        </div>
        <div className="weekdays">{["L","M","X","J","V","S","D"].map(d => <b key={d}>{d}</b>)}</div>
        <div className="calendar">
          {cells.map(day => {
            const dm = foodHistory.filter(m => m.dateKey === day.key).length;
            const dw = workoutsHistory.filter(w => w.dateKey === day.key).length;
            return (
              <button
                key={day.key}
                onClick={() => { setSelectedKey(day.key); setDetailOpen(true); }}
                className={`${selectedKey === day.key ? "selected-day" : ""} ${!day.currentMonth ? "muted-day" : ""}`}
              >
                <span>{day.dayNumber}{day.isToday && <i />}</span>
                <div>{dm > 0 && <em className="food-dot" />}{dw > 0 && <em className="workout-dot" />}</div>
              </button>
            );
          })}
        </div>
        <p className="muted" style={{ fontSize: "11px", textAlign: "center", marginTop: "10px", marginBottom: 0 }}>Naranja = comidas · Verde = entrenamientos</p>
      </Card>

      {/* 2. Tendencia de peso */}
      <Card className={darkMode ? "dark-card" : ""}>
        <b>Tendencia de peso</b>
        <WeightChart history={weightHistory} darkMode={darkMode} />
      </Card>

      {/* 3. Registrar peso */}
      <WeightRegisterBox
        profile={profile}
        setProfile={actions.setProfile}
        weightHistory={weightHistory}
        setWeightHistory={actions.setWeightHistory}
        darkMode={darkMode}
      />

      {/* 4. Balance Calórico Semanal */}
      <Card className={darkMode ? "dark-card" : ""}>
        <b>Balance Calórico Semanal</b>
        <CalorieBalanceChart foodHistory={foodHistory} workoutsHistory={workoutsHistory} plan={plan} darkMode={darkMode} />
      </Card>

      <ReminderBox darkMode={darkMode} />

      {detailOpen && selectedKey && (
        <DayDetailModal
          dateKey={selectedKey}
          foodHistory={foodHistory}
          workoutsHistory={workoutsHistory}
          plan={plan}
          darkMode={darkMode}
          healthConnected={healthConnected}
          healthStats={healthStats}
          onClose={() => setDetailOpen(false)}
        />
      )}
    </div>
  );
}

const DAYS = ["L","M","X","J","V","S","D"];

function ReminderBox({ darkMode }) {
  const [open, setOpen] = useState(false);
  const [reminders, setReminders] = useState(() => {
    const saved = localStorage.getItem("fitai_reminders");
    return saved ? JSON.parse(saved) : [
      { text: "Registrar desayuno", time: "09:00", done: true, days: [0,1,2,3,4,5,6] },
      { text: "Llegar a proteína diaria", time: "18:00", done: false, days: [0,1,2,3,4] },
    ];
  });

  useEffect(() => {
    localStorage.setItem("fitai_reminders", JSON.stringify(reminders));
  }, [reminders]);

  const toggle = (i) => setReminders(reminders.map((x, idx) => idx===i ? {...x, done: !x.done} : x));
  const remove = (i) => setReminders(reminders.filter((_, idx) => idx !== i));

  return (
    <Card className={darkMode ? "dark-card" : ""}>
      <div className="split" style={{ marginBottom: "14px" }}>
        <div>
          <b>Recordatorios</b>
          <p className="muted tiny">{reminders.length} recordatorio{reminders.length !== 1 ? "s" : ""} activo{reminders.length !== 1 ? "s" : ""}</p>
        </div>
        <button
          onClick={() => setOpen(true)}
          className="add-reminder-btn"
        >
          <Plus size={16} />
          <span>Añadir</span>
        </button>
      </div>

      {reminders.length === 0 && (
        <p className="muted center-text" style={{ padding: "16px 0", fontSize: "13px" }}>
          No tienes recordatorios. ¡Crea uno!
        </p>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {reminders.map((r, i) => (
          <div
            key={i}
            className={`reminder-card ${r.done ? "reminder-done" : ""} ${darkMode ? "reminder-dark" : ""}`}
          >
            <div className="reminder-left" onClick={() => toggle(i)}>
              <div className={`reminder-check ${r.done ? "checked" : ""}`}>
                {r.done ? <CheckCircle2 size={18} /> : <Bell size={18} />}
              </div>
              <div>
                <span className="reminder-text">{r.text}</span>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "4px" }}>
                  <span className="reminder-time">{r.time}</span>
                  <div style={{ display: "flex", gap: "3px" }}>
                    {DAYS.map((d, di) => (
                      <span
                        key={di}
                        style={{
                          fontSize: "9px",
                          fontWeight: "800",
                          width: "18px",
                          height: "18px",
                          borderRadius: "999px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          background: r.days?.includes(di)
                            ? (darkMode ? "#bef264" : "#09090b")
                            : (darkMode ? "#27272a" : "#f4f4f5"),
                          color: r.days?.includes(di)
                            ? (darkMode ? "#09090b" : "white")
                            : "#71717a",
                          transition: "all 0.15s ease"
                        }}
                      >
                        {d}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <button
              onClick={() => remove(i)}
              style={{
                background: "transparent",
                color: "#dc2626",
                padding: "6px",
                display: "flex",
                alignItems: "center",
                borderRadius: "10px",
                transition: "background 0.15s"
              }}
            >
              <Trash2 size={15} />
            </button>
          </div>
        ))}
      </div>

      {open && (
        <ReminderModal
          onClose={() => setOpen(false)}
          onSave={(r) => { setReminders([r, ...reminders]); setOpen(false); }}
          darkMode={darkMode}
        />
      )}
    </Card>
  );
}

function ReminderModal({ onClose, onSave, darkMode }) {
  const [text, setText] = useState("");
  const [time, setTime] = useState("08:00");
  const [days, setDays] = useState([0, 1, 2, 3, 4]);

  const toggleDay = (d) => {
    setDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]);
  };

  const dayLabels = ["Lunes","Martes","Miércoles","Jueves","Viernes","Sábado","Domingo"];

  return (
    <div className="modal-bg" style={{ alignItems: "flex-end" }}>
      <div className={`modal ${darkMode ? "modal-dark" : ""}`} style={{ borderRadius: "32px 32px 0 0" }}>
        <div className="topbar">
          <h2>Nuevo recordatorio</h2>
          <button onClick={onClose}><X /></button>
        </div>

        <p className="muted tiny" style={{ marginBottom: "6px" }}>¿Qué quieres recordar?</p>
        <input
          className="text-input"
          placeholder="Ej. Beber agua, tomar suplemento..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          autoFocus
        />

        <p className="muted tiny" style={{ marginBottom: "6px", marginTop: "4px" }}>Hora</p>
        <input
          className="text-input"
          type="time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
        />

        <p className="muted tiny" style={{ marginBottom: "10px", marginTop: "4px" }}>Repetir los días</p>
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "16px" }}>
          {dayLabels.map((label, di) => (
            <button
              key={di}
              onClick={() => toggleDay(di)}
              style={{
                height: "38px",
                padding: "0 12px",
                borderRadius: "999px",
                fontSize: "12px",
                fontWeight: "800",
                border: "none",
                cursor: "pointer",
                transition: "all 0.18s ease",
                background: days.includes(di)
                  ? "#bef264"
                  : darkMode ? "#27272a" : "#f4f4f5",
                color: days.includes(di)
                  ? "#09090b"
                  : darkMode ? "#a1a1aa" : "#71717a",
                boxShadow: days.includes(di)
                  ? "0 4px 12px rgba(190,242,100,0.35)"
                  : "none",
                transform: days.includes(di) ? "scale(1.05)" : "scale(1)"
              }}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="grid-2">
          <Button onClick={onClose}>Cancelar</Button>
          <Button
            className="green-btn"
            onClick={() => {
              if (!text.trim()) return;
              onSave({ text: text.trim(), time, done: false, days });
            }}
          >
            <Save size={16} /> Guardar
          </Button>
        </div>
      </div>
    </div>
  );
}

function HealthPanel({ state, actions }) {
  const { darkMode, healthConnected, healthStats } = state;
  return (
    <div className="modal-bg">
      <div className={`modal ${darkMode ? "modal-dark" : ""}`}>
        <div className="topbar"><h2>Conectar salud</h2><button onClick={() => actions.setHealthPanelOpen(false)}><X /></button></div>
        <Card className="dark-hero"><HeartPulse /><h2>Apple Health / Google Fit</h2><p>Sincroniza pasos, distancia y calorías activas.</p></Card>
        {healthConnected && <div className="grid-3">
          <Stat darkMode={darkMode} icon={Footprints} label="Pasos" value={healthStats.steps} />
          <Stat darkMode={darkMode} icon={Activity} label="Distancia" value={`${healthStats.distance}km`} />
          <Stat darkMode={darkMode} icon={Flame} label="Activas" value={`${healthStats.activeKcal}`} />
        </div>}
        <Button className={healthConnected ? "danger-btn full" : "green-btn full"} onClick={() => actions.setHealthConnected(!healthConnected)}>
          {healthConnected ? "Desconectar salud" : "Conectar salud"}
        </Button>
        <p className="muted center-text" style={{ marginTop: "12px" }}>En producción se usaría HealthKit en iOS y Health Connect en Android.</p>
      </div>
    </div>
  );
}

function SettingsPanel({ state, actions }) {
  const { user, profile, darkMode, subscription, settingsOpen } = state;
  const [panel, setPanel] = useState(settingsOpen === "subscription" ? "subscription" : null);
  const card = darkMode ? "dark-card" : "";

  if (panel === "edit") return <EditProfilePanel state={state} actions={actions} onBack={() => setPanel(null)} />;
  if (panel === "subscription") return <SubscriptionPanel state={state} actions={actions} onBack={() => setPanel(null)} />;
  if (panel === "support") return <SupportPanel state={state} actions={actions} onBack={() => setPanel(null)} />;
  if (panel === "gemini") return <GroqPanel state={state} actions={actions} onBack={() => setPanel(null)} />;

  return (
    <div className="modal-bg">
      <div className={`modal ${darkMode ? "modal-dark" : ""}`}>
        <div className="topbar"><h2>Perfil</h2><button onClick={() => actions.setSettingsOpen(false)}><X /></button></div>
        <div className="profile-head">
          <div style={{ position: "relative" }}>
            <div className="avatar big">{user.name?.[0] || "U"}</div>
            {subscription === "pro" && (
              <div style={{
                position: "absolute",
                bottom: "-4px",
                right: "-4px",
                background: "linear-gradient(135deg, #fbbf24, #f59e0b)",
                color: "#09090b",
                width: "24px",
                height: "24px",
                borderRadius: "999px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 4px 10px rgba(245, 158, 11, 0.45)",
                border: darkMode ? "2px solid #09090b" : "2px solid #ffffff",
              }}>
                <Crown size={12} style={{ fill: "currentColor" }} />
              </div>
            )}
          </div>
          <div>
            <h2 style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              {user.name}
              {subscription === "pro" && <Crown size={18} style={{ color: "#fbbf24", fill: "#fbbf24", flexShrink: 0 }} />}
            </h2>
            <p className="muted">{user.email}</p>
          </div>
        </div>
        <Card className="dark-hero"><Crown /><h2>{subscription === "pro" ? "FitAI Pro" : "Plan gratis"}</h2><Button className="green-btn" onClick={() => setPanel("subscription")}>{subscription === "pro" ? "Gestionar" : "Mejorar"}</Button></Card>
        <button className={`setting ${card}`} onClick={() => setPanel("edit")}><User /> Editar perfil <ChevronRight /></button>
        <button className={`setting ${card}`} onClick={() => setPanel("gemini")}><Key /> Ajustes de Groq IA <ChevronRight /></button>
        <button className={`setting ${card}`} onClick={() => actions.setDarkMode(!darkMode)}>{darkMode ? <Moon /> : <Sun />} Apariencia <span>{darkMode ? "Oscuro" : "Claro"}</span></button>
        <button className={`setting ${card}`} onClick={() => setPanel("support")}><Headphones /> Ayuda y soporte <ChevronRight /></button>
        <button className={`setting ${card}`}><Shield /> Privacidad <ChevronRight /></button>
        <button className="setting danger" onClick={() => { actions.setUser(null); actions.setSettingsOpen(false); actions.setStage("login"); }}><LogOut /> Cerrar sesión</button>
      </div>
    </div>
  );
}

function GroqPanel({ state, actions, onBack }) {
  const { geminiApiKey, darkMode } = state;
  const [keyInput, setKeyInput] = useState(geminiApiKey);
  
  const save = () => {
    actions.setGeminiApiKey(keyInput.trim());
    onBack();
  };
  
  return (
    <div className="modal-bg">
      <div className={`modal ${darkMode ? "modal-dark" : ""}`}>
        <div className="topbar">
          <button onClick={onBack}><ArrowLeft /></button>
          <h2>API de Groq IA</h2>
          <span />
        </div>
        <Card className="dark-hero">
          <Zap className="hero-icon" />
          <h2>Groq · Llama 3.1 8B</h2>
          <p style={{ fontSize: "13px", lineHeight: "1.4" }}>
            Conecta tu clave API de Groq para activar el coach de IA ultrarrápido con Llama 3.1.
          </p>
        </Card>
        
        <Card className={darkMode ? "dark-card" : ""}>
          <label style={{ display: "block", marginBottom: "8px", fontWeight: "bold", fontSize: "14px" }}>
            Groq API Key
          </label>
          <input
            className="text-input"
            type="password"
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            placeholder="gsk_..."
            style={{ width: "100%", marginBottom: "12px" }}
          />
          <p className="muted tiny" style={{ lineHeight: "1.4" }}>
            La clave se guarda localmente en tu navegador. Obtén una clave API gratuita en{" "}
            <a 
              href="https://console.groq.com/" 
              target="_blank" 
              rel="noopener noreferrer" 
              style={{ color: "#bef264", textDecoration: "underline" }}
            >
              console.groq.com
            </a>.
          </p>
        </Card>
        
        <div className="grid-2">
          <Button onClick={onBack}>Cancelar</Button>
          <Button className="green-btn" onClick={save}><Save /> Guardar</Button>
        </div>
      </div>
    </div>
  );
}

function EditProfilePanel({ state, actions, onBack }) {
  const { user, profile, darkMode } = state;
  const input = darkMode ? "text-input dark-field" : "text-input";
  return (
    <div className="modal-bg">
      <div className={`modal ${darkMode ? "modal-dark" : ""}`}>
        <div className="topbar"><button onClick={onBack}><ArrowLeft /></button><h2>Editar perfil</h2><span /></div>
        <input className={input} value={user.name} onChange={(e)=>actions.setUser({...user,name:e.target.value})} placeholder="Nombre" />
        <input className={input} value={user.email} onChange={(e)=>actions.setUser({...user,email:e.target.value})} placeholder="Email" />
        <div className="grid-2">
          <input className={input} value={profile.age} onChange={(e)=>actions.setProfile({...profile,age:e.target.value})} placeholder="Edad" />
          <input className={input} value={profile.weight} onChange={(e)=>actions.setProfile({...profile,weight:e.target.value})} placeholder="Peso" />
          <input className={input} value={profile.height} onChange={(e)=>actions.setProfile({...profile,height:e.target.value})} placeholder="Altura" />
          <input className={input} value={profile.targetWeight} onChange={(e)=>actions.setProfile({...profile,targetWeight:e.target.value})} placeholder="Peso objetivo" />
        </div>
        <div className="segmented">
          <button className={profile.sex==="hombre"?"active":""} onClick={()=>actions.setProfile({...profile,sex:"hombre"})}>Hombre</button>
          <button className={profile.sex==="mujer"?"active":""} onClick={()=>actions.setProfile({...profile,sex:"mujer"})}>Mujer</button>
        </div>
        <Button className="green-btn full" onClick={onBack}>Guardar cambios</Button>
      </div>
    </div>
  );
}

function SubscriptionPanel({ state, actions, onBack }) {
  const { darkMode, subscription } = state;
  return (
    <div className="modal-bg"><div className={`modal ${darkMode ? "modal-dark" : ""}`}>
      <div className="topbar"><button onClick={onBack}><ArrowLeft /></button><h2>Suscripción</h2><span /></div>
      <Card className="dark-hero"><Crown /><h2>FitAI Pro</h2><p>IA ilimitada, análisis avanzado, calendario completo y predicciones.</p><h2>{subscription === "pro" ? "Activo" : "9,99 €/mes"}</h2></Card>
      <Button 
        className={subscription==="pro" ? "danger-btn full" : "green-btn full"} 
        onClick={() => {
          if (subscription === "pro") {
            const confirmCancel = window.confirm("¿Estás seguro de que quieres cancelar tu suscripción a FitAI Pro? Perderás el acceso al chat ilimitado con el Coach IA, el calendario completo de progreso y las tendencias avanzadas.");
            if (confirmCancel) {
              actions.setSubscription("free");
            }
          } else {
            actions.setSubscription("pro");
          }
        }}
      >
        {subscription === "pro" ? "Cancelar plan" : "Mejorar a Pro"}
      </Button>
    </div></div>
  );
}

function SupportPanel({ state, onBack }) {
  const { darkMode } = state;
  return (
    <div className="modal-bg"><div className={`modal ${darkMode ? "modal-dark" : ""}`}>
      <div className="topbar"><button onClick={onBack}><ArrowLeft /></button><h2>Soporte</h2><span /></div>
      <Card className={darkMode ? "dark-card" : ""}><Headphones /><h2>Centro de soporte</h2><textarea className="text-input area" placeholder="Describe tu problema..." /><Button className="green-btn full">Enviar ticket</Button></Card>
    </div></div>
  );
}

function UpgradeLimitModal({ type, onClose, onUpgrade, darkMode }) {
  const titles = {
    photo: "Límite de Fotos de Comida",
    workout: "Límite de Entrenamientos",
    chat: "Límite del Coach de IA"
  };

  const descriptions = {
    photo: "Has alcanzado el límite de 1 análisis de foto diario en el plan gratuito.",
    workout: "Has alcanzado el límite de 1 entrenamiento registrado diario en el plan gratuito.",
    chat: "Has alcanzado el límite de 1 mensaje diario del Coach de IA en el plan gratuito."
  };

  return (
    <div className="modal-bg" style={{ zIndex: 1000 }}>
      <div className={`modal ${darkMode ? "modal-dark" : ""}`} style={{ textAlign: "center", padding: "30px 24px" }}>
        <div style={{
          width: "64px",
          height: "64px",
          borderRadius: "20px",
          background: "linear-gradient(135deg, #fbbf24, #f59e0b)",
          color: "#09090b",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: "0 auto 20px",
          boxShadow: "0 8px 20px rgba(245, 158, 11, 0.3)"
        }}>
          <Crown size={28} style={{ fill: "currentColor" }} />
        </div>
        <h2 style={{ fontSize: "22px", fontWeight: "900", marginBottom: "8px" }}>{titles[type] || "Función Premium"}</h2>
        <p className="muted" style={{ fontSize: "13px", lineHeight: "1.5", marginBottom: "24px" }}>
          {descriptions[type]} <br /> ¡Desbloquea <b>FitAI Pro</b> para obtener acceso ilimitado!
        </p>

        <Card className={darkMode ? "dark-card" : ""} style={{ textAlign: "left", padding: "20px", marginBottom: "24px" }}>
          <h3 style={{ margin: "0 0 12px 0", fontSize: "14px", fontWeight: "900", display: "flex", alignItems: "center", gap: "6px", color: "var(--text)" }}>
            <Sparkles size={16} style={{ color: "#fbbf24", fill: "#fbbf24" }} /> Beneficios de FitAI Pro:
          </h3>
          <ul style={{ margin: 0, paddingLeft: "18px", fontSize: "12px", lineHeight: "1.8", color: "var(--text)" }}>
            <li style={{ marginBottom: "4px" }}><b>Análisis de fotos de comida ilimitado</b> con IA.</li>
            <li style={{ marginBottom: "4px" }}><b>Registro de entrenamientos ilimitado</b>.</li>
            <li style={{ marginBottom: "4px" }}><b>Coach de IA ilimitado</b> sin restricciones diarias.</li>
            <li style={{ marginBottom: "4px" }}><b>Calendario y tendencias completas</b> de progreso.</li>
          </ul>
        </Card>

        <div style={{ display: "flex", flexDirection: "column", gap: "10px", width: "100%" }}>
          <Button className="green-btn full" onClick={onUpgrade} style={{ height: "48px", borderRadius: "18px", fontSize: "14px", fontWeight: "900" }}>
            <Crown size={15} style={{ fill: "currentColor" }} /> Mejorar a Pro
          </Button>
          <Button className="full" onClick={onClose} style={{ height: "48px", borderRadius: "18px", fontSize: "14px", fontWeight: "900" }}>
            Cerrar
          </Button>
        </div>
      </div>
    </div>
  );
}

function Nav({ tab, setTab, darkMode, subscription }) {
  const tabs = [
    ["home", Home, "Inicio"],
    ["workout", Dumbbell, "Entreno"],
    ["food", Camera, "Comida"],
    ["chat", MessageCircle, "Coach"],
    ["progress", LineChart, "Análisis"],
  ];
  return (
    <div className={`nav ${darkMode ? "nav-dark" : ""}`}>
      {tabs.map(([id, Icon, label, BadgeIcon]) => (
        <button key={id} onClick={() => setTab(id)} className={tab === id ? "active" : ""} style={{ position: "relative" }}>
          <Icon />
          <span>{label}</span>
          {BadgeIcon && (
            <BadgeIcon size={8} style={{
              position: "absolute",
              top: "6px",
              right: "22px",
              color: "#fbbf24",
              fill: "#fbbf24",
            }} />
          )}
        </button>
      ))}
    </div>
  );
}

function App() {
  const [loading, setLoading] = useState(true);
  const [stage, setStage] = useState(() => localStorage.getItem("fitai_stage") || "login");
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem("fitai_user");
    return saved ? JSON.parse(saved) : null;
  });
  const [goal, setGoal] = useState("definir");
  const [tab, setTab] = useState("home");
  const [profile, setProfile] = useState({
    age: "25", weight: "70", startWeight: "70", targetWeight: "68", height: "175",
    sex: "hombre", trainingLevel: "intermedio", activityLevel: "media", sleepGoal: "8",
    stepsGoal: "8000", workoutMinutes: 45
  });
  
  const [foodHistory, setFoodHistory] = useState([]);
  const [workoutsHistory, setWorkoutsHistory] = useState([]);
  const [weightHistory, setWeightHistory] = useState([]);
  const [geminiApiKey, setGeminiApiKey] = useState(DEFAULT_API_KEY);
  const [darkMode, setDarkMode] = useState(false);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [upgradeModalType, setUpgradeModalType] = useState(null);
  const [healthPanelOpen, setHealthPanelOpen] = useState(false);
  const [healthConnected, setHealthConnected] = useState(false);
  const [subscription, setSubscription] = useState("free");
  const [healthStats] = useState({ steps: 7420, distance: 5.6, activeKcal: 285 });

  // Load session from IndexedDB on mount
  useEffect(() => {
    async function loadSession() {
      const savedUser = localStorage.getItem("fitai_user");
      if (savedUser) {
        try {
          const parsedUser = JSON.parse(savedUser);
          if (parsedUser && parsedUser.email) {
            await initDB();
            const data = await getUserData(parsedUser.email);
            if (data) {
              setUser(parsedUser);
              if (data.profile) setProfile(data.profile);
              if (data.goal) setGoal(data.goal);
              if (data.foodHistory) setFoodHistory(data.foodHistory);
              if (data.workoutsHistory) setWorkoutsHistory(data.workoutsHistory);
              if (data.weightHistory) setWeightHistory(data.weightHistory);
              if (data.geminiApiKey !== undefined) setGeminiApiKey(data.geminiApiKey);
              if (data.darkMode !== undefined) setDarkMode(data.darkMode);
              if (data.healthConnected !== undefined) setHealthConnected(data.healthConnected);
              if (data.subscription) setSubscription(data.subscription);
            }
          }
        } catch (e) {
          console.error("Error loading session:", e);
        }
      }
      setLoading(false);
    }
    loadSession();
  }, []);

  // Save states to IndexedDB when user is logged in
  useEffect(() => {
    if (user && user.email) {
      saveUserData(user.email, {
        profile,
        goal,
        foodHistory,
        workoutsHistory,
        weightHistory,
        geminiApiKey,
        darkMode,
        healthConnected,
        subscription
      }).catch((err) => console.error("Error al guardar en IndexedDB:", err));
    }
  }, [user, profile, goal, foodHistory, workoutsHistory, weightHistory, geminiApiKey, darkMode, healthConnected, subscription]);

  // Fix dark mode bug: apply class to document root so ALL elements respect theme
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add("dark-root");
      document.body.style.background = "#09090b";
      document.body.style.color = "white";
    } else {
      document.documentElement.classList.remove("dark-root");
      document.body.style.background = "";
      document.body.style.color = "";
    }
  }, [darkMode]);

  // Save stage and user to localStorage for fast session restoration
  useEffect(() => {
    localStorage.setItem("fitai_stage", stage);
  }, [stage]);

  useEffect(() => {
    localStorage.setItem("fitai_user", user ? JSON.stringify(user) : "");
  }, [user]);

  // Adjust stage automatically if logged in
  useEffect(() => {
    if (user && stage === "login") {
      setStage("app");
    }
  }, [user, stage]);

  const handleLogin = async (u, isNew, loadedData) => {
    setUser(u);
    localStorage.setItem("fitai_user", JSON.stringify(u));
    if (isNew) {
      // Start completely from scratch for new user
      setProfile({
        age: "25", weight: "70", startWeight: "70", targetWeight: "68", height: "175",
        sex: "hombre", trainingLevel: "intermedio", activityLevel: "media", sleepGoal: "8",
        stepsGoal: "8000", workoutMinutes: 45
      });
      setGoal("definir");
      setFoodHistory([]);
      setWorkoutsHistory([]);
      setWeightHistory([{ date: todayKey, weight: 70 }]);
      setGeminiApiKey(DEFAULT_API_KEY);
      setDarkMode(false);
      setHealthConnected(false);
      setSubscription("free");
      setStage("goal");
    } else {
      if (loadedData) {
        if (loadedData.profile) setProfile(loadedData.profile);
        if (loadedData.goal) setGoal(loadedData.goal);
        if (loadedData.foodHistory) setFoodHistory(loadedData.foodHistory);
        if (loadedData.workoutsHistory) setWorkoutsHistory(loadedData.workoutsHistory);
        if (loadedData.weightHistory) setWeightHistory(loadedData.weightHistory);
        if (loadedData.geminiApiKey !== undefined) setGeminiApiKey(loadedData.geminiApiKey);
        if (loadedData.darkMode !== undefined) setDarkMode(loadedData.darkMode);
        if (loadedData.healthConnected !== undefined) setHealthConnected(loadedData.healthConnected);
        if (loadedData.subscription) setSubscription(loadedData.subscription);
      }
      setStage("app");
    }
  };

  const state = { user: user || { name: "Usuario", email: "" }, profile, goal, tab, foodHistory, workoutsHistory, weightHistory, geminiApiKey, darkMode, settingsOpen, healthConnected, healthStats, subscription };
  const actions = { setStage, setUser, setGoal, setTab, setProfile, setFoodHistory, setWorkoutsHistory, setWeightHistory, setGeminiApiKey, setDarkMode, setSettingsOpen, setHealthPanelOpen, setHealthConnected, setSubscription, setUpgradeModalType };

  if (loading) {
    return (
      <div className="page" style={{ background: "#09090b", display: "flex", justifyContent: "center", alignItems: "center" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "16px" }}>
          <motion.div
            animate={{ scale: [1, 1.2, 1], rotate: [0, 180, 360] }}
            transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
            style={{ color: "#bef264" }}
          >
            <Dumbbell size={48} />
          </motion.div>
          <span style={{ color: "#a1a1aa", fontSize: "14px", fontWeight: "600", letterSpacing: "0.05em" }}>Cargando FitAI...</span>
        </div>
      </div>
    );
  }

  if (stage === "login") return <LoginScreen onLogin={handleLogin} />;
  if (stage === "goal") return <GoalScreen goal={goal} setGoal={setGoal} onFinish={() => setStage("profile")} />;
  if (stage === "profile") return <ProfileScreen profile={profile} setProfile={setProfile} goal={goal} onFinish={() => setStage("app")} />;

  return (
    <div className={`page ${darkMode ? "dark-page" : ""}`}>
      <div className={`phone app-phone ${darkMode ? "phone-dark" : ""}`}>
        <div className="dynamic-island" />
        <div className="content">
          {tab === "home" && <HomeScreen state={state} actions={actions} />}
          {tab === "workout" && <WorkoutScreen state={state} actions={actions} />}
          {tab === "food" && <FoodScreen state={state} actions={actions} />}
          {tab === "chat" && <ChatScreen state={state} actions={actions} />}
          {tab === "progress" && (
            subscription === "pro" ? (
              <ProgressScreen state={state} actions={actions} />
            ) : (
              <PremiumFeaturePlaceholder title="Análisis y Progreso" description="Accede al historial completo, gráficos de peso, balance calórico semanal y más estadísticas de salud con el plan FitAI Pro." actions={actions} darkMode={darkMode} />
            )
          )}
        </div>
        <Nav tab={tab} setTab={setTab} darkMode={darkMode} subscription={subscription} />
        {settingsOpen && <SettingsPanel state={state} actions={actions} />}
        {healthPanelOpen && <HealthPanel state={state} actions={actions} />}
        {upgradeModalType && (
          <UpgradeLimitModal
            type={upgradeModalType}
            darkMode={darkMode}
            onClose={() => setUpgradeModalType(null)}
            onUpgrade={() => {
              setUpgradeModalType(null);
              setSettingsOpen("subscription");
            }}
          />
        )}
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);

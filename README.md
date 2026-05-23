# FitAI Coach

Prototipo funcional en React + Vite.

## Cómo abrirlo en Visual Studio Code

1. Descomprime la carpeta.
2. Abre la carpeta `fitai-app` en Visual Studio Code.
3. Abre una terminal y ejecuta:

```bash
npm install
npm run dev
```

4. Entra en la URL que aparece, normalmente:

```bash
http://localhost:5173
```

## Probarlo en móvil

Con el móvil en la misma Wi‑Fi:

```bash
npm run dev -- --host
```

Después abre en el móvil la URL de red que te da Vite, por ejemplo:

```bash
http://192.168.1.34:5173
```

## Qué incluye

- Login y registro visual.
- Onboarding con objetivo y perfil completo.
- Inicio con FitAI Score.
- Chat IA simulado con streaming.
- Escaneo de comida simulado.
- Registro de entrenamientos.
- Calendario mensual.
- Recordatorios.
- Perfil y ajustes.
- Suscripción Pro visual.
- Conexión visual con Apple Health / Google Fit.
- Modo claro y oscuro.

## Nota importante

La IA incluida es simulada para prototipo. Para producción necesitas backend seguro con una API real, por ejemplo OpenAI, y base de datos como Supabase.

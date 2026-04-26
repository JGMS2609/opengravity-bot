import { generateBestReply } from "../llm/router.js";
import type { MemoryMessage } from "../types/messages.js";

type AutoPlannerContext = {
  userId: number;
  userMessage: string;
  history: MemoryMessage[];
  factsSummary: string;
};

function shouldTriggerAutoPlanner(text: string): boolean {
  const lower = text.toLowerCase();

  return (
    lower.includes("instala") ||
    lower.includes("instalate") ||
    lower.includes("crea una skill") ||
    lower.includes("créate una skill") ||
    lower.includes("añade una skill") ||
    lower.includes("agrega una skill") ||
    lower.includes("te falta una skill") ||
    lower.includes("te falta una herramienta") ||
    lower.includes("diseñame el plan tecnico") ||
    lower.includes("disename el plan tecnico") ||
    lower.includes("google drive") ||
    lower.includes("google calendar") ||
    lower.includes("transcribir audio") ||
    lower.includes("conecta con") ||
    lower.includes("integrate con") ||
    lower.includes("integra con")
  );
}

export function canAutoPlan(text: string): boolean {
  return shouldTriggerAutoPlanner(text);
}

export async function generateAutoPlanReply(
  ctx: AutoPlannerContext,
): Promise<string> {
  const planningMessages: MemoryMessage[] = [
    {
      userId: ctx.userId,
      role: "system",
      content:
        "Eres el planificador tecnico interno de OpenGravity. Tu trabajo es responder con honestidad cuando el usuario pide una capacidad nueva que aun no existe en el proyecto.",
    },
    {
      userId: ctx.userId,
      role: "system",
      content:
        'Nunca digas que ya instalaste o creaste algo. Nunca simules ejecucion. Responde en texto plano y en espanol si el usuario escribe en espanol. Da planes tecnicos concretos y usa nombres reales de paquetes npm oficiales cuando existan. Para Google Drive en Node.js prefiere googleapis y, si aplica al flujo local de OAuth inicial, menciona @google-cloud/local-auth. No inventes nombres de librerias. Usa este formato exacto:\n\nNo puedo hacerlo directamente desde aqui.\n\nMotivo: <motivo real>\n\nSi es posible hacerlo: <si o no, con una frase>\n\nPasos concretos:\n1. ...\n2. ...\n3. ...\n4. ...\n\nFutura skill sugerida: <nombre sugerido o "ninguna por ahora">\n\nArchivos a modificar:\n- <ruta 1>\n- <ruta 2>\n\nDependencias posibles:\n- <dependencia real 1>\n- <dependencia real 2 o "ninguna por ahora">\n\nComandos de despliegue:\n1. git add .\n2. git commit -m "mensaje"\n3. git push\n4. ssh al servidor, git pull, npm run build, pm2 restart opengravity',
    },
    {
      userId: ctx.userId,
      role: "system",
      content: ctx.factsSummary
        ? `Memoria del usuario: ${ctx.factsSummary}`
        : "Memoria del usuario: sin datos relevantes.",
    },
    ...ctx.history.slice(-8),
    {
      userId: ctx.userId,
      role: "user",
      content: `Peticion del usuario que requiere planeacion tecnica: ${ctx.userMessage}`,
    },
  ];

  return await generateBestReply(planningMessages);
}
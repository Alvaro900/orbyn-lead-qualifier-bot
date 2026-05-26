import type { QualificationResult } from "./types.js";

const serviceKeywords = [
  "consultoria",
  "consultora",
  "agencia",
  "asesoria",
  "despacho",
  "servicios",
  "outsourcing",
  "marketing",
  "software",
  "tecnologica",
  "tecnologicos",
  "formacion"
];

const locationKeywords = [
  ["espana", "España"],
  ["madrid", "Madrid, España"],
  ["barcelona", "Barcelona, España"],
  ["valencia", "Valencia, España"],
  ["sevilla", "Sevilla, España"],
  ["mexico", "México"],
  ["ciudad de mexico", "Ciudad de México"],
  ["colombia", "Colombia"],
  ["bogota", "Bogotá, Colombia"],
  ["chile", "Chile"],
  ["argentina", "Argentina"],
  ["peru", "Perú"],
  ["uruguay", "Uruguay"],
  ["ecuador", "Ecuador"],
  ["bolivia", "Bolivia"],
  ["paraguay", "Paraguay"],
  ["costa rica", "Costa Rica"],
  ["guatemala", "Guatemala"],
  ["panama", "Panamá"],
  ["latinoamerica", "Latinoamérica"],
  ["lima", "Lima, Perú"],
  ["buenos aires", "Buenos Aires, Argentina"],
  ["santiago de chile", "Santiago de Chile, Chile"],
  ["monterrey", "Monterrey, México"],
  ["medellin", "Medellín, Colombia"]
] as const;

const automationKeywords = [
  "automatizar",
  "automatizacion",
  "ia",
  "inteligencia artificial",
  "chatbot",
  "chatbots",
  "agente",
  "agentes",
  "ventas",
  "procesos",
  "tareas manuales"
];

const employeeRegex = /([0-9]+)\s*(empleados|personas|trabajadores|equipo)/i;

export function fallbackQualifyLead(rawLeadText: string): QualificationResult {
  const normalized = normalizeText(rawLeadText);
  const employeeCount = extractEmployeeCount(rawLeadText);
  const serviceKeyword = serviceKeywords.find((keyword) => normalized.includes(keyword));
  const location = findLocation(normalized);
  const hasAutomationInterest = automationKeywords.some((keyword) => hasKeyword(normalized, keyword));

  const criteria = {
    services_or_consulting: Boolean(serviceKeyword),
    min_5_employees: employeeCount !== null && employeeCount >= 5,
    spain_or_latam: location !== null,
    automation_or_ai_interest: hasAutomationInterest
  };

  const isQualified =
    criteria.services_or_consulting &&
    criteria.min_5_employees &&
    criteria.spain_or_latam &&
    criteria.automation_or_ai_interest;

  return {
    decision: isQualified ? "Cualificado" : "No cualificado",
    reason: buildFallbackReason(criteria, employeeCount, location),
    extracted: {
      business_type: serviceKeyword ? serviceKeywordToLabel(serviceKeyword) : null,
      employee_count: employeeCount,
      location,
      automation_or_ai_interest: hasAutomationInterest
    },
    criteria,
    confidence: "low"
  };
}

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

function extractEmployeeCount(value: string): number | null {
  const match = value.match(employeeRegex);
  if (!match?.[1]) {
    return null;
  }

  return Number.parseInt(match[1], 10);
}

function findLocation(normalized: string): string | null {
  const location = locationKeywords.find(([keyword]) => normalized.includes(keyword));
  return location?.[1] ?? null;
}

function hasKeyword(normalized: string, keyword: string): boolean {
  const normalizedKeyword = normalizeText(keyword);

  if (normalizedKeyword === "ia") {
    return /\bia\b/.test(normalized);
  }

  return normalized.includes(normalizedKeyword);
}

function serviceKeywordToLabel(keyword: string): string {
  const labels: Record<string, string> = {
    consultoria: "consultoría",
    consultora: "consultora",
    agencia: "agencia",
    asesoria: "asesoría",
    despacho: "despacho profesional",
    servicios: "empresa de servicios",
    outsourcing: "outsourcing",
    marketing: "agencia/servicios de marketing",
    software: "software/servicios tecnológicos",
    tecnologica: "servicios tecnológicos",
    tecnologicos: "servicios tecnológicos",
    formacion: "formación/servicios corporativos"
  };

  return labels[keyword] ?? keyword;
}

function buildFallbackReason(
  criteria: QualificationResult["criteria"],
  employeeCount: number | null,
  location: string | null
): string {
  if (
    criteria.services_or_consulting &&
    criteria.min_5_employees &&
    criteria.spain_or_latam &&
    criteria.automation_or_ai_interest
  ) {
    return `Cumple sector compatible, tamaño mínimo, ubicación (${location}) e interés en automatización o IA.`;
  }

  const reasons: string[] = [];

  if (!criteria.services_or_consulting) {
    reasons.push("no se confirma sector de servicios o consultoría B2B");
  }

  if (!criteria.min_5_employees) {
    reasons.push(
      employeeCount === null
        ? "no se indica un tamaño de al menos 5 empleados"
        : `solo indica ${employeeCount} empleados`
    );
  }

  if (!criteria.spain_or_latam) {
    reasons.push("no se confirma ubicación en España o Latinoamérica");
  }

  if (!criteria.automation_or_ai_interest) {
    reasons.push("no hay interés claro en automatización o IA");
  }

  return `No cumple todos los criterios del ICP: ${reasons.join(", ")}.`;
}

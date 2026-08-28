export interface SpecialistDisplay {
  id: string;
  label: string;
  description: string;
}

export const specialistRoster: SpecialistDisplay[] = [
  {
    id: "fmw",
    label: "Oracle Fusion Middleware Specialist",
    description: "WebLogic, SOA, OSB, OHS, JRF, OPSS, JDBC, JMS, domains, clusters, and integrations.",
  },
  {
    id: "bea",
    label: "BEA Decoder Agent",
    description: "Decodes BEA-xxxxx codes and maps each one to a likely subsystem and next check.",
  },
  {
    id: "wlst",
    label: "WLST Checklist Agent",
    description: "Produces read-only WLST health-check checklists — never destructive config changes.",
  },
  {
    id: "rca",
    label: "RCA Agent",
    description: "General WebLogic root-cause investigation across managed server startup and incidents.",
  },
  {
    id: "live",
    label: "Live Log Agent",
    description: "Triages freshly injected or tailed WebLogic logs ahead of stale documentation.",
  },
  {
    id: "fde",
    label: "FDE Architecture Agent",
    description: "Solution architecture, AI vs automation calls, SLOs, evaluation, and production handoff.",
  },
];

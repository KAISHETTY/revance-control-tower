/** Column names for the three-way match. System names come from a public job posting. */
export const SYSTEMS = {
  sales: "Sales side (Salesforce / field CRM)",
  shipment: "Shipment (warehouse)",
  finance: "Finance side (ERP)",
} as const;

export const SYSTEMS_NOTE = "System names reflect a public Revance job posting; how they are actually connected is unknown to me.";

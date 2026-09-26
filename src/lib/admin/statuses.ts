export const leadStatuses = ["new", "contacted", "qualified", "proposal", "won", "lost"] as const;
export type LeadStatus = typeof leadStatuses[number];

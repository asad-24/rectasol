/** M2 data contracts only. These values confer no authorization. */
export const contactLifecycles = ["lead", "qualified", "client", "former_client"] as const;
export const companyLifecycles = ["prospect", "client", "former_client"] as const;
export const opportunityStages = ["new", "contacted", "qualified", "proposal", "won", "lost"] as const;
export const crmSources = ["manual", "website_inquiry", "referral", "import", "other"] as const;
export const lossReasons = ["budget", "timing", "scope_mismatch", "competitor", "no_response", "cancelled", "other"] as const;

export const crmEntityFields = {
  contact: ["full_name", "email", "phone", "source", "lifecycle", "assigned_to", "archived_at"],
  company: ["name", "website", "industry", "country_code", "lifecycle", "assigned_to", "archived_at"],
  contact_company: ["contact_id", "company_id", "job_title", "is_primary", "ended_at"],
  opportunity: ["title", "contact_id", "company_id", "source_inquiry_id", "source", "stage", "expected_value", "currency_code", "expected_close_date", "closed_at", "loss_reason", "assigned_to", "archived_at"],
  inquiry_link: ["inquiry_id", "contact_id"],
} as const;

export type ContactLifecycle = (typeof contactLifecycles)[number];
export type CompanyLifecycle = (typeof companyLifecycles)[number];
export type OpportunityStage = (typeof opportunityStages)[number];
export type CrmSource = (typeof crmSources)[number];
export type LossReason = (typeof lossReasons)[number];
export type CrmEntity = keyof typeof crmEntityFields;
export type CrmChangedField<E extends CrmEntity> = (typeof crmEntityFields)[E][number];
export const contactTransitions = {
  lead: ["qualified"], qualified: ["lead", "client"],
  client: ["former_client"], former_client: ["client", "qualified"],
} as const satisfies Record<ContactLifecycle, readonly ContactLifecycle[]>;
export const companyTransitions = {
  prospect: ["client"], client: ["former_client"], former_client: ["client", "prospect"],
} as const satisfies Record<CompanyLifecycle, readonly CompanyLifecycle[]>;
export const opportunityTransitions = {
  new: ["contacted", "qualified", "proposal", "won", "lost"],
  contacted: ["new", "qualified", "proposal", "won", "lost"],
  qualified: ["new", "contacted", "proposal", "won", "lost"],
  proposal: ["new", "contacted", "qualified", "won", "lost"],
  won: ["qualified"], lost: ["qualified"],
} as const satisfies Record<OpportunityStage, readonly OpportunityStage[]>;


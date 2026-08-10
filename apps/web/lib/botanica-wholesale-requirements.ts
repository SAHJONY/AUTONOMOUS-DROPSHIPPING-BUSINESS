export type WholesaleRequirementEvidence = {
  sourceUrl: string;
  observedAt: string;
  notes?: string;
};

export type WholesaleProgramRequirements = {
  supplierId: string;
  supplierName: string;
  confirmedWholesaleProgram: boolean;
  requiresResaleOrTaxCertificate: boolean | null;
  initialOrderMinimumUsd: number | null;
  repeatOrderMinimumUsd: number | null;
  perItemMinimumRequired: boolean | null;
  accountApprovalRequired: boolean | null;
  evidence: WholesaleRequirementEvidence[];
};

/**
 * Public wholesale onboarding requirements for BOTANICA OCHOSI.
 *
 * These records describe eligibility/onboarding only. They are not quotes and do not
 * authorize purchases. Unknown terms remain null rather than being inferred.
 */
export const BOTANICA_WHOLESALE_REQUIREMENTS: WholesaleProgramRequirements[] = [
  {
    supplierId: "yoruba-imports-miami-gardens",
    supplierName: "Yoruba Imports",
    confirmedWholesaleProgram: true,
    requiresResaleOrTaxCertificate: true,
    initialOrderMinimumUsd: 500,
    repeatOrderMinimumUsd: 200,
    perItemMinimumRequired: true,
    accountApprovalRequired: true,
    evidence: [
      {
        sourceUrl: "https://www.yorubaimports.com/wholesale.html",
        observedAt: "2026-08-09T02:21:00-05:00",
        notes: "Public wholesale registration page states tax documentation, initial/repeat order thresholds, and per-item minimums."
      }
    ]
  },
  {
    supplierId: "religion-universe-miami",
    supplierName: "Religion Universe Import Export Inc.",
    confirmedWholesaleProgram: true,
    requiresResaleOrTaxCertificate: null,
    initialOrderMinimumUsd: null,
    repeatOrderMinimumUsd: null,
    perItemMinimumRequired: null,
    accountApprovalRequired: true,
    evidence: [
      {
        sourceUrl: "https://religionuniverse.com/pages/wholesale-signup-form",
        observedAt: "2026-08-09T02:21:00-05:00",
        notes: "Public wholesaler signup exists; actual pricing is account-gated. Unknown onboarding thresholds remain unset."
      }
    ]
  },
  {
    supplierId: "yoruba-distribuidores-houston",
    supplierName: "Yoruba Distribuidores LLC",
    confirmedWholesaleProgram: true,
    requiresResaleOrTaxCertificate: null,
    initialOrderMinimumUsd: null,
    repeatOrderMinimumUsd: null,
    perItemMinimumRequired: null,
    accountApprovalRequired: true,
    evidence: [
      {
        sourceUrl: "https://yorubadistribuidores.com/",
        observedAt: "2026-08-09T02:21:00-05:00",
        notes: "Public site states wholesale-only for botanicas, religious stores, and registered resellers; numeric thresholds are not publicly confirmed."
      }
    ]
  }
];

export function getWholesaleRequirementsForSupplier(supplierId: string) {
  return BOTANICA_WHOLESALE_REQUIREMENTS.find((record) => record.supplierId === supplierId) ?? null;
}

export function evaluateWholesaleOnboardingReadiness(input: {
  supplierId: string;
  hasCurrentTaxOrResaleCertificate: boolean;
  intendedOrderUsd: number;
  isFirstOrder: boolean;
}) {
  const requirements = getWholesaleRequirementsForSupplier(input.supplierId);
  if (!requirements) {
    return { eligible: false, reasons: ["wholesale onboarding requirements are not yet evidenced"] };
  }

  const reasons: string[] = [];
  if (requirements.requiresResaleOrTaxCertificate === true && !input.hasCurrentTaxOrResaleCertificate) {
    reasons.push("current sales-tax or tax-exempt documentation is required");
  }

  const minimum = input.isFirstOrder
    ? requirements.initialOrderMinimumUsd
    : requirements.repeatOrderMinimumUsd;

  if (minimum !== null && input.intendedOrderUsd <= minimum) {
    reasons.push(`order must exceed $${minimum.toFixed(2)}`);
  }

  if (requirements.accountApprovalRequired === true) {
    reasons.push("supplier account approval must be confirmed before purchase");
  }

  return {
    eligible: reasons.length === 0,
    reasons,
    requirements
  };
}

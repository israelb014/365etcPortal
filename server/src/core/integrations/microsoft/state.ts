import type { GraphData } from './graph';

/** What we remember between syncs (stored as JSON in integrations.state_json). */
export interface MsState {
  skus: Record<string, { name: string; total: number; used: number }>;
  subs: Record<string, { skuId: string; name: string; status: string; next: string | null }>;
  users: Record<string, { upn: string; name: string; skus: string[] }>;
}

/** Free / viral SKUs report huge unit counts; they are not real purchases. */
const FREE_SKU_UNITS = 10_000;

const FRIENDLY: Record<string, string> = {
  O365_BUSINESS_ESSENTIALS: 'Business Basic',
  O365_BUSINESS_PREMIUM: 'Business Standard',
  SPB: 'Business Premium',
  O365_BUSINESS: 'Apps for business',
  SMB_BUSINESS: 'Apps for business',
  OFFICESUBSCRIPTION: 'Apps for enterprise',
  EXCHANGESTANDARD: 'Exchange Online Plan 1',
  EXCHANGEENTERPRISE: 'Exchange Online Plan 2',
  EXCHANGEESSENTIALS: 'Exchange Online Essentials',
  STANDARDPACK: 'Office 365 E1',
  ENTERPRISEPACK: 'Office 365 E3',
  ENTERPRISEPREMIUM: 'Office 365 E5',
  SPE_E3: 'Microsoft 365 E3',
  SPE_E5: 'Microsoft 365 E5',
  SPE_F1: 'Microsoft 365 F3',
  DESKLESSPACK: 'Office 365 F3',
  AAD_PREMIUM: 'Entra ID P1',
  INTUNE_A: 'Intune',
  VISIOCLIENT: 'Visio Plan 2',
  PROJECTPROFESSIONAL: 'Project Plan 3',
  POWER_BI_PRO: 'Power BI Pro',
  Microsoft_Teams_Essentials: 'Teams Essentials',
  O365_BUSINESS_ESSENTIALS_NO_TEAMS: 'Business Basic',
  O365_BUSINESS_PREMIUM_NO_TEAMS: 'Business Standard',
  SPB_NO_TEAMS: 'Business Premium',
};

export function skuName(partNumber: string): string {
  return FRIENDLY[partNumber] ?? partNumber.replace(/_/g, ' ');
}

export function isCountedSku(total: number): boolean {
  return total > 0 && total < FREE_SKU_UNITS;
}

export function buildState(data: GraphData): MsState {
  const state: MsState = { skus: {}, subs: {}, users: {} };
  for (const s of data.skus) {
    state.skus[s.skuId] = {
      name: skuName(s.skuPartNumber),
      total: s.prepaidUnits?.enabled ?? 0,
      used: s.consumedUnits ?? 0,
    };
  }
  for (const s of data.subscriptions) {
    state.subs[s.id] = {
      skuId: s.skuId,
      name: skuName(s.skuPartNumber),
      status: s.status,
      next: s.nextLifecycleDateTime ?? null,
    };
  }
  for (const u of data.users) {
    state.users[u.id] = {
      upn: u.userPrincipalName,
      name: u.displayName || u.userPrincipalName,
      skus: [...new Set((u.assignedLicenses ?? []).map((l) => l.skuId))].sort(),
    };
  }
  return state;
}

/** Licenses bought / used across real (paid) SKUs, for the home ring. */
export function licenseTotals(state: MsState | null): { total: number; used: number } {
  let total = 0;
  let used = 0;
  for (const s of Object.values(state?.skus ?? {})) {
    if (!isCountedSku(s.total)) continue;
    total += s.total;
    used += s.used;
  }
  return { total, used };
}

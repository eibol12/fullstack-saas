export type TierName = 'free' | 'starter' | 'pro';
export type SupportLevel = "community" | "email" | "priority"

export interface Capabilities {
    current_tier: TierName;
    subscription_active: boolean;
    max_projects: number | null;
    max_analyses_per_project: number | null;
    max_designs_per_analysis: number | null;
    can_export_pdf: boolean;
    can_use_api: boolean;
    support_level: SupportLevel;
    current_projects: number;
    current_analyses: number;
    current_designs: number;
}

export interface CapabilitiesState {
    data: Capabilities | null;
    loading: boolean;
    error: string | null;
}
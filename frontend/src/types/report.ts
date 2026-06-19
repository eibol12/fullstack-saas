export interface ReportHeader {
  title: string
  subtitle: string
  project_name: string
  analysis_name: string
  design_name: string
  company_name: string
  company_logo_url: string | null
  prepared_by: string
  issued_date: string
  issued_datetime: string
  report_number: string
  revision: string
  produced_with: string
}

export interface ReportMetric {
  label: string
  value: number | string | null
  unit: string | null
}

export interface GoverningResult {
  label: string
  component_type?: string
  utilization: number | null
  status: 'pass' | 'warning' | 'fail' | 'unknown'
}

export interface ReportRecommendation {
  selected_key: string
  selected_title: string
  status: string
  is_active: boolean
  arrangement: string[]
  governing_result: GoverningResult
  overall_compatible: boolean | null
  warning_messages: string[]
  critical_notes: string[]
  key_metrics: ReportMetric[]
}

export interface AvailableReportCombination {
  key: string
  title: string
}

export interface ReportContext {
  project_description: string
  location: string | null
  lifting_points_qty: number | null
  created_at: string
  updated_at: string
}

export interface ReportBasisItem {
  label?: string
  value?: number | string | null
  unit?: string | null
  position?: number
  component_type?: string
}

export interface SelectedComponentScheduleItem {
  position: number
  component_type: string
  designation: string
  capacity: number | null
  capacity_label: string
  utilization: number | null
  status: 'pass' | 'warning' | 'fail'
}

export interface SlingLengthRow {
  leg: number
  length: number | null
  unit: string | null
}

export interface GoverningCheckItem {
  position: number
  component_type: string
  utilization: number | null
  status: 'pass' | 'warning' | 'fail'
  controlling_check: string | null
  minimum_breaking_load: number | null
  proof_load: number | null
  nominal_safety_factor: number | null
}

export interface OtherCombinationSummary {
  key: string
  title: string
  overall_compatible: boolean | null
  governing_result: GoverningResult
  warning_message: string | null
}

export interface ReportField {
  key: string
  label: string
  value: unknown
  kind: 'number' | 'text' | 'boolean' | 'structured'
}

export interface AppendixFactorRow {
  position: number
  component_id?: string
  component_type: string
  utilization?: number | null
  display_values: ReportField[]
  metadata: ReportField[]
}

export interface AppendixTraceRow {
  key: string
  label: string
  category: 'input' | 'factor' | 'intermediate' | 'check' | 'result' | 'note'
  value: string | number | boolean | null
  unit: string | null
  value_kind: 'number' | 'text' | 'boolean'
  variable_latex: string | null
  formula_latex: string | null
  text_fallback: string | null
  citations: TraceCitation[]
  highlight_result: boolean
}

export interface TraceCitation {
  reference_id: string
  clause: string
}

export interface TraceSection {
  title: string
  rows: AppendixTraceRow[]
}

export interface TraceComponentSection {
  position: number
  component_type: string
  manufacturer: string | null
  model: string | null
  capacity: number | null
  capacity_unit: string | null
  header_title: string
  image_url: string | null
  rows: AppendixTraceRow[]
}

export interface ReportReference {
  id: string
  title: string
}

export interface AppendixComponentTraces {
  design_parameters: TraceSection
  components: TraceComponentSection[]
  references: ReportReference[]
}

export interface AppendixCompatibilityRow {
  pair: string
  compatible: boolean | null
  reason: string | null
  first_component: Record<string, unknown>
  second_component: Record<string, unknown>
}

export interface DesignReportPayload {
  header: ReportHeader
  available_combinations: AvailableReportCombination[]
  recommendation: ReportRecommendation
  project_context: ReportContext
  design_basis: {
    loads: ReportMetric[]
    factors: ReportMetric[]
    arrangement: ReportBasisItem[]
  }
  selected_components: {
    items: SelectedComponentScheduleItem[]
    sling_lengths: SlingLengthRow[]
    visuals: {
      arrangement_sketch_url: string | null
    }
  }
  governing_checks: GoverningCheckItem[]
  compatibility_summary: {
    overall_compatible: boolean | null
    geometric_warning: string | null
    warning_message: string | null
    details: Record<string, unknown>[]
  }
  notes: {
    assumptions: string[]
    limitations: string[]
  }
  appendix: {
    warnings: string[]
    other_combinations: OtherCombinationSummary[]
    component_factors: AppendixFactorRow[]
    component_traces: AppendixComponentTraces
    compatibility_details: AppendixCompatibilityRow[]
  }
}

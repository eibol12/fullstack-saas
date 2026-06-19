import { useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'

import { useDesignReport } from '@/features/design/hooks/useDesigns'
import {
  ReportFloatingActionBar,
  type Zoom,
} from '@/features/design/components/ReportFloatingActionBar'
import { MathRenderer } from '@/components/MathRenderer'
import {
  AppendixTraceRow,
  DesignReportPayload,
  ReportField,
  ReportMetric,
  ReportReference,
  TraceComponentSection,
} from '@/types/report'
import { ANALYSIS_DISPLAY_LABELS, replaceAnalysisDisplayLabel } from '@/lib/analysisDisplay'

import './DesignReportPage.css'

// ── Formatting helpers ─────────────────────────────────────────────

function formatMetricValue(
  value: ReportMetric['value'],
  unit?: string | null,
  options?: { fixedDecimals?: boolean },
): string {
  if (value === null || value === undefined || value === '') return '-'
  if (typeof value === 'number') {
    const formatted = options?.fixedDecimals
      ? value.toFixed(2)
      : Number.isInteger(value)
        ? value.toString()
        : value.toFixed(2)
    return unit ? `${formatted} ${unit}` : formatted
  }
  return unit ? `${value} ${unit}` : String(value)
}

function formatDate(value?: string | null): string {
  if (!value) return '-'
  return new Date(value).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  })
}

function statusClass(status?: string | null): string {
  switch (status) {
    case 'fail':    return 'report-status report-status-fail'
    case 'warning': return 'report-status report-status-warning'
    default:        return 'report-status report-status-pass'
  }
}

function pillClass(status?: string | null): string {
  switch (status) {
    case 'fail':    return 'report-pill report-pill-fail'
    case 'warning': return 'report-pill report-pill-warning'
    default:        return 'report-pill report-pill-pass'
  }
}

function toTitleCaseWord(word: string): string {
  if (!word) return word
  if (/^[A-Z0-9]+$/.test(word)) return word
  if (/^(mm|cm|m|kg|te)$/i.test(word)) return word
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
}

function humanizeDisplayText(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return value
  if (trimmed.includes('/')) {
    const parts = trimmed.split('/').map((p) => p.trim())
    if (parts.every((p) => /^[A-Za-z][A-Za-z0-9_ ]*$/.test(p))) {
      return parts.map((p) => humanizeDisplayText(p)).join(' / ')
    }
  }
  if (!/^[A-Za-z][A-Za-z0-9_ ]*$/.test(trimmed)) return value
  const withSpaces = trimmed
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
  return withSpaces.split(' ').map(toTitleCaseWord).join(' ')
}

function capitalizeLeadingText(value: string): string {
  return value.replace(/[A-Za-z]/, (m) => m.toUpperCase())
}

function formatContextText(value?: string | null): string {
  if (!value) return '-'
  const humanized = humanizeDisplayText(value)
  if (humanized !== value) return humanized
  return capitalizeLeadingText(value)
}

function formatRecordValue(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return '-'
  if (typeof value === 'string') return humanizeDisplayText(value)
  if (typeof value === 'number') return String(value)
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (
    Array.isArray(value) &&
    value.every((item) => item === null || ['string', 'number', 'boolean'].includes(typeof item))
  ) {
    return value.map((item) => formatRecordValue(item) ?? '-').join(', ')
  }
  return null
}

function formatComponentFactorValue(field: ReportField): string | null {
  if (field.value === null || field.value === undefined || field.value === '') return '-'
  if (field.kind === 'number' && typeof field.value === 'number') return field.value.toFixed(2)
  if (field.kind === 'boolean' && typeof field.value === 'boolean') return field.value ? 'Yes' : 'No'
  if (field.kind === 'text' && typeof field.value === 'string') return humanizeDisplayText(field.value)
  return formatRecordValue(field.value)
}

function formatTraceValue(row: AppendixTraceRow): string {
  if (row.value === null || row.value === undefined || row.value === '') return '-'
  if (row.value_kind === 'number' && typeof row.value === 'number') {
    const formatted = row.value.toFixed(2)
    return row.unit ? `${formatted} ${row.unit}` : formatted
  }
  if (row.value_kind === 'boolean' && typeof row.value === 'boolean') {
    return row.value ? 'Yes' : 'No'
  }
  return humanizeDisplayText(String(row.value))
}

function formatTraceCitations(row: AppendixTraceRow): string {
  if (row.citations.length === 0) return ''
  return row.citations.map((c) => `§ ${c.clause}, Ref [${c.reference_id}]`).join(' · ')
}

function formatCompatibilityNote(
  value?: string | null,
  options?: { compatible?: boolean | null },
): string {
  if (value) return value
  if (options?.compatible) return 'N/A'
  return '-'
}

// ── Shared render helpers ──────────────────────────────────────────

function renderComponentFactorFields(fields: ReportField[]) {
  if (fields.length === 0) {
    return <p className="report-section-intro">No supporting data available.</p>
  }
  return (
    <div className="report-record-grid">
      {fields.map((field) => (
        <div key={field.key}>
          <h4 className="report-subsection-title">{replaceAnalysisDisplayLabel(field.label)}</h4>
          {formatComponentFactorValue(field) !== null ? (
            <p className="report-record-value">{formatComponentFactorValue(field)}</p>
          ) : (
            <pre className="report-json">{JSON.stringify(field.value, null, 2)}</pre>
          )}
        </div>
      ))}
    </div>
  )
}

function appendixRowTitle(position: number, componentType: string): string {
  return `Position ${position} — ${humanizeDisplayText(componentType)}`
}

function compatibilityComponentLabel(component: unknown): string {
  if (!component || typeof component !== 'object') return 'Component'
  const r = component as Record<string, unknown>
  return r.component_type ? humanizeDisplayText(String(r.component_type)) : 'Component'
}

function compatibilityPair(detail: Record<string, unknown>): string {
  const first  = detail.first_component_dict
  const second = detail.second_component_dict
  if (!first && !second) return '-'
  return `${compatibilityComponentLabel(first)} → ${compatibilityComponentLabel(second)}`
}

// ── Sub-components ─────────────────────────────────────────────────

function ReportMetricList({
  items,
  fixedDecimals = false,
  compact = false,
}: {
  items: ReportMetric[]
  fixedDecimals?: boolean
  compact?: boolean
}) {
  return (
    <dl className={compact ? 'report-data-list-compact' : 'report-data-list'}>
      {items.map((item) => (
        <div key={item.label} className="report-data-item">
          <dt>{replaceAnalysisDisplayLabel(item.label)}</dt>
          <dd>{formatMetricValue(item.value, item.unit, { fixedDecimals })}</dd>
        </div>
      ))}
    </dl>
  )
}

function TraceRowView({ row }: { row: AppendixTraceRow }) {
  const citations    = formatTraceCitations(row)
  const hasMath      = Boolean(row.formula_latex || row.variable_latex)
  const valueLine    = formatTraceValue(row)

  return (
    <div className={`report-trace-row${row.highlight_result ? ' report-trace-row-highlight' : ''}`}>
      <div className="report-trace-label">{replaceAnalysisDisplayLabel(row.label)}</div>
      <div className="report-trace-body">
        {row.formula_latex ? (
          <MathRenderer
            expression={row.formula_latex}
            fallback={row.text_fallback}
            displayMode
            className="report-trace-formula"
          />
        ) : row.text_fallback && !row.variable_latex ? (
          <p className="report-trace-note">{row.text_fallback}</p>
        ) : null}

        {row.variable_latex ? (
          <MathRenderer
            expression={row.variable_latex}
            fallback={valueLine}
            className="report-trace-variable"
          />
        ) : (
          <p className={`report-trace-value${hasMath ? ' report-trace-value-secondary' : ''}`}>
            {valueLine}
          </p>
        )}

        {row.text_fallback && row.formula_latex && !row.variable_latex && valueLine !== '-' && (
          <p className="report-trace-value report-trace-value-secondary">{valueLine}</p>
        )}
      </div>
      <div className="report-trace-citations">{citations || ' '}</div>
    </div>
  )
}

function TraceComponentSectionView({ section }: { section: TraceComponentSection }) {
  return (
    <div className="report-record report-trace-component">
      <div className="report-trace-component-header">
        <div>
          <p className="report-record-title">{section.header_title}</p>
          {(section.manufacturer || section.model) && (
            <p className="report-record-value" style={{ marginTop: '0.2rem' }}>
              {[section.manufacturer, section.model].filter(Boolean).join(' — ')}
              {section.capacity != null
                ? ` · ${formatMetricValue(section.capacity, section.capacity_unit)}`
                : ''}
            </p>
          )}
        </div>
        {section.image_url ? (
          <img
            className="report-trace-component-image"
            src={section.image_url}
            alt={`${section.component_type} reference`}
          />
        ) : (
          <div className="report-trace-component-image report-trace-component-image-placeholder">
            No image
          </div>
        )}
      </div>
      <div className="report-trace-list">
        {section.rows.map((row) => (
          <TraceRowView
            key={`${section.position}-${section.component_type}-${row.key}`}
            row={row}
          />
        ))}
      </div>
    </div>
  )
}

function TraceReferencesSection({ references }: { references: ReportReference[] }) {
  if (references.length === 0) return null
  return (
    <div className="report-panel" style={{ marginTop: '1rem' }}>
      <h3>References</h3>
      <ol className="report-reference-list">
        {references.map((ref) => (
          <li key={ref.id}>{ref.title}</li>
        ))}
      </ol>
    </div>
  )
}

// ── Section components ─────────────────────────────────────────────

function ReportHeaderBlock({ report }: { report: DesignReportPayload }) {
  const { header } = report
  return (
    <header className="report-title-block">
      {/* Left: company identity + document title */}
      <div className="report-title-identity">
        <div className="report-title-company">
          {header.company_logo_url ? (
            <img
              className="report-company-logo"
              src={header.company_logo_url}
              alt={`${header.company_name} logo`}
            />
          ) : (
            <div className="report-company-logo-initial" aria-hidden>
              {(header.company_name || 'C').charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <p className="report-company-name">{header.company_name}</p>
            <p className="report-company-note">Prepared by {header.prepared_by}</p>
          </div>
        </div>

        <div className="report-title-text">
          <span className="report-doc-type">{header.title}</span>
          <h1 className="report-title">{header.design_name}</h1>
          <p className="report-subtitle">{header.subtitle}</p>
        </div>
      </div>

      {/* Right: document metadata */}
      <aside className="report-title-meta">
        <table className="report-meta" aria-label="Document metadata">
          <tbody>
            <tr><th>Report No.</th><td>{header.report_number}</td></tr>
            <tr><th>Revision</th><td>{header.revision}</td></tr>
            <tr><th>Issued</th><td>{formatDate(header.issued_date)}</td></tr>
            <tr><th>Project</th><td>{header.project_name || '—'}</td></tr>
            <tr><th>Analysis</th><td>{header.analysis_name || '—'}</td></tr>
          </tbody>
        </table>
        <p className="report-producer">{header.produced_with}</p>
      </aside>
    </header>
  )
}

function RecommendationSummary({ report }: { report: DesignReportPayload }) {
  const { recommendation } = report
  return (
    <section className="report-section">
      <h2 className="report-section-title">Recommendation Summary</h2>
      <div className="report-recommendation">
        {/* Left: narrative + status pills + critical notes */}
        <div>
          <h3 className="report-recommendation-title">{recommendation.selected_title}</h3>
          <p className="report-recommendation-body">
            This report presents the recommended rigging arrangement and governing engineering
            outcome for issue-ready review. The recommendation, compatibility state, and governing
            utilization are presented first so the key decision is visible within seconds.
          </p>

          <div className="report-pill-row">
            <span className="report-pill">{recommendation.status}</span>
            {recommendation.is_active && <span className="report-pill">Active Design</span>}
            <span className={pillClass(recommendation.governing_result.status)}>
              {recommendation.governing_result.status}
            </span>
            <span className="report-pill">
              {recommendation.overall_compatible ? 'Compatible' : 'Review Compatibility'}
            </span>
          </div>

          {recommendation.critical_notes.length > 0 && (
            <div className="report-critical-notes">
              <h3>Critical Notes</h3>
              <ul className="report-note-list">
                {recommendation.critical_notes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Right: key metrics grid */}
        <div className="report-metric-grid">
          {recommendation.key_metrics.map((metric) => (
            <div className="report-metric" key={metric.label}>
              <span className="report-metric-label">{replaceAnalysisDisplayLabel(metric.label)}</span>
              <span className="report-metric-value">{formatMetricValue(metric.value, metric.unit)}</span>
            </div>
          ))}
          <div className="report-metric">
            <span className="report-metric-label">Governing Component</span>
            <span className="report-metric-value">
              {recommendation.governing_result.label}
              {recommendation.governing_result.component_type
                ? ` — ${humanizeDisplayText(recommendation.governing_result.component_type)}`
                : ''}
            </span>
          </div>
          <div className="report-metric">
            <span className="report-metric-label">Governing Utilization</span>
            <span className="report-metric-value">
              {formatMetricValue(recommendation.governing_result.utilization, null)}
            </span>
          </div>
        </div>
      </div>
    </section>
  )
}

function DesignBasisSection({ report }: { report: DesignReportPayload }) {
  const { design_basis, project_context } = report
  return (
    <section className="report-section">
      <h2 className="report-section-title">Project and Design Basis</h2>
      <p className="report-section-intro">
        Consolidates project context, load basis, and governing DNV factors into an issue-ready
        summary, while the full traceability is preserved in the appendix.
      </p>

      <div className="report-two-column">
        <div className="report-panel">
          <h3>Project Context</h3>
          <dl className="report-data-list">
            <div className="report-data-item">
              <dt>Description</dt>
              <dd>
                {project_context.project_description
                  ? formatContextText(project_context.project_description)
                  : 'Not provided'}
              </dd>
            </div>
            <div className="report-data-item">
              <dt>{ANALYSIS_DISPLAY_LABELS.scenario}</dt>
              <dd>{formatContextText(project_context.location)}</dd>
            </div>
            <div className="report-data-item">
              <dt>Lifting Points</dt>
              <dd>{project_context.lifting_points_qty ?? '-'}</dd>
            </div>
            <div className="report-data-item">
              <dt>Created</dt>
              <dd>{formatDate(project_context.created_at)}</dd>
            </div>
            <div className="report-data-item">
              <dt>Last Updated</dt>
              <dd>{formatDate(project_context.updated_at)}</dd>
            </div>
          </dl>
        </div>

        <div className="report-panel">
          <h3>Load Basis</h3>
          <ReportMetricList items={design_basis.loads} />
        </div>
      </div>

      <div className="report-two-column" style={{ marginTop: '1rem' }}>
        <div className="report-panel">
          <h3>DNV Factors</h3>
          <ReportMetricList items={design_basis.factors} fixedDecimals compact />
        </div>

        <div className="report-panel">
          <h3>Arrangement Basis</h3>
          <dl className="report-data-list">
            {design_basis.arrangement.map((item) => (
              <div
                className="report-data-item"
                key={`${item.position}-${item.component_type}`}
              >
                <dt>Position {item.position}</dt>
                <dd>{humanizeDisplayText(item.component_type || '') || '-'}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  )
}

function SelectedComponentsSection({ report }: { report: DesignReportPayload }) {
  const { selected_components, recommendation } = report
  return (
    <section className="report-section">
      <h2 className="report-section-title">Selected Components and Arrangement</h2>
      <p className="report-section-intro">
        Arrangement, component schedule, and sling lengths for the selected combination.
      </p>

      <div className="report-visual-block">
        <div className="report-visual-column">
          <div className="report-panel">
            <h3>Arrangement</h3>
            <div className="report-arrangement-strip">
              {recommendation.arrangement.map((component, index) => (
                <div className="report-arrangement-step" key={`${component}-${index}`}>
                  <strong>Position {index + 1}</strong>
                  <span>{humanizeDisplayText(component)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="report-panel">
            <h3>Sling Lengths</h3>
            {selected_components.sling_lengths.length > 0 ? (
              <table className="report-table report-table-compact">
                <thead>
                  <tr>
                    <th>Leg</th>
                    <th className="col-num">Length</th>
                  </tr>
                </thead>
                <tbody>
                  {selected_components.sling_lengths.map((row) => (
                    <tr key={`sling-${row.leg}`}>
                      <td>{row.leg}</td>
                      <td className="col-num">
                        {row.length !== null
                          ? formatMetricValue(row.length, row.unit, { fixedDecimals: true })
                          : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="report-section-intro">No sling length data available.</p>
            )}
          </div>
        </div>

        {selected_components.visuals.arrangement_sketch_url && (
          <div className="report-panel">
            <h3>Reference Sketch</h3>
            <img
              className="report-sketch"
              src={selected_components.visuals.arrangement_sketch_url}
              alt="Arrangement sketch"
            />
          </div>
        )}
      </div>

      <div className="report-panel" style={{ marginTop: '1rem' }}>
        <h3>Component Schedule</h3>
        <table className="report-table">
          <thead>
            <tr>
              <th>Pos.</th>
              <th>Component</th>
              <th>Designation</th>
              <th className="col-num">Capacity</th>
              <th className="col-num">Utilization</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {selected_components.items.map((item) => (
              <tr key={`${item.position}-${item.component_type}`}>
                <td>{item.position}</td>
                <td>{humanizeDisplayText(item.component_type)}</td>
                <td>{humanizeDisplayText(item.designation)}</td>
                <td className="col-num">
                  {item.capacity !== null
                    ? `${formatMetricValue(item.capacity, 'Te')} ${item.capacity_label}`
                    : '-'}
                </td>
                <td className="col-num">{formatMetricValue(item.utilization, null)}</td>
                <td>
                  <span className={statusClass(item.status)}>{item.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function GoverningChecksSection({ report }: { report: DesignReportPayload }) {
  return (
    <section className="report-section">
      <h2 className="report-section-title">Governing Checks and Compatibility</h2>
      <div className="report-two-column">
        <div className="report-panel">
          <h3>Governing Checks</h3>
          <table className="report-table report-table-compact">
            <thead>
              <tr>
                <th>Pos.</th>
                <th>Component</th>
                <th className="col-num">UR</th>
                <th>Control</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {report.governing_checks.map((item) => (
                <tr key={`${item.position}-${item.component_type}`}>
                  <td>{item.position}</td>
                  <td>{humanizeDisplayText(item.component_type)}</td>
                  <td className="col-num">
                    {formatMetricValue(item.utilization, null)}
                  </td>
                  <td>{item.controlling_check || '-'}</td>
                  <td>
                    <span className={statusClass(item.status)}>{item.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="report-panel">
          <h3>Compatibility Summary</h3>
          <dl className="report-data-list">
            <div className="report-data-item">
              <dt>Overall Compatible</dt>
              <dd>
                {report.compatibility_summary.overall_compatible == null
                  ? '-'
                  : report.compatibility_summary.overall_compatible
                  ? 'Yes'
                  : 'Review Required'}
              </dd>
            </div>
            <div className="report-data-item">
              <dt>Primary Warning</dt>
              <dd>
                {formatCompatibilityNote(report.compatibility_summary.warning_message, {
                  compatible: report.compatibility_summary.overall_compatible,
                })}
              </dd>
            </div>
            <div className="report-data-item">
              <dt>Geometric Warning</dt>
              <dd>
                {formatCompatibilityNote(report.compatibility_summary.geometric_warning, {
                  compatible: report.compatibility_summary.overall_compatible,
                })}
              </dd>
            </div>
          </dl>
        </div>
      </div>

      {report.compatibility_summary.details.length > 0 && (
        <div className="report-panel" style={{ marginTop: '1rem' }}>
          <h3>Compatibility Detail</h3>
          <table className="report-table report-table-compact">
            <thead>
              <tr>
                <th>Component Pair</th>
                <th>Compatible</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>
              {report.compatibility_summary.details.map((detail, index) => (
                <tr key={`compat-${index}`}>
                  <td>{compatibilityPair(detail)}</td>
                  <td>
                    {detail.compatible == null
                      ? '-'
                      : detail.compatible
                      ? 'Yes'
                      : 'No'}
                  </td>
                  <td>
                    {formatCompatibilityNote(
                      typeof detail.reason === 'string' ? detail.reason : null,
                      {
                        compatible:
                          typeof detail.compatible === 'boolean' ? detail.compatible : null,
                      },
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

function NotesSection({ report }: { report: DesignReportPayload }) {
  return (
    <section className="report-section">
      <h2 className="report-section-title">Notes, Assumptions, and Limitations</h2>
      <div className="report-two-column">
        <div className="report-panel">
          <h3>Assumptions</h3>
          <ul className="report-note-list">
            {report.notes.assumptions.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
        <div className="report-panel">
          <h3>Limitations</h3>
          <ul className="report-note-list">
            {report.notes.limitations.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}

function AppendixSection({ report }: { report: DesignReportPayload }) {
  return (
    <section className="report-appendix">
      <h2 className="report-appendix-title">Technical Appendix</h2>
      <p className="report-appendix-intro">
        Supporting technical detail for engineering review, verification, and issue preparation.
        Full factor tables, step-by-step calculation traces, and compatibility analysis are
        presented per component position.
      </p>

      {/* A.1 Warnings and Alternate Combinations */}
      <div className="report-appendix-group">
        <h3 className="report-appendix-group-title">Warnings and Alternate Combinations</h3>
        <div className="report-two-column">
          <div className="report-panel">
            <h4>Warnings</h4>
            {report.appendix.warnings.length > 0 ? (
              <ul className="report-note-list">
                {report.appendix.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            ) : (
              <p className="report-section-intro" style={{ margin: 0 }}>
                No warnings recorded for this design.
              </p>
            )}
          </div>

          <div className="report-panel">
            <h4>Other Combinations</h4>
            {report.appendix.other_combinations.length > 0 ? (
              <table className="report-table report-table-compact">
                <thead>
                  <tr>
                    <th>Combination</th>
                    <th>Compatible</th>
                    <th>Warning</th>
                  </tr>
                </thead>
                <tbody>
                  {report.appendix.other_combinations.map((combo) => (
                    <tr key={combo.key}>
                      <td>{combo.title}</td>
                      <td>
                        {combo.overall_compatible == null
                          ? '-'
                          : combo.overall_compatible
                          ? 'Yes'
                          : 'Review'}
                      </td>
                      <td>{combo.warning_message || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="report-section-intro" style={{ margin: 0 }}>
                No alternate combinations available.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* A.2 Component Factors */}
      <div className="report-appendix-group">
        <h3 className="report-appendix-group-title">Component Factors</h3>
        {report.appendix.component_factors.length > 0 ? (
          report.appendix.component_factors.map((row) => (
            <div
              className="report-record"
              key={`factor-${row.position}-${row.component_type}-${row.component_id ?? 'n/a'}`}
            >
              <div className="report-record-header">
                <p className="report-record-title">
                  {appendixRowTitle(row.position, row.component_type)}
                </p>
                {row.utilization != null && (
                  <span className={statusClass(
                    row.utilization > 1 ? 'fail' : row.utilization > 0.9 ? 'warning' : 'pass',
                  )}>
                    UR {row.utilization.toFixed(2)}
                  </span>
                )}
              </div>
              {renderComponentFactorFields(row.display_values)}
            </div>
          ))
        ) : (
          <p className="report-section-intro">No component factor data available.</p>
        )}
      </div>

      {/* A.3 Component Traces */}
      <div className="report-appendix-group">
        <h3 className="report-appendix-group-title">Calculation Traces</h3>
        {report.appendix.component_traces.design_parameters.rows.length > 0 ||
        report.appendix.component_traces.components.length > 0 ? (
          <>
            {report.appendix.component_traces.design_parameters.rows.length > 0 && (
              <div className="report-panel">
                <h4>{report.appendix.component_traces.design_parameters.title}</h4>
                <div className="report-trace-list">
                  {report.appendix.component_traces.design_parameters.rows.map((row) => (
                    <TraceRowView key={`dp-${row.key}`} row={row} />
                  ))}
                </div>
              </div>
            )}

            {report.appendix.component_traces.components.map((section) => (
              <TraceComponentSectionView
                key={`trace-${section.position}-${section.component_type}`}
                section={section}
              />
            ))}

            <TraceReferencesSection
              references={report.appendix.component_traces.references}
            />
          </>
        ) : (
          <p className="report-section-intro">No calculation trace data available.</p>
        )}
      </div>

      {/* A.4 Compatibility Details (only if present) */}
      {report.appendix.compatibility_details.length > 0 && (
        <div className="report-appendix-group">
          <h3 className="report-appendix-group-title">Compatibility Details</h3>
          <table className="report-table report-table-compact">
            <thead>
              <tr>
                <th>Component Pair</th>
                <th>Compatible</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>
              {report.appendix.compatibility_details.map((detail, index) => (
                <tr key={`appcompat-${index}`}>
                  <td>
                    {`${compatibilityComponentLabel(detail.first_component)} → ${compatibilityComponentLabel(detail.second_component)}`}
                  </td>
                  <td>
                    {detail.compatible == null ? '-' : detail.compatible ? 'Yes' : 'No'}
                  </td>
                  <td>{detail.reason || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

// ── Main page ──────────────────────────────────────────────────────

export default function DesignReportPage() {
  const { id = '' } = useParams<{ id: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const selectedKey = searchParams.get('selected_key') || undefined
  const { data: report, isLoading, error } = useDesignReport(id, selectedKey)
  const [zoom, setZoom] = useState<Zoom>(1)

  if (isLoading) {
    return (
      <div className="report-preview-shell">
        <div className="report-sheet">
          <div className="report-inner">
            <p className="report-section-intro">Loading engineering report…</p>
          </div>
        </div>
      </div>
    )
  }

  if (error || !report) {
    const is403 = (error as { response?: { status?: number } } | null)?.response?.status === 403
    return (
      <div className="report-preview-shell">
        <div className="report-sheet">
          <div className="report-inner">
            {is403 ? (
              <>
                <h1 className="report-title">Report Export Not Available</h1>
                <p className="report-section-intro">
                  Report preview and PDF export require the Starter tier or higher.
                  Upgrade your plan to access this feature.
                </p>
                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
                  <Link
                    to="/billing"
                    className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium"
                  >
                    Upgrade Plan
                  </Link>
                  <Link
                    to={`/design/${id}`}
                    className="px-4 py-2 border border-slate-300 rounded-md text-sm font-medium text-slate-700 bg-white"
                  >
                    Back to design
                  </Link>
                </div>
              </>
            ) : (
              <>
                <h1 className="report-title">Unable to Load Report</h1>
                <p className="report-section-intro">
                  {(error as Error | undefined)?.message ||
                    'The report could not be generated from the current design state.'}
                </p>
                <Link
                  to={`/design/${id}`}
                  className="px-4 py-2 border border-slate-300 rounded-md text-sm font-medium text-slate-700 bg-white"
                  style={{ display: 'inline-block', marginTop: '0.75rem' }}
                >
                  Back to design
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    )
  }

  const resolvedKey = report.available_combinations.some((c) => c.key === selectedKey)
    ? selectedKey
    : report.recommendation.selected_key

  return (
    <div className="report-preview-shell">
      {/* ── Screen action row ────────────────────────────────── */}
      <div className="report-preview-actions no-print">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <Link
            to={`/design/${id}`}
            className="px-4 py-2 border border-slate-300 rounded-md text-slate-700 bg-white text-sm"
          >
            ← Back to design
          </Link>
          <Link
            to="/settings/company"
            className="px-4 py-2 border border-slate-300 rounded-md text-slate-700 bg-white text-sm"
          >
            Edit branding
          </Link>
          {report.available_combinations.length > 0 && (
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
              <span style={{ whiteSpace: 'nowrap' }}>Combination</span>
              <select
                value={resolvedKey}
                onChange={(e) => {
                  const next = new URLSearchParams(searchParams)
                  next.set('selected_key', e.target.value)
                  setSearchParams(next)
                }}
                className="min-w-56 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-200"
                aria-label="Select report combination"
              >
                {report.available_combinations.map((c) => (
                  <option key={c.key} value={c.key}>{c.title}</option>
                ))}
              </select>
            </label>
          )}
        </div>
        <button
          onClick={() => window.print()}
          className="px-4 py-2 rounded-md bg-slate-900 text-white text-sm font-medium"
        >
          Print / Save PDF
        </button>
      </div>

      {/* ── Paper sheet ──────────────────────────────────────── */}
      <article className="report-sheet" data-zoom={String(zoom)}>
        <div className="report-inner">
          <ReportHeaderBlock report={report} />

          <main className="report-body">
            <RecommendationSummary report={report} />
            <DesignBasisSection report={report} />
            <SelectedComponentsSection report={report} />
            <GoverningChecksSection report={report} />
            <NotesSection report={report} />
            <AppendixSection report={report} />
          </main>

          <footer className="report-footer">
            <span>{report.header.report_number} · {report.header.revision}</span>
            <span>{report.header.produced_with}</span>
          </footer>
        </div>
      </article>

      {/* ── Floating action bar ───────────────────────────────── */}
      <ReportFloatingActionBar
        backTo={`/design/${id}`}
        zoom={zoom}
        onZoomChange={setZoom}
      />
    </div>
  )
}

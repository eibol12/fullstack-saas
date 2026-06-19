export const ANALYSIS_DISPLAY_LABELS = {
  dryWeight: 'Dry Weight',
  scenario: 'Scenario',
} as const

export const replaceAnalysisDisplayLabel = (label: string): string => {
  const trimmedLabel = label.trim()

  if (/^maximum gross weight(\s*\(kg\))?$/i.test(trimmedLabel)) {
    return trimmedLabel.toLowerCase().includes('(kg)')
      ? `${ANALYSIS_DISPLAY_LABELS.dryWeight} (kg)`
      : ANALYSIS_DISPLAY_LABELS.dryWeight
  }

  if (/^location$/i.test(trimmedLabel)) {
    return ANALYSIS_DISPLAY_LABELS.scenario
  }

  return label
}

export const formatWeightInTe = (
  value: number | null | undefined,
  decimals = 2,
): string => {
  if (value === undefined || value === null) {
    return '-'
  }

  return (value / 1000).toFixed(decimals)
}

import { RiggingDesign, CombinationItem, OptimalCombination, CombinationKey } from '@/types'
import { useState, useEffect } from 'react'
import { FileText } from 'lucide-react'
import { DesignVisualizer3D } from '@/components/visualizer/DesignVisualizer3D'

interface DesignResultsDisplayProps {
    design: RiggingDesign
    onCombinationSelect?: (key: CombinationKey) => void
}

// Helper to format numbers consistently
const formatNumber = (value: number | undefined | null, decimals = 2): string => {
    if (value === undefined || value === null) return '-'
    return value.toFixed(decimals)
}

// Helper to format string values
const formatString = (value: string | undefined | null): string => {
    if (!value) return '-'
    return value
}

// Type guard for WireRope items
const isWireRope = (item: CombinationItem): item is CombinationItem & {
    component_type: 'WireRope'
    eye_type?: string | null
    termination?: string | null
    configuration?: string | null
    diameter?: number | null
} => {
    return item.component_type === 'WireRope'
}

// Component to render a single combination's components
interface CombinationTableProps {
    combination: OptimalCombination
    title: string
    combinationKey: CombinationKey
    isSelectedForReport: boolean
    onSelectForReport: (key: CombinationKey) => void
}

function CombinationTable({ combination, title, combinationKey, isSelectedForReport, onSelectForReport }: CombinationTableProps) {
    const items = combination.items || []

    if (items.length === 0) {
        return (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-yellow-800">No components found for this combination.</p>
            </div>
        )
    }

    // Group items by component type
    const groupedItems: Record<string, CombinationItem[]> = {}
    items.forEach(item => {
        const type = item.component_type
        if (!groupedItems[type]) {
            groupedItems[type] = []
        }
        groupedItems[type].push(item)
    })

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
                <h4 className="text-md font-semibold text-gray-900">{title}</h4>
                <div className="flex items-center gap-2">
                    {combination.overall_compatible !== undefined && (
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                            combination.overall_compatible
                                ? 'bg-green-100 text-green-800'
                                : 'bg-red-100 text-red-800'
                        }`}>
                            {combination.overall_compatible ? 'Compatible' : 'Not Compatible'}
                        </span>
                    )}
                    <button
                        type="button"
                        onClick={() => onSelectForReport(combinationKey)}
                        className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
                            isSelectedForReport
                                ? 'border-primary bg-primary text-primary-foreground'
                                : 'border-gray-300 bg-white text-gray-600 hover:border-primary hover:text-primary'
                        }`}
                    >
                        <FileText className="h-3 w-3" />
                        {isSelectedForReport ? 'Selected for report' : 'Select for report'}
                    </button>
                </div>
            </div>

            {/* Warning Messages */}
            {combination.warning_message && (
                <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
                    <div className="flex">
                        <div className="flex-shrink-0">
                            <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                        </div>
                        <div className="ml-3">
                            <p className="text-sm text-yellow-700">{combination.warning_message}</p>
                        </div>
                    </div>
                </div>
            )}

            {combination.geometric_warning && (
                <div className="bg-orange-50 border-l-4 border-orange-400 p-4">
                    <div className="flex">
                        <div className="flex-shrink-0">
                            <svg className="h-5 w-5 text-orange-400" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                        </div>
                        <div className="ml-3">
                            <p className="text-sm text-orange-700">{combination.geometric_warning}</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Component tables grouped by type */}
            {Object.entries(groupedItems).map(([componentType, typeItems]) => (
                <div key={componentType} className="border border-gray-200 rounded-lg overflow-hidden">
                    <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                        <h5 className="text-sm font-semibold text-gray-700">{componentType}</h5>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="min-w-full table-fixed divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="w-24 px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Position</th>
                                    {componentType !== 'WireRope' && (
                                        <>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Manufacturer</th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Model</th>
                                        </>
                                    )}
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        {componentType === 'WireRope' ? 'MBL (Te)' : 'WLL (Te)'}
                                    </th>
                                    {componentType === 'WireRope' && (
                                        <>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Diameter (mm)</th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Eye Type</th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Termination</th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Configuration</th>
                                        </>
                                    )}
                                    <th className="w-24 px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">UR</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {typeItems.map((item, idx) => {
                                    const isWire = isWireRope(item)
                                    const urColor = item.utilization > 1
                                        ? 'text-red-600 font-bold'
                                        : item.utilization > 0.9
                                        ? 'text-orange-600 font-semibold'
                                        : 'text-green-600'

                                    return (
                                        <tr key={idx} className="hover:bg-gray-50">
                                            <td className="w-24 px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 tabular-nums">
                                                {item.position + 1}
                                            </td>
                                            {!isWire && (
                                                <>
                                                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                                                        {formatString(item.manufacturer)}
                                                    </td>
                                                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                                                        {formatString(item.model)}
                                                    </td>
                                                </>
                                            )}
                                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                                                {formatNumber(item.wll_or_mbl, 2)}
                                            </td>
                                            {isWire && (
                                                <>
                                                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                                                        {formatNumber(item.diameter, 1)}
                                                    </td>
                                                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 capitalize">
                                                        {formatString(item.eye_type)}
                                                    </td>
                                                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 capitalize">
                                                        {formatString(item.termination)}
                                                    </td>
                                                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 capitalize">
                                                        {formatString(item.configuration)}
                                                    </td>
                                                </>
                                            )}
                                            <td className={`w-24 px-4 py-3 whitespace-nowrap text-sm text-right tabular-nums ${urColor}`}>
                                                {formatNumber(item.utilization, 3)}
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            ))}
        </div>
    )
}

export function DesignResultsDisplay({ design, onCombinationSelect }: DesignResultsDisplayProps) {
    const [selectedKey, setSelectedKey] = useState<CombinationKey | null>(null)

    if (!design.results) {
        return (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-yellow-800">No rigging design results available.</p>
            </div>
        )
    }

    const { results } = design
    const { optimal_combinations, calculation_context } = results

    // Determine which scenario we're in
    const hasMinimumOrConservative = optimal_combinations.minimum || optimal_combinations.conservative
    const hasUserSpecified = optimal_combinations.user_specified

    // Auto-select the first available combination on mount / when results load
    useEffect(() => {
        const defaultKey: CombinationKey | null =
            optimal_combinations.minimum ? 'minimum'
            : optimal_combinations.conservative ? 'conservative'
            : optimal_combinations.user_specified ? 'user_specified'
            : null
        if (defaultKey) {
            setSelectedKey(defaultKey)
            onCombinationSelect?.(defaultKey)
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [design.id])

    const handleSelectForReport = (key: CombinationKey) => {
        setSelectedKey(key)
        onCombinationSelect?.(key)
    }

    // Get lifting analysis inputs from calculation context
    const liftingPointsQty = results.summary?.lifting_points_qty ||
                             '-'
    const daf = calculation_context?.dnv_factors?.dynamic_amplification_factor
    const shl = calculation_context?.static?.hook_load
    const ssl = calculation_context?.static?.controlling_sling_load
    const dhl = calculation_context?.dynamic?.hook_load
    const dsl = calculation_context?.dynamic?.controlling_sling_load

    return (
        <div className="space-y-6">
            {/* Header Section */}
            <div className="bg-white rounded-lg shadow-sm p-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">{design.name}</h2>

                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <div className="bg-gray-50 rounded-lg p-3">
                        <span className="text-xs text-gray-500 block">Version</span>
                        <span className="text-lg font-semibold text-gray-900">{design.version}</span>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                        <span className="text-xs text-gray-500 block">Status</span>
                        <span className={`text-lg font-semibold capitalize ${
                            design.status === 'final' ? 'text-green-600' : 'text-yellow-600'
                        }`}>
                            {design.status}
                        </span>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3 col-span-3">
                        <span className="text-xs text-gray-500 block">Analysis</span>
                        <span className="text-lg font-semibold text-gray-900">
                            {design.analysis?.name || '-'}
                        </span>
                    </div>
                </div>

                <div className="mt-4">
                    <div className="bg-gray-50 rounded-lg p-3">
                        <span className="text-xs text-gray-500 block">Project</span>
                        <span className="text-lg font-semibold text-gray-900">
                            {design.project?.name || '-'}
                        </span>
                    </div>
                </div>
            </div>

            {/* Lifting Analysis Inputs Section */}
            <div className="bg-white rounded-lg shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                    Lifting Analysis Inputs
                </h3>

                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                    <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                        <span className="text-xs text-gray-600 block">Lifting Points Qty</span>
                        <span className="text-lg font-semibold text-blue-900">{liftingPointsQty}</span>
                    </div>
                    <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                        <span className="text-xs text-gray-600 block">DAF</span>
                        <span className="text-lg font-semibold text-blue-900">{formatNumber(daf)}</span>
                    </div>
                    <div className="bg-green-50 rounded-lg p-3 border border-green-200">
                        <span className="text-xs text-gray-600 block">SHL (Te)</span>
                        <span className="text-lg font-semibold text-green-900">{formatNumber(shl, 2)}</span>
                    </div>
                    <div className="bg-green-50 rounded-lg p-3 border border-green-200">
                        <span className="text-xs text-gray-600 block">SSL (Te)</span>
                        <span className="text-lg font-semibold text-green-900">{formatNumber(ssl, 2)}</span>
                    </div>
                    <div className="bg-orange-50 rounded-lg p-3 border border-orange-200">
                        <span className="text-xs text-gray-600 block">DHL (Te)</span>
                        <span className="text-lg font-semibold text-orange-900">{formatNumber(dhl, 2)}</span>
                    </div>
                    <div className="bg-orange-50 rounded-lg p-3 border border-orange-200">
                        <span className="text-xs text-gray-600 block">DSL (Te)</span>
                        <span className="text-lg font-semibold text-orange-900">{formatNumber(dsl, 2)}</span>
                    </div>
                </div>
            </div>

            {/* Rigging Design Section */}
            <div className="bg-white rounded-lg shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <svg className="w-5 h-5 mr-2 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                    </svg>
                    Rigging Design Components
                </h3>

                {/* Scenario 1: Minimum and/or Conservative (user_specified is null) */}
                {hasMinimumOrConservative && !hasUserSpecified && (
                    <div className="space-y-6">
                        {optimal_combinations.minimum && (
                            <div className="border-l-4 border-blue-500 pl-4">
                                <div className="grid grid-cols-1 lg:grid-cols-[1fr,300px] gap-6 items-start">
                                    <CombinationTable
                                        combination={optimal_combinations.minimum}
                                        title="Minimum Combination"
                                        combinationKey="minimum"
                                        isSelectedForReport={selectedKey === 'minimum'}
                                        onSelectForReport={handleSelectForReport}
                                    />
                                    <div className="flex flex-col space-y-2 lg:mt-8">
                                        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                                            Arrangement Stack
                                        </span>
                                        <DesignVisualizer3D
                                            items={optimal_combinations.minimum.items || []}
                                            height={320}
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {optimal_combinations.conservative && (
                            <div className="border-l-4 border-green-500 pl-4">
                                <div className="grid grid-cols-1 lg:grid-cols-[1fr,300px] gap-6 items-start">
                                    <CombinationTable
                                        combination={optimal_combinations.conservative}
                                        title="Conservative Combination"
                                        combinationKey="conservative"
                                        isSelectedForReport={selectedKey === 'conservative'}
                                        onSelectForReport={handleSelectForReport}
                                    />
                                    <div className="flex flex-col space-y-2 lg:mt-8">
                                        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                                            Arrangement Stack
                                        </span>
                                        <DesignVisualizer3D
                                            items={optimal_combinations.conservative.items || []}
                                            height={320}
                                        />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Scenario 2: User Specified (minimum and conservative are null) */}
                {hasUserSpecified && !hasMinimumOrConservative && (
                    <div className="border-l-4 border-purple-500 pl-4">
                        <div className="grid grid-cols-1 lg:grid-cols-[1fr,300px] gap-6 items-start">
                            <CombinationTable
                                combination={hasUserSpecified}
                                title="User Specified Combination"
                                combinationKey="user_specified"
                                isSelectedForReport={selectedKey === 'user_specified'}
                                onSelectForReport={handleSelectForReport}
                            />
                            <div className="flex flex-col space-y-2 lg:mt-8">
                                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                                    Arrangement Stack
                                </span>
                                <DesignVisualizer3D
                                    items={hasUserSpecified.items || []}
                                    height={320}
                                />
                            </div>
                        </div>
                    </div>
                )}

                {/* Edge case: No combinations available */}
                {!hasMinimumOrConservative && !hasUserSpecified && (
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                        <p className="text-gray-600">No optimal combinations found.</p>
                    </div>
                )}
            </div>
        </div>
    )
}

import { useState } from 'react'
import { LiftingAnalysis, LiftingPointsQuantity } from '@/types'
import { ANALYSIS_DISPLAY_LABELS, formatWeightInTe } from '@/lib/analysisDisplay'
import { ResultsVisualizer } from '@/components/visualizer/ResultsVisualizer'

interface AnalysisResultsDisplayProps {
    analysis: LiftingAnalysis
}

// Helper to format numbers consistently
const formatNumber = (value: number | undefined, decimals = 2): string => {
    if (value === undefined || value === null) return '-'
    return value.toFixed(decimals)
}

// Helper to get range array based on lifting points
const getRange = (qty: LiftingPointsQuantity): number[] => {
    return Array.from({ length: qty }, (_, i) => i)
}

export function AnalysisResultsDisplay({ analysis }: AnalysisResultsDisplayProps) {
    const [bulwarkHeight, setBulwarkHeight] = useState<number | undefined>(undefined)
    if (!analysis.results) {
        return (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-yellow-800">No calculation results available for this analysis.</p>
            </div>
        )
    }

    const { configuration, results, lifting_points_qty } = analysis
    const { factors, static_results, dynamic_results} = results

    // Determine if any heights are > 0 (to show heights section)
    const heights = [configuration.h1, configuration.h2, configuration.h3, configuration.h4]
        .slice(0, lifting_points_qty)
        .filter((h): h is number => h !== undefined)
    const showHeights = heights.some(h => h > 0)

    return (
        <div className="space-y-6">
            {/* Analysis Information Summary */}
            <div className="bg-white rounded-lg shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Analysis Information
                </h3>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-gray-50 rounded-lg p-3">
                        <span className="text-xs text-gray-500 block">Analysis Name</span>
                        <span className="text-lg font-semibold text-gray-900">{analysis.name}</span>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                        <span className="text-xs text-gray-500 block">{ANALYSIS_DISPLAY_LABELS.dryWeight}</span>
                        <span className="text-lg font-semibold text-gray-900">{formatWeightInTe(analysis.maximum_gross_weight)} Te</span>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                        <span className="text-xs text-gray-500 block">{ANALYSIS_DISPLAY_LABELS.scenario}</span>
                        <span className="text-lg font-semibold text-gray-900 capitalize">{analysis.location}</span>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                        <span className="text-xs text-gray-500 block">Lifting Points</span>
                        <span className="text-lg font-semibold text-gray-900">{lifting_points_qty}</span>
                    </div>
                </div>
            </div>

            {/* Geometry Configuration */}
            <div className="bg-white rounded-lg shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                    </svg>
                    Geometry Configuration
                </h3>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    {/* Always show h_max */}
                    <div className="bg-gray-50 rounded-lg p-3">
                        <span className="text-xs text-gray-500 block">Crane Height</span>
                        <span className="text-lg font-semibold text-gray-900">{formatNumber(configuration.h_max)} m</span>
                    </div>

                    {/* Quadrant (only for 3-point) */}
                    {lifting_points_qty === 3 && configuration.quadrant && (
                        <div className="bg-gray-50 rounded-lg p-3">
                            <span className="text-xs text-gray-500 block">Quadrant</span>
                            <span className="text-lg font-semibold text-gray-900 capitalize">{configuration.quadrant}</span>
                        </div>
                    )}
                </div>

                {/* Lengths and Widths per lifting point */}
                {lifting_points_qty >= 2 && (
                    <div>
                        <h4 className="text-sm font-medium text-gray-700 mb-3">Lifting Points Dimensions</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            {getRange(lifting_points_qty).map((i) => {
                                const pointNum = i + 1
                                const L = configuration[`L${pointNum}` as keyof typeof configuration] as number | undefined
                                const B = configuration[`B${pointNum}` as keyof typeof configuration] as number | undefined
                                const h = configuration[`h${pointNum}` as keyof typeof configuration] as number | undefined

                                return (
                                    <div key={pointNum} className="border border-gray-200 rounded-lg p-3">
                                        <h5 className="text-sm font-semibold text-blue-600 mb-2">Point {pointNum}</h5>
                                        <div className="space-y-1 text-sm">
                                            {L !== undefined && (
                                                <div className="flex justify-between">
                                                    <span className="text-gray-500">L{pointNum}:</span>
                                                    <span className="font-medium">{formatNumber(L)} m</span>
                                                </div>
                                            )}
                                            {lifting_points_qty >= 3 && B !== undefined && (
                                                <div className="flex justify-between">
                                                    <span className="text-gray-500">B{pointNum}:</span>
                                                    <span className="font-medium">{formatNumber(B)} m</span>
                                                </div>
                                            )}
                                            {showHeights && h !== undefined && (
                                                <div className="flex justify-between">
                                                    <span className="text-gray-500">h{pointNum}:</span>
                                                    <span className="font-medium">{formatNumber(h)} m</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )}
            </div>

            {/* Analysis Factors */}
            <div className="bg-white rounded-lg shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                    Analysis Factors (DNV-ST-N001)
                </h3>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div className="bg-gray-50 rounded-lg p-3">
                        <span className="text-xs text-gray-500 block">Weight Factor</span>
                        <span className="text-lg font-semibold text-gray-900">{formatNumber(factors.weight_factor)}</span>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                        <span className="text-xs text-gray-500 block">Rigging Weight Factor</span>
                        <span className="text-lg font-semibold text-gray-900">{formatNumber(factors.rigging_weight_factor)}</span>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                        <span className="text-xs text-gray-500 block">COG Factor</span>
                        <span className="text-lg font-semibold text-gray-900">{formatNumber(factors.cog_factor)}</span>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                        <span className="text-xs text-gray-500 block">Yaw Factor</span>
                        <span className="text-lg font-semibold text-gray-900">{formatNumber(factors.yaw_factor)}</span>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                        <span className="text-xs text-gray-500 block">Skew Load Factor</span>
                        <span className="text-lg font-semibold text-gray-900">{formatNumber(factors.skew_load_factor)}</span>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                        <span className="text-xs text-gray-500 block">Dynamic Amplification Factor</span>
                        <span className="text-lg font-semibold text-gray-900">{formatNumber(factors.dynamic_amplification_factor)}</span>
                    </div>
                </div>
            </div>

            {/* 3D Load Distribution Model */}
            <div className="bg-white rounded-lg shadow-sm p-6">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                        <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                        </svg>
                        3D Load Distribution Model
                    </h3>
                    <label className="flex items-center gap-2 text-sm text-gray-500">
                        Bulwark (m)
                        <input
                            type="number"
                            min="0"
                            step="0.1"
                            placeholder="—"
                            value={bulwarkHeight ?? ''}
                            onChange={e => setBulwarkHeight(e.target.value === '' ? undefined : Number(e.target.value))}
                            className="w-20 rounded border border-gray-300 px-2 py-0.5 font-mono text-xs text-gray-700 focus:border-blue-400 focus:outline-none"
                        />
                    </label>
                </div>
                <ResultsVisualizer analysis={analysis} height={360} bulwark_height={bulwarkHeight} />
            </div>

            {/* Static Results */}
            <div className="bg-white rounded-lg shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <svg className="w-5 h-5 mr-2 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
                    </svg>
                    Static Results
                </h3>

                <div className="mb-4">
                    <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                        <span className="text-sm text-gray-600 block">Static Hook Load</span>
                        <span className="text-2xl font-bold text-green-700">{formatWeightInTe(static_results.hook_load)} Te</span>
                    </div>
                </div>

                <h4 className="text-sm font-medium text-gray-700 mb-3">Static Sling Loads per Lifting Point</h4>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Lifting Point</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Static Sling Load (Te)</th>
                        </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                        {getRange(lifting_points_qty).map((i) => (
                            <tr key={i} className="hover:bg-gray-50">
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">Lifting Point {i + 1}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{formatWeightInTe(static_results.static_sling_loads[i])}</td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Dynamic Results */}
            <div className="bg-white rounded-lg shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <svg className="w-5 h-5 mr-2 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    Dynamic Results
                </h3>

                <div className="mb-4">
                    <div className="bg-orange-50 rounded-lg p-4 border border-orange-200">
                        <span className="text-sm text-gray-600 block">Dynamic Hook Load</span>
                        <span className="text-2xl font-bold text-orange-700">{formatWeightInTe(dynamic_results.hook_load)} Te</span>
                    </div>
                </div>

                <h4 className="text-sm font-medium text-gray-700 mb-3">Dynamic Sling Loads per Lifting Point</h4>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Lifting Point</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Dynamic Sling Load (Te)</th>
                        </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                        {getRange(lifting_points_qty).map((i) => (
                            <tr key={i} className="hover:bg-gray-50">
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">Lifting Point {i + 1}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{formatWeightInTe(dynamic_results.dynamic_sling_loads[i])}</td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}

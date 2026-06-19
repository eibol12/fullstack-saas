import {
    FieldErrors,
    useFieldArray,
    useForm,
    UseFormRegister,
    UseFormSetValue,
    UseFormWatch,
    useWatch
} from "react-hook-form"
import {useEffect, useRef, useState} from "react"
import {
    ComponentFieldOptions,
    ComponentOptions,
    DesignFormData,
    LiftingPointsQuantity,
    ModelWithManufacturer
} from "@/types"
import {useComponentOptions} from "@/features/design/hooks/useComponentOptions"
import {getUserPreferenceArrangementValidationMessage} from "@/features/design/utils/validateUserPreferenceArrangement"
import { DesignVisualizer3D } from "@/components/visualizer/DesignVisualizer3D"
import { ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"


interface DesignFormProps {
    onSubmit: (data: DesignFormData) => void
    /**
     * Optional — when omitted the form hides its Cancel button (used
     * inline in `ProjectWorkspacePage` where the parent owns the
     * cancel/edit lifecycle).
     */
    onCancel?: () => void
    submitLabel?: string
    liftingPointsQty?: LiftingPointsQuantity | null
    /**
     * Prefill values when editing an existing design. Omit for create
     * mode so the form starts blank.
     */
    initialData?: Partial<DesignFormData>
}

interface SearchableSelectProps {
  value: string | undefined
  onChange: (value: string) => void
  options: { value: string; label: string }[]
  placeholder?: string
  className?: string
}

function SearchableSelect({ value, onChange, options, placeholder = 'Any', className }: SearchableSelectProps) {
  const [query, setQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const filtered = query.trim()
    ? options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase()))
    : options

  const displayLabel = value ? (options.find((o) => o.value === value)?.label ?? value) : ''

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <div className="relative">
        <input
          type="text"
          value={isOpen ? query : displayLabel}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => { setIsOpen(true); setQuery('') }}
          placeholder={placeholder}
          className="w-full rounded-md border border-gray-300 py-1.5 pl-2.5 pr-7 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
      </div>

      {isOpen && (
        <div className="absolute z-20 mt-1 max-h-52 w-full overflow-y-auto rounded-md border border-gray-200 bg-white shadow-lg">
          <button
            type="button"
            className="w-full px-3 py-2 text-left text-sm text-gray-400 hover:bg-gray-50"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => { onChange(''); setIsOpen(false); setQuery('') }}
          >
            Any
          </button>
          {filtered.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={cn(
                'w-full px-3 py-2 text-left text-sm hover:bg-gray-50',
                opt.value === value ? 'bg-blue-50 font-medium text-blue-700' : 'text-gray-700',
              )}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => { onChange(opt.value); setIsOpen(false); setQuery('') }}
            >
              {opt.label}
            </button>
          ))}
          {filtered.length === 0 && (
            <div className="px-3 py-2 text-sm text-gray-400">No matches</div>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * Helper to filter models by selected manufacturer
 * If manufacturer is selected, returns only models from that manufacturer
 * If no manufacturer selected, returns all models (with manufacturer hints)
 */
function getFilteredModels(
    options: ComponentFieldOptions | null,
    selectedManufacturer?: string
): ModelWithManufacturer[] {
    if (!options || !options.models || options.models.length === 0) return []

    // Handle legacy string[] format (shouldn't happen with new backend, but defensive)
    if (typeof options.models[0] === 'string') {
        return options.models.map(m => ({ model: m as string, manufacturer: '' }))
    }

    const modelsWithMfr = options.models as ModelWithManufacturer[]

    if (selectedManufacturer) {
        // Filter to only this manufacturer's models
        return modelsWithMfr.filter(m => m.manufacturer === selectedManufacturer)
    }

    // No manufacturer selected: show all models
    return modelsWithMfr
}

export function DesignForm({
    onSubmit,
    onCancel,
    submitLabel = "Submit",
    liftingPointsQty,
    initialData
} : DesignFormProps) {
    const {data:componentOptions, isLoading:isLoadingOptions} = useComponentOptions()
    const [showArrangementError, setShowArrangementError] = useState(false)

    const {register, control, handleSubmit, watch, setValue, formState: {errors, isSubmitting}} = useForm<DesignFormData>({
        defaultValues: {
            name: initialData?.name ?? "",
            set_active: initialData?.set_active ?? false,
            user_preferences: initialData?.user_preferences ?? []
        }
    })

    const {fields, append, remove} = useFieldArray({
        control,
        name: "user_preferences"
    })

    const watchedUserPreferences = useWatch({
        control,
        name: 'user_preferences'
    })

    const arrangementError = showArrangementError
        ? getUserPreferenceArrangementValidationMessage(watchedUserPreferences, liftingPointsQty)
        : null

    const handleFormSubmit = (data: DesignFormData) => {
        const nextArrangementError = getUserPreferenceArrangementValidationMessage(
            data.user_preferences,
            liftingPointsQty
        )

        if (nextArrangementError) {
            setShowArrangementError(true)
            return
        }

        setShowArrangementError(false)

        //If no preferences, send empty array
        const formData = {
            ...data,
            user_preferences: data.user_preferences && data.user_preferences.length > 0 ? data.user_preferences : []
        }
        onSubmit(formData)
    }

    const addPreferenceRow = () => {
        append({
            component_type: undefined,
            capacity: undefined,
            model: undefined,
            manufacturer: undefined,
            eye_type: undefined,
            termination: undefined,
            configuration: undefined
        })
    }

    if (isLoadingOptions) {
        return (
            <div className="flex items-center justify-center py-8">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <p className="ml-3 text-gray-600">Loading component options...</p>
            </div>
        )
    }

    if (!componentOptions) {
        return (
            <div className="flex items-center justify-center py-8">
                <p className="text-red-600">Error loading component options</p>
            </div>
        )
    }

    return (
        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-[1fr,minmax(280px,420px)] gap-6">
                {/* Form fields column */}
                <div className="space-y-6">
                    {/* Basic Fields*/}
                    <div className="space-y-4">
                        <div>
                            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                                Design Name *
                            </label>
                            <input
                                {...register('name', { required: "Design name is required" })}
                                id = "name"
                                type = "text"
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="Enter design name"
                            />
                            {errors.name && (
                                <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
                            )}
                        </div>

                        <div className="flex items-center">
                            <input
                                {...register('set_active')}
                                id="set_active"
                                type="checkbox"
                                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                            />
                            <label htmlFor="set_active" className="ml-2 block text-sm text-gray-700">
                                Set as active design
                            </label>
                        </div>
                    </div>

                    {/*User Preferences Section*/}
                    <div className="border-t pt-6">
                        <div className="flex justify-between items-center mb-4">
                            <div>
                                <h3 className="text-lg font-medium text-gray-900">User Preferences (Optional)</h3>
                                <p className="mt-1 text-sm text-gray-500">
                                    Rows define the custom arrangement order from hook to load.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={addPreferenceRow}
                                className="px-3 py-1 text-sm bg-green-600 text-white rounded-md hover:bg-green-700"
                            >
                                + Add Row
                            </button>
                        </div>

                        {arrangementError && (
                            <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3">
                                <p className="text-sm text-red-700">{arrangementError}</p>
                            </div>
                        )}

                        {fields.length === 0 ? (
                            <div className="text-center py-8 bg-gray-50 rounded-lg border border-gray-200">
                                <p className="text-gray-600 text-sm">No preferences added. Click "Add Row" to specify component preferences.</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {fields.map((field, index) => (
                                    <PreferenceRow
                                        key={field.id}
                                        index={index}
                                        register={register}
                                        watch={watch}
                                        setValue={setValue}
                                        errors={errors}
                                        componentOptions={componentOptions}
                                        onRemove={() => remove(index)}
                                    />
                                ))}
                            </div>
                        )}
                    </div>

                    {/*Form Actions*/}
                    <div className="flex justify-end space-x-3 pt-4 border-t">
                        {onCancel && (
                            <button
                                type="button"
                                onClick={onCancel}
                                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
                                disabled={isSubmitting}
                            >
                                Cancel
                            </button>
                        )}
                        <button
                            type="submit"
                            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-300"
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? 'Processing...' : submitLabel}
                        </button>
                    </div>
                </div>

                {/* 3D Visualizer column */}
                <aside className="lg:sticky lg:top-20 self-start space-y-2">
                    <div className="flex items-baseline justify-between">
                        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                            Live arrangement preview
                        </span>
                    </div>
                    <DesignVisualizer3D
                        items={watchedUserPreferences || []}
                        height={400}
                    />
                    <p className="text-[11px] leading-relaxed text-slate-500">
                        Live stack preview of selected components in sequence from hook to load. Drag to orbit, scroll to zoom.
                    </p>
                </aside>
            </div>
        </form>
    )
}

/**
 * Individual preference row component with manufacturer/model dependency logic
 */
interface PreferenceRowProps {
    index: number
    register: UseFormRegister<DesignFormData>
    watch: UseFormWatch<DesignFormData>
    setValue: UseFormSetValue<DesignFormData>
    errors: FieldErrors<DesignFormData>
    componentOptions: ComponentOptions
    onRemove: () => void
}

function PreferenceRow({
    index,
    register,
    watch,
    setValue,
    errors,
    componentOptions,
    onRemove
}: PreferenceRowProps) {
    const selectedComponentType = watch(`user_preferences.${index}.component_type`)
    const selectedManufacturer = watch(`user_preferences.${index}.manufacturer`)
    const selectedModel = watch(`user_preferences.${index}.model`)
    const options = selectedComponentType ? componentOptions[selectedComponentType] : null

    // Auto-fill manufacturer when model is selected (if manufacturer is empty)
    useEffect(() => {
        if (!selectedModel || selectedManufacturer || !options) return

        // Skip for WireRope (no manufacturer/model)
        if (selectedComponentType === 'WireRope') return

        const modelsWithMfr = options.models as ModelWithManufacturer[]
        const modelData = modelsWithMfr.find((m: ModelWithManufacturer) => m.model === selectedModel)

        if (modelData?.manufacturer) {
            setValue(`user_preferences.${index}.manufacturer`, modelData.manufacturer)
        }
    }, [selectedModel, selectedManufacturer, options, selectedComponentType, index, setValue])

    // Clear incompatible model when manufacturer changes
    useEffect(() => {
        if (!selectedManufacturer || !selectedModel || !options) return

        // Skip for WireRope
        if (selectedComponentType === 'WireRope') return

        const modelsWithMfr = options.models as ModelWithManufacturer[]
        const modelData = modelsWithMfr.find((m: ModelWithManufacturer) => m.model === selectedModel)

        // If selected model doesn't belong to selected manufacturer, clear it
        if (modelData && modelData.manufacturer !== selectedManufacturer) {
            setValue(`user_preferences.${index}.model`, '')
        }
    }, [selectedManufacturer, selectedModel, options, selectedComponentType, index, setValue])

    const filteredModels = getFilteredModels(options, selectedManufacturer)

    return (
        <div className="p-4 border border-gray-300 rounded-lg bg-gray-50">
            <div className="flex justify-between items-start mb-3">
                <h4 className="text-sm font-medium text-gray-700">Position {index + 1}</h4>
                <button
                    type="button"
                    onClick={onRemove}
                    className="text-red-600 hover:text-red-800 text-sm"
                >
                    Remove
                </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                        {/*Component Type - REQUIRED*/}
                                        <div>
                                            <label className="block text-xs font-medium text-gray-700 mb-1">
                                                Component Type *
                                            </label>
                                            <select
                                                {...register(`user_preferences.${index}.component_type`, {
                                                    required: 'Component type is required'
                                                })}
                                                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            >
                                                <option value="">Select...</option>
                                                <option value="Shackle">Shackle</option>
                                                <option value="Masterlink">Masterlink</option>
                                                <option value="MasterlinkAssembly">Masterlink Assembly</option>
                                                <option value="WireRope">Wire Rope</option>
                                            </select>
                                            {errors.user_preferences?.[index]?.component_type && (
                                                <p className="mt-1 text-xs text-red-600">
                                                    {errors.user_preferences[index]?.component_type?.message}
                                                </p>
                                            )}
                                        </div>
                                        {/*Capacity - Optional*/}
                                        {options && options.capacities.length >0 && (
                                            <div>
                                                <label className="block text-xs font-medium text-gray-700 mb-1">
                                                    Capacity
                                                </label>
                                                <select
                                                    {...register(`user_preferences.${index}.capacity`)}
                                                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                >
                                                    <option value="">Any</option>
                                                    {options.capacities.map((cap: number) => (
                                                        <option key={cap} value={cap}>
                                                            {cap} {selectedComponentType === 'WireRope' ? 'Te (MBL)' : 'Te (WLL)'}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                        )}

                                        {/*Manufacturer - Optional (not for WireRope)*/}
                                        {options && options.manufacturers && options.manufacturers.length > 0 && (
                                            <div>
                                                <label className="block text-xs font-medium text-gray-700 mb-1">
                                                    Manufacturer
                                                </label>
                                                <SearchableSelect
                                                    value={selectedManufacturer || ''}
                                                    onChange={(v) =>
                                                        setValue(`user_preferences.${index}.manufacturer`, v || undefined)
                                                    }
                                                    options={options.manufacturers.map((m: string) => ({ value: m, label: m }))}
                                                />
                                            </div>
                                        )}

                                        {/* Model - Optional (not for WireRope) */}
                                        {options && options.models && options.models.length > 0 && (
                                            <div>
                                                <label className="block text-xs font-medium text-gray-700 mb-1">
                                                    Model
                                                </label>
                                                <SearchableSelect
                                                    value={selectedModel || ''}
                                                    onChange={(v) =>
                                                        setValue(`user_preferences.${index}.model`, v || undefined)
                                                    }
                                                    options={filteredModels.map((item) => ({
                                                        value: item.model,
                                                        label:
                                                            !selectedManufacturer && item.manufacturer
                                                                ? `${item.model} (${item.manufacturer})`
                                                                : item.model,
                                                    }))}
                                                />
                                            </div>
                                        )}

                                        {/* Wire Rope Specific Fields */}
                                        {selectedComponentType === 'WireRope' && options && (
                                            <>
                                                {options.eye_types && options.eye_types.length > 0 && (
                                                    <div>
                                                        <label className="block text-xs font-medium text-gray-700 mb-1">
                                                            Eye Type
                                                        </label>
                                                        <select
                                                            {...register(`user_preferences.${index}.eye_type`)}
                                                            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                        >
                                                            <option value="">Any</option>
                                                            {options.eye_types.map((type: string) => (
                                                                <option key={type} value={type}>
                                                                    {type.charAt(0).toUpperCase() + type.slice(1)}
                                                                </option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                )}

                                                {options.terminations && options.terminations.length > 0 && (
                                                    <div>
                                                        <label className="block text-xs font-medium text-gray-700 mb-1">
                                                            Termination
                                                        </label>
                                                        <select
                                                            {...register(`user_preferences.${index}.termination`)}
                                                            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                        >
                                                            <option value="">Any</option>
                                                            {options.terminations.map((term: string) => (
                                                                <option key={term} value={term}>
                                                                    {term.charAt(0).toUpperCase() + term.slice(1)}
                                                                </option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                )}

                                                {options.configurations && options.configurations.length > 0 && (
                                                    <div>
                                                        <label className="block text-xs font-medium text-gray-700 mb-1">
                                                            Configuration
                                                        </label>
                                                        <select
                                                            {...register(`user_preferences.${index}.configuration`)}
                                                            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                        >
                                                            <option value="">Any</option>
                                                            {options.configurations.map((config: string) => (
                                                                <option key={config} value={config}>
                                                                    {config.charAt(0).toUpperCase() + config.slice(1)}
                                                                </option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                )}
                                            </>
                                          )}
                                    </div>
                                </div>
    )
}

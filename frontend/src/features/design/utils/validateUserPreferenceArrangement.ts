import { sanitizeUserPreferences } from '@/lib/sanitize'
import {
  LiftingPointsQuantity,
  RiggingComponentType,
  UserPreference,
} from '@/types'

const MIN_COMPONENTS = 3
const MAX_COMPONENTS = 10

const VALID_COMPONENT_TYPES: RiggingComponentType[] = [
  'Masterlink',
  'MasterlinkAssembly',
  'WireRope',
  'Shackle',
]

const COMPONENT_LABELS: Record<RiggingComponentType, string> = {
  Masterlink: 'Masterlink',
  MasterlinkAssembly: 'Masterlink Assembly',
  WireRope: 'Wire Rope',
  Shackle: 'Shackle',
}

function isSupportedLiftingPointsQty(
  liftingPointsQty?: number | null
): liftingPointsQty is LiftingPointsQuantity {
  return liftingPointsQty === 1 || liftingPointsQty === 2 || liftingPointsQty === 3 || liftingPointsQty === 4
}

function getExpectedFirstComponent(liftingPointsQty: LiftingPointsQuantity): RiggingComponentType {
  return liftingPointsQty === 1 || liftingPointsQty === 2
    ? 'Masterlink'
    : 'MasterlinkAssembly'
}

function formatComponentList(componentTypes: RiggingComponentType[]): string {
  return componentTypes.map((componentType) => COMPONENT_LABELS[componentType]).join(', ')
}

export function getUserPreferenceArrangementValidationMessage(
  preferences: UserPreference[] | undefined | null,
  liftingPointsQty?: number | null
): string | null {
  const sanitizedPreferences = sanitizeUserPreferences(preferences)

  if (!sanitizedPreferences || sanitizedPreferences.length === 0) {
    return null
  }

  const arrangement = sanitizedPreferences.map((preference) => preference.component_type)

  if (arrangement.some((componentType) => !componentType)) {
    return 'Each custom arrangement row must include a component type.'
  }

  const componentTypes = arrangement as RiggingComponentType[]
  const componentCount = componentTypes.length

  if (componentCount < MIN_COMPONENTS || componentCount > MAX_COMPONENTS) {
    return `Custom arrangement must contain between ${MIN_COMPONENTS} and ${MAX_COMPONENTS} components. Found ${componentCount}.`
  }

  const invalidComponentType = componentTypes.find(
    (componentType) => !VALID_COMPONENT_TYPES.includes(componentType)
  )

  if (invalidComponentType) {
    return `Custom arrangement contains an unsupported component type: "${invalidComponentType}".`
  }

  if (!isSupportedLiftingPointsQty(liftingPointsQty)) {
    return null
  }

  const expectedFirstComponent = getExpectedFirstComponent(liftingPointsQty)
  const expectedFirstLabel = COMPONENT_LABELS[expectedFirstComponent]

  if (componentTypes[0] !== expectedFirstComponent) {
    return (
      'Custom arrangement is invalid. ' +
      `For ${liftingPointsQty} lifting point${liftingPointsQty === 1 ? '' : 's'}, ` +
      `the first component must be ${expectedFirstLabel}.`
    )
  }

  if (componentTypes[componentTypes.length - 1] === 'WireRope') {
    return 'Custom arrangement is invalid. Wire Rope cannot be the last component.'
  }

  if (componentTypes[componentTypes.length - 1] !== 'Shackle') {
    return 'Custom arrangement is invalid. The last component must be Shackle.'
  }

  const requiredComponents = new Set<RiggingComponentType>([
    expectedFirstComponent,
    'WireRope',
    'Shackle',
  ])
  const selectedComponents = new Set(componentTypes)
  const missingComponents = Array.from(requiredComponents).filter(
    (componentType) => !selectedComponents.has(componentType)
  )

  if (missingComponents.length > 0) {
    return (
      'Custom arrangement is incomplete. Missing required component' +
      `${missingComponents.length === 1 ? '' : 's'}: ${formatComponentList(missingComponents)}.`
    )
  }

  return null
}

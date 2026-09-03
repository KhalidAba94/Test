import type { CoupleState, MemoryRow, RoundState } from './types'

type JsonRecord = Record<string, unknown>

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isString = (value: unknown): value is string => typeof value === 'string'
const isNullableString = (value: unknown): value is string | null => value === null || isString(value)
const isNullableBoolean = (value: unknown): value is boolean | null => value === null || typeof value === 'boolean'

const contractError = (name: string) => new Error(`Unexpected response from ${name}. Please refresh and try again.`)

export function parseCoupleState(value: unknown): CoupleState | null {
  if (value === null) return null
  if (
    !isRecord(value) ||
    !isString(value.couple_id) ||
    !isString(value.invite_code) ||
    !isString(value.status) ||
    !isString(value.my_name) ||
    !isNullableString(value.partner_name) ||
    typeof value.partner_joined !== 'boolean'
  ) throw contractError('get_my_couple')

  return value as CoupleState
}

export function parseRoundState(value: unknown, source = 'round RPC'): RoundState {
  if (!isRecord(value) || !isRecord(value.prompt)) throw contractError(source)
  const prompt = value.prompt

  if (
    !isString(value.round_id) ||
    !isString(value.round_date) ||
    !isString(value.status) ||
    !isNullableString(value.my_answer) ||
    !isNullableString(value.partner_answer) ||
    typeof value.partner_answered !== 'boolean' ||
    !isString(value.my_name) ||
    !isNullableString(value.partner_name) ||
    !isNullableBoolean(value.match) ||
    !isString(prompt.id) ||
    !isString(prompt.category) ||
    !isString(prompt.mode) ||
    !isString(prompt.prompt_text) ||
    !isString(prompt.answer_type) ||
    !isString(prompt.intensity)
  ) throw contractError(source)

  return value as RoundState
}

export function parseCreateRoomResult(value: unknown) {
  if (!isRecord(value) || !isString(value.couple_id) || !isString(value.invite_code)) {
    throw contractError('create_couple_room')
  }
  return { couple_id: value.couple_id, invite_code: value.invite_code }
}

export function parseJoinRoomResult(value: unknown) {
  if (!isRecord(value)) throw contractError('join_couple_room')
  if (value.ok === false) {
    if (!isString(value.error)) throw contractError('join_couple_room')
    return { ok: false as const, error: value.error }
  }
  if (value.ok !== true || !isString(value.couple_id) || !isString(value.invite_code)) {
    throw contractError('join_couple_room')
  }
  return { ok: true as const, couple_id: value.couple_id, invite_code: value.invite_code }
}

export function parseMemoryRows(value: unknown): MemoryRow[] {
  if (!Array.isArray(value)) throw new Error('Unexpected response while loading memories. Please refresh and try again.')

  return value.map((row) => {
    if (
      !isRecord(row) ||
      !isString(row.id) ||
      !isString(row.couple_id) ||
      !isString(row.source_round_id) ||
      !isString(row.title) ||
      !isString(row.body) ||
      !Array.isArray(row.tags) ||
      !row.tags.every(isString) ||
      !isString(row.created_at)
    ) throw new Error('Unexpected response while loading memories. Please refresh and try again.')

    return row as MemoryRow
  })
}

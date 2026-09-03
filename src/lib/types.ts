export type CoupleState = {
  couple_id: string
  invite_code: string
  status: 'waiting' | 'active' | 'archived' | string
  my_name: string
  partner_name: string | null
  partner_joined: boolean
}

export type Prompt = {
  id: string
  category: string
  mode: string
  prompt_text: string
  answer_type: string
  options_json: unknown
  intensity: string
}

export type RoundState = {
  round_id: string
  round_date: string
  status: 'open' | 'revealed' | string
  prompt: Prompt
  my_answer: string | null
  partner_answer: string | null
  partner_answered: boolean
  my_name: string
  partner_name: string | null
  match: boolean | null
}

export type MemoryRow = {
  id: string
  couple_id: string
  source_round_id: string
  title: string
  body: string
  tags: string[]
  created_at: string
}

export type MemoryBody = {
  first_name?: string
  first_answer?: string
  second_name?: string
  second_answer?: string
}

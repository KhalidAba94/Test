import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft,
  Check,
  Clipboard,
  Heart,
  LoaderCircle,
  LockKeyhole,
  MessageCircleHeart,
  RefreshCw,
  Share2,
  Sparkles,
  Users,
  Vault,
} from 'lucide-react'
import {
  assertVoidRpc,
  parseCoupleState,
  parseCreateRoomResult,
  parseJoinRoomResult,
  parseMemoryRows,
  parseRoundState,
  parseUuidRpc,
} from './lib/contracts'
import { ensureAnonymousSession, getRiyadhDate, supabase } from './lib/supabase'
import type { CoupleState, MemoryBody, MemoryRow, RoundState } from './lib/types'

type Screen = 'loading' | 'landing' | 'create' | 'join' | 'waiting_partner' | 'today' | 'memories'

const friendlyError = (error: unknown) => {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'object' && error !== null && 'message' in error
        ? String((error as { message?: unknown }).message ?? 'Something went wrong')
        : String(error)

  return message
    .replace('Anonymous sign-ins are disabled', 'Private sign-in is temporarily unavailable. Please try again shortly.')
    .replace('duplicate key value violates unique constraint', 'That action has already been completed.')
    .replace('Failed to fetch', 'Connection lost. Check your internet and try again.')
}

function getJoinCodeFromUrl() {
  const raw = new URLSearchParams(window.location.search).get('join') ?? ''
  return raw.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 6)
}

function clearJoinParam() {
  const url = new URL(window.location.href)
  url.searchParams.delete('join')
  window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`)
}

function App() {
  const [screen, setScreen] = useState<Screen>('loading')
  const [couple, setCouple] = useState<CoupleState | null>(null)
  const [round, setRound] = useState<RoundState | null>(null)
  const [memories, setMemories] = useState<MemoryRow[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const hydrateCouple = useCallback(async () => {
    const { data, error: rpcError } = await supabase.rpc('get_my_couple')
    if (rpcError) throw rpcError
    const next = parseCoupleState(data ?? null)
    setCouple(next)
    return next
  }, [])

  const hydrateRound = useCallback(async (coupleId: string) => {
    const { data, error: rpcError } = await supabase.rpc('get_or_create_daily_round', {
      p_couple_id: coupleId,
      p_round_date: getRiyadhDate(),
    })
    if (rpcError) throw rpcError
    const next = parseRoundState(data, 'get_or_create_daily_round')
    setRound(next)
    return next
  }, [])

  const loadRoundState = useCallback(async (roundId: string) => {
    const { data, error: rpcError } = await supabase.rpc('get_round_state', { p_round_id: roundId })
    if (rpcError) throw rpcError
    const next = parseRoundState(data, 'get_round_state')
    setRound(next)
    return next
  }, [])

  const refreshMemories = useCallback(async (coupleId: string) => {
    const { data, error: queryError } = await supabase
      .from('memories')
      .select('id,couple_id,source_round_id,title,body,tags,created_at')
      .eq('couple_id', coupleId)
      .order('created_at', { ascending: false })
    if (queryError) throw queryError
    const next = parseMemoryRows(data ?? [])
    setMemories(next)
    return next
  }, [])

  const routeFromCouple = useCallback(async (next: CoupleState | null) => {
    if (!next) {
      setRound(null)
      setMemories([])
      setScreen(getJoinCodeFromUrl() ? 'join' : 'landing')
      return
    }
    if (!next.partner_joined || next.status !== 'active') {
      setScreen('waiting_partner')
      return
    }
    await Promise.all([hydrateRound(next.couple_id), refreshMemories(next.couple_id)])
    setScreen('today')
  }, [hydrateRound, refreshMemories])

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        await ensureAnonymousSession()
        if (!mounted) return
        const next = await hydrateCouple()
        if (!mounted) return
        await routeFromCouple(next)
      } catch (e) {
        if (!mounted) return
        setError(friendlyError(e))
        setScreen(getJoinCodeFromUrl() ? 'join' : 'landing')
      }
    })()
    return () => {
      mounted = false
    }
  }, [hydrateCouple, routeFromCouple])

  useEffect(() => {
    if (!error) return
    const timer = window.setTimeout(() => setError(''), 6000)
    return () => window.clearTimeout(timer)
  }, [error])

  useEffect(() => {
    if (screen !== 'waiting_partner' || !couple?.couple_id) return

    const channel = supabase
      .channel(`couple-${couple.couple_id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'couples', filter: `id=eq.${couple.couple_id}` },
        async () => {
          try {
            const next = await hydrateCouple()
            if (next?.partner_joined && next.status === 'active') await routeFromCouple(next)
          } catch (e) {
            setError(friendlyError(e))
          }
        },
      )
      .subscribe()

    const poll = window.setInterval(async () => {
      try {
        const next = await hydrateCouple()
        if (next?.partner_joined && next.status === 'active') await routeFromCouple(next)
      } catch {
        // Keep waiting; transient failures are covered by the next poll.
      }
    }, 5000)

    return () => {
      window.clearInterval(poll)
      supabase.removeChannel(channel)
    }
  }, [couple?.couple_id, hydrateCouple, routeFromCouple, screen])

  useEffect(() => {
    if (screen !== 'today' || !round?.round_id || round.status === 'revealed') return

    const refresh = async () => {
      try {
        await loadRoundState(round.round_id)
      } catch {
        // Polling is fallback behavior; do not interrupt the user for one missed refresh.
      }
    }

    const channel = supabase
      .channel(`round-${round.round_id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'daily_rounds', filter: `id=eq.${round.round_id}` },
        refresh,
      )
      .subscribe()

    const poll = window.setInterval(refresh, 5000)
    return () => {
      window.clearInterval(poll)
      supabase.removeChannel(channel)
    }
  }, [loadRoundState, round?.round_id, round?.status, screen])

  const loadMemories = async () => {
    if (!couple) return
    setBusy(true)
    setError('')
    try {
      await refreshMemories(couple.couple_id)
      setScreen('memories')
    } catch (e) {
      setError(friendlyError(e))
    } finally {
      setBusy(false)
    }
  }

  const goToday = async () => {
    if (!couple) return
    setBusy(true)
    setError('')
    try {
      await Promise.all([hydrateRound(couple.couple_id), refreshMemories(couple.couple_id)])
      setScreen('today')
    } catch (e) {
      setError(friendlyError(e))
    } finally {
      setBusy(false)
    }
  }

  const cancelWaitingRoom = async () => {
    setBusy(true)
    setError('')
    try {
      const { data, error: rpcError } = await supabase.rpc('cancel_waiting_couple_room')
      if (rpcError) throw rpcError
      assertVoidRpc(data, 'cancel_waiting_couple_room')
      setCouple(null)
      setRound(null)
      setMemories([])
      setScreen('landing')
    } catch (e) {
      setError(friendlyError(e))
    } finally {
      setBusy(false)
    }
  }

  const goLandingFromJoin = () => {
    clearJoinParam()
    setError('')
    setScreen('landing')
  }

  const saved = Boolean(round && memories.some((memory) => memory.source_round_id === round.round_id))

  return (
    <div className="app-shell">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />
      <main className="phone-frame">
        {screen === 'loading' && <LoadingScreen />}
        {screen === 'landing' && (
          <Landing
            onCreate={() => { setError(''); setScreen('create') }}
            onJoin={() => { setError(''); setScreen('join') }}
          />
        )}
        {screen === 'create' && (
          <CreateRoom
            onBack={() => setScreen('landing')}
            onCreated={async () => {
              const next = await hydrateCouple()
              await routeFromCouple(next)
            }}
            setBusy={setBusy}
            busy={busy}
            setError={setError}
          />
        )}
        {screen === 'join' && (
          <JoinRoom
            onBack={goLandingFromJoin}
            onJoined={async () => {
              const next = await hydrateCouple()
              await routeFromCouple(next)
            }}
            setBusy={setBusy}
            busy={busy}
            setError={setError}
          />
        )}
        {screen === 'waiting_partner' && couple && (
          <WaitingPartner couple={couple} busy={busy} onCancel={cancelWaitingRoom} />
        )}
        {screen === 'today' && round && couple && (
          <Today
            round={round}
            couple={couple}
            busy={busy}
            saved={saved}
            setBusy={setBusy}
            setError={setError}
            onRefresh={() => loadRoundState(round.round_id)}
            onOpenMemories={loadMemories}
            onMemorySaved={async () => { await refreshMemories(couple.couple_id) }}
          />
        )}
        {screen === 'memories' && couple && (
          <MemoryVault
            couple={couple}
            memories={memories}
            busy={busy}
            onToday={goToday}
            onRefresh={async () => { await refreshMemories(couple.couple_id) }}
          />
        )}

        {error && (
          <div className="toast" role="alert">
            <span>{error}</span>
            <button onClick={() => setError('')} aria-label="Dismiss">×</button>
          </div>
        )}
      </main>
    </div>
  )
}

function LoadingScreen() {
  return (
    <section className="full-center">
      <BrandMark />
      <LoaderCircle className="spin" size={24} />
      <p className="muted">Opening your private space…</p>
    </section>
  )
}

function BrandMark() {
  return (
    <div className="brand-lockup">
      <div className="brand-icon"><Heart size={21} fill="currentColor" /></div>
      <div>
        <div className="brand-name">Two of Us</div>
        <div className="brand-sub">just for the two of you</div>
      </div>
    </div>
  )
}

function Landing({ onCreate, onJoin }: { onCreate: () => void; onJoin: () => void }) {
  return (
    <section className="landing-screen">
      <header><BrandMark /></header>
      <div className="hero-copy">
        <span className="eyebrow"><Sparkles size={14} /> One little moment a day</span>
        <h1>Laugh more.<br /><em>Know each other better.</em></h1>
        <p>A private daily game for couples. Answer separately, reveal together, and keep the moments worth remembering.</p>
      </div>

      <div className="ritual-card">
        <div className="ritual-item"><span>1</span><p><strong>Same question</strong><small>One shared prompt</small></p></div>
        <div className="ritual-line" />
        <div className="ritual-item"><span>2</span><p><strong>Private answers</strong><small>No peeking</small></p></div>
        <div className="ritual-line" />
        <div className="ritual-item"><span>3</span><p><strong>Reveal together</strong><small>That’s the fun part</small></p></div>
      </div>

      <div className="landing-actions">
        <button className="button primary" onClick={onCreate}>Create our space <Heart size={18} /></button>
        <button className="button secondary" onClick={onJoin}>I have an invite code</button>
      </div>
      <div className="privacy-note"><LockKeyhole size={14} /> Private by default. No public profile. No comparison.</div>
    </section>
  )
}

function CreateRoom({
  onBack,
  onCreated,
  busy,
  setBusy,
  setError,
}: {
  onBack: () => void
  onCreated: () => Promise<void>
  busy: boolean
  setBusy: (v: boolean) => void
  setError: (v: string) => void
}) {
  const [name, setName] = useState('')
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!name.trim()) return
    setBusy(true)
    setError('')
    try {
      const { data, error } = await supabase.rpc('create_couple_room', { p_display_name: name.trim() })
      if (error) throw error
      parseCreateRoomResult(data)
      await onCreated()
    } catch (e) {
      setError(friendlyError(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <FormScreen title="Create your space" subtitle="You’ll get a private invite code to send to your partner." onBack={onBack}>
      <form onSubmit={submit} className="form-stack">
        <label>Your first name or nickname
          <input autoFocus maxLength={40} placeholder="e.g. Khalid" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <div className="soft-note"><LockKeyhole size={18} /><span>Your answers stay hidden from your partner until both of you submit.</span></div>
        <button className="button primary" disabled={busy || !name.trim()}>
          {busy ? <LoaderCircle className="spin" size={18} /> : <Heart size={18} />} Create our space
        </button>
      </form>
    </FormScreen>
  )
}

function JoinRoom({
  onBack,
  onJoined,
  busy,
  setBusy,
  setError,
}: {
  onBack: () => void
  onJoined: () => Promise<void>
  busy: boolean
  setBusy: (v: boolean) => void
  setError: (v: string) => void
}) {
  const [name, setName] = useState('')
  const [code, setCode] = useState(getJoinCodeFromUrl())

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!name.trim() || code.length !== 6) return
    setBusy(true)
    setError('')
    try {
      const { data, error } = await supabase.rpc('join_couple_room', {
        p_display_name: name.trim(),
        p_invite_code: code,
      })
      if (error) throw error
      const result = parseJoinRoomResult(data)
      if (!result.ok) throw new Error(result.error)
      clearJoinParam()
      await onJoined()
    } catch (e) {
      setError(friendlyError(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <FormScreen title="Join your person" subtitle="Enter the six-character code they sent you." onBack={onBack}>
      <form onSubmit={submit} className="form-stack">
        <label>Invite code
          <input className="code-input" autoFocus autoCapitalize="characters" maxLength={6} placeholder="A1B2C3" value={code} onChange={(e) => setCode(e.target.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 6))} />
        </label>
        <label>Your first name or nickname
          <input maxLength={40} placeholder="What should your partner see?" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <button className="button primary" disabled={busy || !name.trim() || code.length !== 6}>
          {busy ? <LoaderCircle className="spin" size={18} /> : <Users size={18} />} Join our space
        </button>
      </form>
    </FormScreen>
  )
}

function FormScreen({ title, subtitle, onBack, children }: { title: string; subtitle: string; onBack: () => void; children: React.ReactNode }) {
  return (
    <section className="standard-screen">
      <header className="topbar">
        <button className="icon-button" onClick={onBack} aria-label="Back"><ArrowLeft size={20} /></button>
        <BrandMark />
        <span className="topbar-spacer" />
      </header>
      <div className="form-heading"><h2>{title}</h2><p>{subtitle}</p></div>
      {children}
    </section>
  )
}

function WaitingPartner({ couple, busy, onCancel }: { couple: CoupleState; busy: boolean; onCancel: () => Promise<void> }) {
  const [copied, setCopied] = useState(false)
  const inviteUrl = `${window.location.origin}${window.location.pathname}?join=${couple.invite_code}`

  const copyCode = async () => {
    await navigator.clipboard.writeText(couple.invite_code)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }

  const share = async () => {
    const text = `Join me on Two of Us 💛 Our private code is ${couple.invite_code}`
    if (navigator.share) {
      await navigator.share({ title: 'Two of Us', text, url: inviteUrl })
    } else {
      await navigator.clipboard.writeText(`${text}\n${inviteUrl}`)
      setCopied(true)
    }
  }

  return (
    <section className="waiting-screen full-center">
      <BrandMark />
      <div className="waiting-visual">
        <div className="avatar filled">{couple.my_name?.[0]?.toUpperCase()}</div>
        <div className="dotted-bridge"><span /><Heart size={18} fill="currentColor" /><span /></div>
        <div className="avatar ghost">?</div>
      </div>
      <div className="center-copy">
        <span className="eyebrow">Your space is ready</span>
        <h2>Now bring in your person.</h2>
        <p>Send this code to your partner. This page will update automatically when they join.</p>
      </div>
      <button className="invite-code" onClick={copyCode}>
        <span>{couple.invite_code}</span>
        {copied ? <Check size={19} /> : <Clipboard size={19} />}
      </button>
      <button className="button primary" onClick={share} disabled={busy}><Share2 size={18} /> Share invite</button>
      <div className="waiting-pulse"><span /> Waiting for your partner…</div>
      <button className="text-button" onClick={onCancel} disabled={busy}>Cancel this space</button>
    </section>
  )
}

function Today({
  round,
  couple,
  busy,
  saved,
  setBusy,
  setError,
  onRefresh,
  onOpenMemories,
  onMemorySaved,
}: {
  round: RoundState
  couple: CoupleState
  busy: boolean
  saved: boolean
  setBusy: (v: boolean) => void
  setError: (v: string) => void
  onRefresh: () => Promise<RoundState>
  onOpenMemories: () => Promise<void>
  onMemorySaved: () => Promise<void>
}) {
  const [answer, setAnswer] = useState(round.my_answer ?? '')
  const options = useMemo(() => Array.isArray(round.prompt.options_json) ? round.prompt.options_json.map(String) : [], [round.prompt.options_json])

  useEffect(() => {
    setAnswer(round.my_answer ?? '')
  }, [round.my_answer, round.round_id])

  const submit = async () => {
    if (!answer.trim() || round.my_answer) return
    setBusy(true)
    setError('')
    try {
      const { data, error } = await supabase.rpc('submit_answer', {
        p_round_id: round.round_id,
        p_answer_value: answer.trim(),
      })
      if (error) throw error
      assertVoidRpc(data, 'submit_answer')
      await onRefresh()
    } catch (e) {
      setError(friendlyError(e))
    } finally {
      setBusy(false)
    }
  }

  const save = async () => {
    setBusy(true)
    setError('')
    try {
      const { data, error } = await supabase.rpc('save_round_to_memory', { p_round_id: round.round_id })
      if (error) throw error
      parseUuidRpc(data, 'save_round_to_memory')
      await onMemorySaved()
    } catch (e) {
      setError(friendlyError(e))
    } finally {
      setBusy(false)
    }
  }

  const isRevealed = round.status === 'revealed'
  const hasAnswered = Boolean(round.my_answer)

  return (
    <section className="standard-screen has-nav">
      <header className="home-header">
        <BrandMark />
        <div className="couple-pill"><span>{couple.my_name?.[0]}</span><Heart size={12} fill="currentColor" /><span>{couple.partner_name?.[0] ?? '?'}</span></div>
      </header>

      {!isRevealed && !hasAnswered && (
        <div className="today-content">
          <div className="day-meta"><span>{round.prompt.mode}</span><small>{formatDate(round.round_date)}</small></div>
          <article className="question-card">
            <div className="question-symbol">“</div>
            <span className="category-chip">{round.prompt.category}</span>
            <h1>{round.prompt.prompt_text}</h1>
            <p className="private-hint"><LockKeyhole size={15} /> Your answer is private until {round.partner_name ?? 'your partner'} answers too.</p>
          </article>

          {options.length > 0 ? (
            <div className="option-grid">
              {options.map((option) => (
                <button key={option} className={`option-button ${answer === option ? 'selected' : ''}`} onClick={() => setAnswer(option)}>{option}{answer === option && <Check size={17} />}</button>
              ))}
            </div>
          ) : (
            <textarea className="answer-box" maxLength={400} rows={5} placeholder={answerPlaceholder(round.prompt.answer_type)} value={answer} onChange={(e) => setAnswer(e.target.value)} />
          )}

          <button className="button primary" disabled={busy || !answer.trim()} onClick={submit}>
            {busy ? <LoaderCircle className="spin" size={18} /> : <MessageCircleHeart size={18} />} Lock in my answer
          </button>
        </div>
      )}

      {!isRevealed && hasAnswered && (
        <div className="answer-wait full-center inner">
          <div className="sealed-answer"><LockKeyhole size={26} /><span>Answer locked</span></div>
          <div className="center-copy">
            <span className="eyebrow">You’re done</span>
            <h2>Now we wait for {round.partner_name ?? 'your partner'}.</h2>
            <p>Your answer is sealed. The reveal appears automatically the moment both of you are in.</p>
          </div>
          <div className="my-answer-preview"><small>Your answer</small><p>{round.my_answer}</p></div>
          <div className="waiting-pulse"><span /> {round.partner_answered ? 'Revealing…' : 'Waiting for their answer…'}</div>
          <button className="text-button" onClick={() => onRefresh()}><RefreshCw size={15} /> Check now</button>
        </div>
      )}

      {isRevealed && (
        <div className="reveal-content">
          <div className="reveal-burst"><Sparkles size={18} /><span>{round.match ? 'You matched!' : 'Plot twist!'}</span><Sparkles size={18} /></div>
          <div className="reveal-heading"><small>Today’s reveal</small><h2>{round.prompt.prompt_text}</h2></div>
          <div className="answer-pair">
            <AnswerCard name={round.my_name} answer={round.my_answer ?? ''} label="You" />
            <div className="versus-heart"><Heart size={18} fill="currentColor" /></div>
            <AnswerCard name={round.partner_name ?? 'Partner'} answer={round.partner_answer ?? ''} label="Your person" />
          </div>
          <div className={`commentary-card ${round.match ? 'match' : ''}`}>
            <Sparkles size={20} />
            <div><strong>{round.match ? 'Same wavelength.' : 'Different answers, better conversation.'}</strong><p>{round.match ? 'You two called it exactly the same.' : 'A mismatch is not a miss — it’s something new to learn about each other.'}</p></div>
          </div>
          <button className={`button ${saved ? 'saved' : 'primary'}`} onClick={save} disabled={busy || saved}>
            {saved ? <><Check size={18} /> Saved to your Memory Vault</> : <><Vault size={18} /> Save this moment</>}
          </button>
        </div>
      )}

      <BottomNav active="today" onToday={() => undefined} onMemories={onOpenMemories} busy={busy} />
    </section>
  )
}

function AnswerCard({ name, answer, label }: { name: string; answer: string; label: string }) {
  return (
    <article className="answer-card">
      <div className="answer-person"><span>{name?.[0]?.toUpperCase()}</span><div><small>{label}</small><strong>{name}</strong></div></div>
      <p>{answer}</p>
    </article>
  )
}

function MemoryVault({ couple, memories, busy, onToday, onRefresh }: { couple: CoupleState; memories: MemoryRow[]; busy: boolean; onToday: () => Promise<void>; onRefresh: () => Promise<void> }) {
  return (
    <section className="standard-screen has-nav">
      <header className="home-header"><BrandMark /><div className="couple-pill"><span>{couple.my_name?.[0]}</span><Heart size={12} fill="currentColor" /><span>{couple.partner_name?.[0] ?? '?'}</span></div></header>
      <div className="vault-heading"><span className="eyebrow"><Vault size={14} /> Memory Vault</span><h1>The little things worth keeping.</h1><p>Reveals you both decided should not disappear.</p></div>
      <div className="memory-list">
        {memories.length === 0 ? (
          <div className="empty-vault"><div className="empty-icon"><Heart size={24} /></div><h3>Your vault is waiting.</h3><p>Save a reveal and it will live here for both of you.</p></div>
        ) : memories.map((memory) => <MemoryCard key={memory.id} memory={memory} />)}
      </div>
      <button className="refresh-vault text-button" onClick={onRefresh} disabled={busy}><RefreshCw size={15} className={busy ? 'spin' : ''} /> Refresh memories</button>
      <BottomNav active="memories" onToday={onToday} onMemories={() => undefined} busy={busy} />
    </section>
  )
}

function MemoryCard({ memory }: { memory: MemoryRow }) {
  let body: MemoryBody = {}
  try { body = JSON.parse(memory.body) as MemoryBody } catch { body = {} }
  return (
    <article className="memory-card">
      <div className="memory-date">{new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(memory.created_at))}</div>
      <h3>{memory.title}</h3>
      <div className="memory-answer"><span>{body.first_name ?? 'One of you'}</span><p>{body.first_answer ?? '—'}</p></div>
      <div className="memory-answer"><span>{body.second_name ?? 'The other'}</span><p>{body.second_answer ?? '—'}</p></div>
    </article>
  )
}

function BottomNav({ active, onToday, onMemories, busy }: { active: 'today' | 'memories'; onToday: () => void | Promise<void>; onMemories: () => void | Promise<void>; busy: boolean }) {
  return (
    <nav className="bottom-nav">
      <button className={active === 'today' ? 'active' : ''} onClick={onToday} disabled={busy}><Sparkles size={19} /><span>Today</span></button>
      <button className={active === 'memories' ? 'active' : ''} onClick={onMemories} disabled={busy}><Vault size={19} /><span>Memories</span></button>
    </nav>
  )
}

function formatDate(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  return new Intl.DateTimeFormat('en', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(year, month - 1, day))
}

function answerPlaceholder(answerType: string) {
  if (answerType === 'completion') return 'Done? Tell them how it went…'
  if (answerType === 'date_builder') return 'Build your perfect plan…'
  return 'Type what comes to mind…'
}

export default App

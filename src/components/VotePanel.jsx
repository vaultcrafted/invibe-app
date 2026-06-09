import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { SHIFTS } from '../lib/constants'
import { Trophy, Star, Lock } from 'lucide-react'

function getCurrentDayNum(shiftStart) {
  const start = new Date(shiftStart)
  start.setHours(0, 0, 0, 0)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.floor((today - start) / (1000 * 60 * 60 * 24)) + 1
}

// ── Componente principale esportato ──
export default function VotePanel({ destination, shiftNum, members, currentUserId, isAdmin }) {
  const shiftInfo = SHIFTS[destination]?.find(s => s.num === shiftNum)
  const dayNum = shiftInfo ? getCurrentDayNum(shiftInfo.start) : 0
  const effectiveDayNum = (dayNum >= 1 && dayNum <= 7) ? dayNum : 1
  const canVoteDaily = true // sempre true per ora (pre-turno mostra day 1)
  const canVoteWeekly = effectiveDayNum === 7

  const [dailyVote, setDailyVote] = useState(null)    // voted_for_id o null
  const [weeklyVote, setWeeklyVote] = useState(null)
  const [voteCounts, setVoteCounts] = useState({})     // { userId: count } — solo admin
  const [weeklyVoteCounts, setWeeklyVoteCounts] = useState({})
  const [loading, setLoading] = useState(true)
  const [voting, setVoting] = useState(false)
  const [activeTab, setActiveTab] = useState('daily')  // 'daily' | 'weekly'

  useEffect(() => {
    loadVotes()
  }, [destination, shiftNum, effectiveDayNum])

  async function loadVotes() {
    setLoading(true)
    // Voto giornaliero dell'utente corrente
    if (canVoteDaily) {
      const { data: myDaily } = await supabase
        .from('votes')
        .select('voted_for_id')
        .eq('voter_id', currentUserId)
        .eq('destination', destination)
        .eq('shift_num', shiftNum)
        .eq('day_num', effectiveDayNum)
        .eq('type', 'daily')
        .maybeSingle()
      setDailyVote(myDaily?.voted_for_id || null)
    }

    // Voto settimanale
    const { data: myWeekly } = await supabase
      .from('votes')
      .select('voted_for_id')
      .eq('voter_id', currentUserId)
      .eq('destination', destination)
      .eq('shift_num', shiftNum)
      .eq('day_num', 7)
      .eq('type', 'weekly')
      .maybeSingle()
    setWeeklyVote(myWeekly?.voted_for_id || null)

    // Conteggi per admin
    if (isAdmin) {
      const { data: allVotes } = await supabase
        .from('votes')
        .select('voted_for_id, type, day_num')
        .eq('destination', destination)
        .eq('shift_num', shiftNum)

      if (allVotes) {
        // Daily: somma tutti i giorni
        const daily = {}
        const weekly = {}
        allVotes.forEach(v => {
          if (v.type === 'daily') {
            daily[v.voted_for_id] = (daily[v.voted_for_id] || 0) + 1
          } else {
            weekly[v.voted_for_id] = (weekly[v.voted_for_id] || 0) + 1
          }
        })
        setVoteCounts(daily)
        setWeeklyVoteCounts(weekly)
      }
    }
    setLoading(false)
  }

  async function castVote(votedForId, type) {
    if (voting) return
    setVoting(true)
    const day = type === 'weekly' ? 7 : effectiveDayNum
    const { error } = await supabase.from('votes').insert({
      voter_id: currentUserId,
      voted_for_id: votedForId,
      destination,
      shift_num: shiftNum,
      day_num: day,
      type,
    })
    if (!error) {
      if (type === 'daily') setDailyVote(votedForId)
      else setWeeklyVote(votedForId)
      if (isAdmin) await loadVotes()
    }
    setVoting(false)
  }

  // Filtra: non si vota se stessi
  const votableMembers = members.filter(m => m.id !== currentUserId)

  if (loading) return null

  // Forza dayNum a 1 se fuori range (pre-turno), così il pannello è sempre visibile
  const currentVote = activeTab === 'daily' ? dailyVote : weeklyVote
  const hasVoted = currentVote !== null
  const canVote = activeTab === 'daily' ? canVoteDaily : canVoteWeekly
  const counts = activeTab === 'daily' ? voteCounts : weeklyVoteCounts

  // Ordina per voti se admin
  const sortedMembers = isAdmin
    ? [...votableMembers].sort((a, b) => (counts[b.id] || 0) - (counts[a.id] || 0))
    : votableMembers

  return (
    <div style={{ marginTop: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <Trophy size={16} color="#D4AC0D" />
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
          Vota il migliore
        </span>
        <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 10, background: '#FEF9C3', color: '#854D0E' }}>
          Day {effectiveDayNum}
        </span>
      </div>

      {/* Tab daily / weekly */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        <button onClick={() => setActiveTab('daily')} style={{
          padding: '5px 14px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer',
          background: activeTab === 'daily' ? '#D4AC0D' : 'var(--bg-secondary)',
          color: activeTab === 'daily' ? '#fff' : 'var(--text-secondary)',
          border: '0.5px solid ' + (activeTab === 'daily' ? '#D4AC0D' : 'var(--border)'),
        }}>⭐ Del giorno</button>
        <button onClick={() => setActiveTab('weekly')} style={{
          padding: '5px 14px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer',
          background: activeTab === 'weekly' ? '#D4AC0D' : 'var(--bg-secondary)',
          color: activeTab === 'weekly' ? '#fff' : 'var(--text-secondary)',
          border: '0.5px solid ' + (activeTab === 'weekly' ? '#D4AC0D' : 'var(--border)'),
        }}>🏆 Della settimana</button>
      </div>

      {/* Stato voto */}
      {!canVote && activeTab === 'weekly' && effectiveDayNum < 7 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'var(--bg-secondary)', borderRadius: 10, marginBottom: 10 }}>
          <Lock size={14} color="var(--text-tertiary)" />
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            Il voto della settimana si sblocca al Day 7
          </span>
        </div>
      )}

      {hasVoted && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: '#FEF9C3', borderRadius: 10, marginBottom: 10, border: '0.5px solid #FDE047' }}>
          <Star size={14} color="#D4AC0D" fill="#D4AC0D" />
          <span style={{ fontSize: 12, color: '#854D0E', fontWeight: 600 }}>
            Hai votato: {members.find(m => m.id === currentVote)?.nome} {members.find(m => m.id === currentVote)?.cognome}
          </span>
        </div>
      )}

      {/* Lista votabile */}
      {canVote && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {sortedMembers.map(m => {
            const isVoted = currentVote === m.id
            const count = counts[m.id] || 0
            const initials = ((m.nome?.[0] || '') + (m.cognome?.[0] || '')).toUpperCase()

            return (
              <div key={m.id} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 14px', borderRadius: 12,
                background: isVoted ? '#FEF9C3' : 'var(--bg-secondary)',
                border: '1px solid ' + (isVoted ? '#FDE047' : 'var(--border)'),
                cursor: hasVoted ? 'default' : 'pointer',
                transition: 'all 0.15s',
              }}
                onClick={() => !hasVoted && !voting && castVote(m.id, activeTab)}
              >
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: isVoted ? '#D4AC0D' : 'var(--bg-primary)', border: '1.5px solid ' + (isVoted ? '#D4AC0D' : 'var(--border)'), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: isVoted ? '#fff' : 'var(--text-secondary)', flexShrink: 0 }}>
                  {isVoted ? <Star size={16} fill="#fff" color="#fff" /> : initials}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: isVoted ? '#854D0E' : 'var(--text-primary)' }}>
                    {m.nome} {m.cognome}
                  </div>
                  {m.ruolo && <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 1 }}>{m.ruolo}</div>}
                </div>
                {/* Admin: mostra conteggio voti */}
                {isAdmin && count > 0 && (
                  <div style={{ fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 12, background: '#D4AC0D', color: '#fff' }}>
                    {count} {count === 1 ? 'voto' : 'voti'}
                  </div>
                )}
                {/* Staff: checkbox */}
                {!isAdmin && (
                  <div style={{ width: 20, height: 20, borderRadius: 6, border: '1.5px solid ' + (isVoted ? '#D4AC0D' : 'var(--border)'), background: isVoted ? '#D4AC0D' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {isVoted && <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

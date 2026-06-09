import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { SHIFTS } from '../lib/constants'

function getCurrentDayNum(shiftStart) {
  const start = new Date(shiftStart)
  start.setHours(0, 0, 0, 0)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.floor((today - start) / (1000 * 60 * 60 * 24)) + 1
}

export function useVotes({ destination, shiftNum, currentUserId, isAdmin, profile }) {
  const shiftInfo = SHIFTS[destination]?.find(s => s.num === shiftNum)
  const dayNum = shiftInfo ? getCurrentDayNum(shiftInfo.start) : 0
  const effectiveDayNum = (dayNum >= 1 && dayNum <= 7) ? dayNum : 1
  const canSeeVotes = isAdmin || ['CM', 'SUPERVISOR'].some(r => (profile?.ruolo || '').toUpperCase().includes(r))

  const [dailyVote, setDailyVote] = useState(null)
  const [weeklyVote, setWeeklyVote] = useState(null)
  const [voteCounts, setVoteCounts] = useState({})
  const [weeklyVoteCounts, setWeeklyVoteCounts] = useState({})
  const [loading, setLoading] = useState(true)
  const [voting, setVoting] = useState(false)

  useEffect(() => { loadVotes() }, [destination, shiftNum, effectiveDayNum])

  async function loadVotes() {
    setLoading(true)
    const [{ data: myDaily }, { data: myWeekly }] = await Promise.all([
      supabase.from('votes').select('voted_for_id')
        .eq('voter_id', currentUserId).eq('destination', destination)
        .eq('shift_num', shiftNum).eq('day_num', effectiveDayNum).eq('type', 'daily').maybeSingle(),
      supabase.from('votes').select('voted_for_id')
        .eq('voter_id', currentUserId).eq('destination', destination)
        .eq('shift_num', shiftNum).eq('type', 'weekly').maybeSingle(),
    ])
    setDailyVote(myDaily?.voted_for_id || null)
    setWeeklyVote(myWeekly?.voted_for_id || null)

    if (canSeeVotes) {
      const { data: allVotes } = await supabase
        .from('votes').select('voted_for_id, type')
        .eq('destination', destination).eq('shift_num', shiftNum)
      if (allVotes) {
        const daily = {}, weekly = {}
        allVotes.forEach(v => {
          if (v.type === 'daily') daily[v.voted_for_id] = (daily[v.voted_for_id] || 0) + 1
          else weekly[v.voted_for_id] = (weekly[v.voted_for_id] || 0) + 1
        })
        setVoteCounts(daily)
        setWeeklyVoteCounts(weekly)
      }
    }
    setLoading(false)
  }

  async function castVote(votedForId) {
    if (voting) return
    setVoting(true)
    await supabase.from('votes').delete()
      .eq('voter_id', currentUserId).eq('destination', destination)
      .eq('shift_num', shiftNum).eq('day_num', effectiveDayNum).eq('type', 'daily')
    if (dailyVote === votedForId) {
      setDailyVote(null)
    } else {
      await supabase.from('votes').insert({
        voter_id: currentUserId, voted_for_id: votedForId,
        destination, shift_num: shiftNum, day_num: effectiveDayNum, type: 'daily',
      })
      setDailyVote(votedForId)
    }
    if (canSeeVotes) {
      setVoteCounts(prev => {
        const next = { ...prev }
        if (dailyVote) next[dailyVote] = Math.max(0, (next[dailyVote] || 1) - 1)
        if (dailyVote !== votedForId) next[votedForId] = (next[votedForId] || 0) + 1
        return next
      })
    }
    setVoting(false)
  }

  async function castWeeklyVote(votedForId) {
    if (voting) return
    setVoting(true)
    await supabase.from('votes').delete()
      .eq('voter_id', currentUserId).eq('destination', destination)
      .eq('shift_num', shiftNum).eq('type', 'weekly')
    if (weeklyVote === votedForId) {
      setWeeklyVote(null)
    } else {
      await supabase.from('votes').insert({
        voter_id: currentUserId, voted_for_id: votedForId,
        destination, shift_num: shiftNum, day_num: 7, type: 'weekly',
      })
      setWeeklyVote(votedForId)
    }
    if (canSeeVotes) {
      setWeeklyVoteCounts(prev => {
        const next = { ...prev }
        if (weeklyVote) next[weeklyVote] = Math.max(0, (next[weeklyVote] || 1) - 1)
        if (weeklyVote !== votedForId) next[votedForId] = (next[votedForId] || 0) + 1
        return next
      })
    }
    setVoting(false)
  }

  return { dailyVote, weeklyVote, voteCounts, weeklyVoteCounts, loading, voting, castVote, castWeeklyVote, canSeeVotes, effectiveDayNum }
}

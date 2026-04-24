import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import supabase from '../lib/supabase'

const MOOD_OPTIONS = [
  { value: 'happy',   emoji: '😊', label: 'Happy' },
  { value: 'sad',     emoji: '😢', label: 'Sad' },
  { value: 'neutral', emoji: '😐', label: 'Neutral' },
  { value: 'excited', emoji: '🤩', label: 'Excited' },
  { value: 'anxious', emoji: '😰', label: 'Anxious' }
]

function getMoodDisplay(mood) {
  const found = MOOD_OPTIONS.find(m => m.value === mood)
  return found ? `${found.emoji} ${found.label}` : mood
}

function todayDate() {
  return new Date().toISOString().split('T')[0]
}

export default function MainPage() {
  const navigate = useNavigate()
  const [entries, setEntries] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  const [selectedMood, setSelectedMood] = useState('happy')
  const [note, setNote] = useState('')
  const [formError, setFormError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => { fetchEntries() }, [])

  async function fetchEntries() {
    setIsLoading(true)
    setError(null)
    try {
      const { data, error } = await supabase
        .from('mood_entries')
        .select('*')
        .order('logged_at', { ascending: false })
      if (error) {
        if (
          error.message.includes('does not exist') ||
          error.message.includes('schema cache') ||
          error.message.includes('relation') ||
          error.message.includes('Could not find')
        ) {
          setError('Something went wrong. Please try again later.')
        } else {
          setError(error.message)
        }
        return
      }
      setEntries(data)
    } catch {
      setError('Connection error. Please check your internet and try again.')
    } finally {
      setIsLoading(false)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setFormError(null)
    if (!selectedMood) { setFormError('Please select a mood.'); return }

    const today = todayDate()

    // Check for duplicate entry today
    const alreadyToday = entries.some(en => en.logged_at === today)
    if (alreadyToday) {
      setFormError('You already logged your mood for today.')
      return
    }

    setSubmitting(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const { data, error } = await supabase
        .from('mood_entries')
        .insert({ user_id: user.id, mood: selectedMood, note: note.trim() || null, logged_at: today })
        .select()
        .single()
      if (error) {
        setFormError(error.message)
        return
      }
      setEntries([data, ...entries])
      setNote('')
      setSelectedMood('happy')
    } catch {
      setFormError('Failed to save. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(id) {
    const { error } = await supabase.from('mood_entries').delete().eq('id', id)
    if (error) { setError(error.message); return }
    setEntries(entries.filter(en => en.id !== id))
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    navigate('/login')
  }

  const today = todayDate()
  const loggedToday = entries.some(en => en.logged_at === today)

  if (isLoading) return <div className="text-center py-8">Loading...</div>
  if (error) return <div className="text-red-500 text-center py-8">{error}</div>

  return (
    <div className="max-w-lg mx-auto mt-10 px-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Mood Tracker</h1>
        <button onClick={handleLogout} className="text-sm text-gray-500 underline">Logout</button>
      </div>

      {/* Log mood form */}
      {!loggedToday && (
        <form onSubmit={handleSubmit} className="mb-8 space-y-3">
          <p className="font-medium">How are you feeling today?</p>
          <div className="flex gap-2 flex-wrap">
            {MOOD_OPTIONS.map(m => (
              <button
                type="button"
                key={m.value}
                onClick={() => setSelectedMood(m.value)}
                className={`px-3 py-2 rounded border text-sm ${
                  selectedMood === m.value
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-700 border-gray-300'
                }`}
              >
                {m.emoji} {m.label}
              </button>
            ))}
          </div>
          <textarea
            placeholder="Add a note (optional)"
            value={note}
            onChange={e => setNote(e.target.value)}
            className="border rounded px-3 py-2 w-full text-sm"
            rows={2}
          />
          {formError && <p className="text-red-500 text-sm">{formError}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="bg-blue-600 text-white px-4 py-2 rounded w-full disabled:opacity-50"
          >
            {submitting ? 'Saving...' : 'Log Mood'}
          </button>
        </form>
      )}

      {loggedToday && (
        <div className="mb-6 p-3 bg-green-50 border border-green-200 rounded text-sm text-green-700">
          You already logged your mood for today.
        </div>
      )}

      {/* History */}
      <h2 className="font-semibold mb-3 text-gray-700">Mood History</h2>
      {entries.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          No mood entries yet. Log your first mood above.
        </div>
      ) : (
        <ul className="space-y-2">
          {entries.map(entry => (
            <li key={entry.id} className="flex justify-between items-start border rounded px-3 py-2">
              <div>
                <div className="font-medium">{getMoodDisplay(entry.mood)}</div>
                <div className="text-xs text-gray-500">{entry.logged_at}</div>
                {entry.note && <div className="text-sm text-gray-600 mt-1">{entry.note}</div>}
              </div>
              <button
                onClick={() => handleDelete(entry.id)}
                className="text-red-400 text-sm ml-4 hover:text-red-600 shrink-0"
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

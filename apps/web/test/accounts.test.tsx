import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { LessonSettings, User } from '@motius/shared'
import { AudioProvider } from '@/audio/AudioProvider'
import { MidiProvider } from '@/midi/MidiProvider'
import { TopBar } from '@/components/TopBar'
import { useLessonSettings } from '@/components/use-lesson-settings'
import { SignInPage } from '@/features/account/SignInPage'
import { LessonSettingsPage } from '@/features/areas/LessonSettingsPage'
import { api } from '@/lib/api'
import { useAccountStore } from '@/state/account-store'
import { useLearningStore } from '@/state/learning-store'
import { useLessonSettingsStore } from '@/state/lesson-settings-store'
import { usePageStore, usePageSync } from '@/state/page-store'
import { useViewStore } from '@/state/view-store'

/**
 * Accounts: the sign-in page in front of everything, the admin's Lesson
 * settings, and each lesson opening as an admin set it — a start the player
 * can change, never a rule, and never saved as the player's own preference.
 */

const LESSON = 'piano-foundations/keyboard-layout/white-and-black-keys/two-black-key-groups'
const OTHER = 'piano-foundations/keyboard-layout/white-and-black-keys/three-black-key-groups'

const user = (isAdmin: boolean): User => ({
  email: isAdmin ? 'admin@example.com' : 'player@example.com',
  name: 'Someone',
  picture: null,
  isAdmin,
})

const settings = (over: Partial<LessonSettings> = {}): LessonSettings => ({
  lessonKey: LESSON,
  keyLabels: null,
  stageView: null,
  hands: null,
  bpm: null,
  ...over,
})

const fresh = () => new QueryClient({ defaultOptions: { queries: { retry: false } } })

beforeEach(() => {
  globalThis.localStorage.clear()
  globalThis.location.hash = ''
  usePageStore.setState({ page: 'dashboard', category: null, path: [] })
  useLessonSettingsStore.setState({ byLesson: {}, loaded: false })
  useLearningStore.getState().setKeyLabels('notes')
  useViewStore.setState({ stageView: 'staff', hands: false })
  useAccountStore.setState({ status: 'signed-in', user: user(false), error: null })
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  globalThis.location.hash = ''
})

describe('a lesson opens as an admin set it', () => {
  function Follow() {
    usePageSync()
    useLessonSettings()
    return null
  }
  const go = async (hash: string) => {
    act(() => {
      globalThis.location.hash = hash
    })
    await waitFor(() =>
      expect(usePageStore.getState().page).toBe(hash === '#/' ? 'dashboard' : 'lesson'),
    )
  }
  const stage = () => ({
    keyLabels: useLearningStore.getState().keyLabels,
    stageView: useViewStore.getState().stageView,
    hands: useViewStore.getState().hands,
  })

  beforeEach(() => {
    vi.spyOn(api, 'listLessonSettings').mockResolvedValue({
      items: [settings({ keyLabels: 'fingers', stageView: 'falling', hands: true, bpm: 50 })],
    })
  })

  it('with its settings, and gives the player their own back on the way out', async () => {
    render(<Follow />)
    await waitFor(() => expect(useLessonSettingsStore.getState().loaded).toBe(true))
    await go(`#/${LESSON}`)
    await waitFor(() =>
      expect(stage()).toEqual({ keyLabels: 'fingers', stageView: 'falling', hands: true }),
    )
    expect(useLearningStore.getState().targetBpm).toBe(50)
    // Not saved as the player's own view: a lesson's choice is not theirs.
    expect(globalThis.localStorage.getItem('motius.stage-view')).toBeNull()

    // A lesson with none set opens as the player left things.
    await go(`#/${OTHER}`)
    await waitFor(() =>
      expect(stage()).toEqual({ keyLabels: 'notes', stageView: 'staff', hands: false }),
    )
    await go('#/')
    expect(stage()).toEqual({ keyLabels: 'notes', stageView: 'staff', hands: false })
  })

  it('keeps what the player changed while in the lesson', async () => {
    render(<Follow />)
    await waitFor(() => expect(useLessonSettingsStore.getState().loaded).toBe(true))
    await go(`#/${LESSON}`)
    await waitFor(() => expect(stage().keyLabels).toBe('fingers'))
    act(() => useLearningStore.getState().setKeyLabels('degrees'))
    await go('#/')
    // Theirs, kept; the view the lesson set goes back.
    expect(stage()).toEqual({ keyLabels: 'degrees', stageView: 'staff', hands: false })
  })
})

describe('Lesson settings, the admin’s page', () => {
  it('lists the written lessons and saves a change as it is made', async () => {
    const save = vi
      .spyOn(api, 'setLessonSettings')
      .mockImplementation(async (sent) => ({ ...sent }))
    render(<LessonSettingsPage />)
    expect(screen.getByRole('heading', { name: 'Lesson settings' })).toBeDefined()
    // Only written lessons: one not written yet has nothing to set.
    expect(
      screen.queryByRole('combobox', { name: 'Key labels for Staff lines and spaces' }),
    ).toBeNull()

    fireEvent.change(screen.getByRole('combobox', { name: 'Key labels for Two black keys' }), {
      target: { value: 'fingers' },
    })
    await waitFor(() => expect(save).toHaveBeenCalledWith(settings({ keyLabels: 'fingers' })))
    await screen.findByText('Saved')

    fireEvent.change(screen.getByRole('combobox', { name: 'Tempo for Two black keys' }), {
      target: { value: '50' },
    })
    await waitFor(() =>
      expect(save).toHaveBeenLastCalledWith(settings({ keyLabels: 'fingers', bpm: 50 })),
    )
  })

  it('says when a change was not saved', async () => {
    vi.spyOn(api, 'setLessonSettings').mockRejectedValue(new Error('offline'))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    render(<LessonSettingsPage />)
    fireEvent.change(screen.getByRole('combobox', { name: 'View for Two black keys' }), {
      target: { value: 'falling' },
    })
    await screen.findByText('Not saved. Try again.')
  })
})

describe('the account, at the end of the bar', () => {
  const bar = () =>
    render(
      <QueryClientProvider client={fresh()}>
        <AudioProvider>
          <MidiProvider>
            <TopBar />
          </MidiProvider>
        </AudioProvider>
      </QueryClientProvider>,
    )
  const account = () => {
    fireEvent.click(screen.getByRole('button', { name: /^Account: / }))
    return screen.getByRole('menu')
  }

  it('shows a player their initials, and their address over Settings, Progress and Sign out', () => {
    bar()
    expect(screen.getByRole('button', { name: 'Account: Someone' }).textContent).toBe('S')
    const items = account()
    expect(items.textContent).toContain('player@example.com')
    for (const name of ['Settings', 'Progress', 'Sign out']) {
      expect(within(items).getByText(name)).toBeDefined()
    }
    expect(within(items).queryByText('Lesson settings')).toBeNull()
  })

  it('is the one home of Settings and Sign out: the ⋮ menu and the tools have neither', () => {
    bar()
    expect(screen.queryByRole('button', { name: 'Settings' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Menu' }))
    const menu = screen.getByRole('menu')
    expect(within(menu).queryByText('Sign out')).toBeNull()
    expect(within(menu).queryByText('Settings')).toBeNull()
  })

  it('offers an admin Lesson settings, and signs out', async () => {
    useAccountStore.setState({ user: user(true) })
    const signOut = vi.spyOn(api, 'signOut').mockResolvedValue(null)
    bar()
    fireEvent.click(within(account()).getByText('Lesson settings'))
    await waitFor(() => expect(globalThis.location.hash).toBe('#/admin'))
    fireEvent.click(within(account()).getByText('Sign out'))
    await waitFor(() => expect(useAccountStore.getState().status).toBe('signed-out'))
    expect(signOut).toHaveBeenCalled()
  })
})

describe('the sign-in page', () => {
  const page = () =>
    render(
      <QueryClientProvider client={fresh()}>
        <SignInPage />
      </QueryClientProvider>,
    )

  it('says so when the server has no Google client set', async () => {
    useAccountStore.setState({ status: 'signed-out', user: null })
    vi.spyOn(api, 'authConfig').mockResolvedValue({ googleClientId: null })
    page()
    expect(screen.getByRole('heading', { name: 'Welcome to Motius' })).toBeDefined()
    await screen.findByText('Sign-in with Google is not set up on this server yet.')
  })

  it('offers to try again when the server cannot be reached', () => {
    useAccountStore.setState({ status: 'unreachable', user: null })
    page()
    expect(screen.getByRole('alert').textContent).toContain('could not be reached')
    expect(screen.getByRole('button', { name: 'Try again' })).toBeDefined()
  })

  it('lands on the sign-in page when the server says the sign-in ran out', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ error: { code: 'signed_out', message: 'x' } }), {
            status: 401,
          }),
      ),
    )
    await api.listInstruments().catch(() => {})
    expect(useAccountStore.getState().status).toBe('signed-out')
    vi.unstubAllGlobals()
  })
})

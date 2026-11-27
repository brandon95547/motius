import { StrictMode } from 'react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { IDLE_SESSION, lessonExercise, loadLessons, type Exercise } from '@motius/shared'
import { buildAnnotations } from '@/state/learning-annotations'
import { useLearningStore } from '@/state/learning-store'

/**
 * A question by ear: the app plays its notes as the step comes up, takes no
 * answer until they have sounded, and keeps the answer off the keys.
 */

const play = vi.fn(
  (_note: number, _velocity: number, _afterMs: number, _durationMs: number) => true,
)
const stopPlayed = vi.fn()

vi.mock('@/audio/AudioProvider', () => ({
  useAudio: () => ({ play, stopPlayed, noteOn: vi.fn(), noteOff: vi.fn() }),
}))

const { StepPrompt } = await import('@/features/areas/StepPrompt')

const MIDDLE_C = 60
let lesson: Exercise

beforeAll(async () => {
  await loadLessons('high-or-low')
  lesson = lessonExercise('high-or-low')!
})

beforeEach(() => {
  vi.useFakeTimers()
  play.mockClear()
  useLearningStore.setState({
    exercise: lesson,
    mode: 'learn',
    targetBpm: 60,
    prompting: false,
    session: { ...IDLE_SESSION, status: 'running', startedAt: 0 },
  })
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

const session = () => useLearningStore.getState().session

describe('a question by ear', () => {
  it('plays middle C, then the second note a beat later, as the question comes up', () => {
    render(
      <StrictMode>
        <StepPrompt />
      </StrictMode>,
    )
    const asked = play.mock.calls.slice(-2).map(([note, , after]) => [note, after])
    expect(asked).toEqual([
      [MIDDLE_C, 500],
      [lesson.steps[0]!.prompt![1], 1500],
    ])
    expect(screen.getByText('Listen')).toBeDefined()
  })

  it('takes no answer while it plays, then takes one', () => {
    render(<StepPrompt />)
    act(() => useLearningStore.getState().noteOn(MIDDLE_C + 12))
    expect(session().stepIndex).toBe(0)
    expect(session().mistakes).toBe(0)

    act(() => void vi.advanceTimersByTime(2500))
    expect(screen.getByText(/Higher\? A key to the right/)).toBeDefined()
    act(() => useLearningStore.getState().noteOn(MIDDLE_C + 12))
    expect(session().stepIndex).toBe(1)
  })

  it('plays it again on Hear it again, and the next question as it comes up', () => {
    render(<StepPrompt />)
    act(() => void vi.advanceTimersByTime(2500))
    play.mockClear()
    fireEvent.click(screen.getByRole('button', { name: 'Hear it again' }))
    expect(play.mock.calls.map(([note]) => note)).toEqual(lesson.steps[0]!.prompt)

    act(() => void vi.advanceTimersByTime(2500))
    play.mockClear()
    act(() => useLearningStore.getState().noteOn(MIDDLE_C + 12))
    expect(play.mock.calls.map(([note]) => note)).toEqual(lesson.steps[1]!.prompt)
  })
})

describe('what to do, on the stage', () => {
  it('says Listen while the question plays, then the step’s own few words', async () => {
    await loadLessons('pitch-recognition')
    const tunes = lessonExercise('pitch-recognition')!
    act(() => useLearningStore.setState({ exercise: tunes }))
    render(<StepPrompt />)
    const said = () => document.querySelector('.step-prompt__say')!.textContent
    expect(said()).toBe('Listen')
    act(() => void vi.advanceTimersByTime(2500))
    expect(said()).toBe('Play the second note')
  })
})

describe('a tune to play back', () => {
  it('is played once, as its first note is asked for, and not again for the rest', async () => {
    await loadLessons('pitch-recognition')
    const tunes = lessonExercise('pitch-recognition')!
    const first = tunes.steps.findIndex((step) => step.prompt!.length > 2)
    act(() =>
      useLearningStore.setState({
        exercise: tunes,
        session: { ...IDLE_SESSION, status: 'running', startedAt: 0, stepIndex: first },
      }),
    )
    play.mockClear()
    render(<StepPrompt />)
    const tune = tunes.steps[first]!.prompt!
    expect(play.mock.calls.map(([note]) => note)).toEqual(tune)
    act(() => void vi.advanceTimersByTime(500 + tune.length * 1000))
    play.mockClear()
    act(() => useLearningStore.getState().noteOn(tune[0]!))
    expect(useLearningStore.getState().session.stepIndex).toBe(first + 1)
    expect(play).not.toHaveBeenCalled()
  })
})

describe('the keys during a question', () => {
  it('mark middle C, and not the answer', () => {
    const marks = buildAnnotations(lesson, 'learn', { ...IDLE_SESSION, status: 'running' })
    expect(marks).toEqual({ [MIDDLE_C]: { role: 'root', label: 'C' } })
  })

  it('keep middle C marked in Practice, which hides everything else', () => {
    const marks = buildAnnotations(lesson, 'practice', { ...IDLE_SESSION, status: 'running' })
    expect(marks).toEqual({ [MIDDLE_C]: { role: 'root', label: 'C' } })
  })

  it('wash a stretch a step asks for when it is no question', () => {
    const plain: Exercise = {
      ...lesson,
      steps: [{ ...lesson.steps[0]!, prompt: undefined, answer: { from: 61, to: 64 } }],
    }
    const marks = buildAnnotations(plain, 'learn', { ...IDLE_SESSION, status: 'running' })
    expect([61, 62, 63, 64].map((note) => marks[note]?.role)).toEqual([
      'scale',
      'scale',
      'scale',
      'scale',
    ])
  })
})

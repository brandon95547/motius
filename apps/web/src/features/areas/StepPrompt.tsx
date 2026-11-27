import * as React from 'react'
import { RotateCcw } from 'lucide-react'
import { useAudio } from '@/audio/AudioProvider'
import { Button } from '@/ui/Button'
import { useLearningStore } from '@/state/learning-store'

/** A breath before a question, so the answer just played has died away. */
const BEFORE_MS = 500

/** An even mezzo-forte, as a demonstration plays: the question is the notes, not how they are played. */
const VELOCITY = 80

/**
 * A question a lesson asks by ear (`ExerciseStep.prompt`): as each such step
 * comes up in a run, the app plays its notes a beat apart, at the lesson's
 * tempo, and only then takes an answer. Hear it again plays them once more.
 * Steps that share one prompt are one question, answered a note a step.
 *
 * The notes are not shown on the keys or sent to the run: they are the
 * question, and the keys are for the answer. What to do is written large in
 * the middle of the stage: Listen while it plays, then the step's `ask`. Its own module, loaded the first
 * time a lesson with questions opens (`Workspace`).
 */
export function StepPrompt() {
  const audio = useAudio()
  const step = useLearningStore((state) =>
    state.session.status === 'running' ? state.exercise?.steps[state.session.stepIndex] : undefined,
  )
  const prompt = step?.prompt
  const runs = useLearningStore((state) => state.runs)
  const prompting = useLearningStore((state) => state.prompting)
  const timers = React.useRef<number[]>([])
  const audioRef = React.useRef(audio)
  audioRef.current = audio

  const quiet = React.useCallback(() => {
    for (const timer of timers.current) window.clearTimeout(timer)
    timers.current = []
    audioRef.current.stopPlayed()
    useLearningStore.getState().setPrompting(false)
  }, [])

  const ask = React.useCallback(
    (notes: readonly number[]) => {
      quiet()
      const beat = 60_000 / Math.max(1, useLearningStore.getState().targetBpm)
      const held = beat * 0.9
      useLearningStore.getState().setPrompting(true)
      notes.forEach((note, index) => {
        const after = BEFORE_MS + index * beat
        // Kept by the audio clock where there is one; by the page where there is not yet.
        if (audioRef.current.play(note, VELOCITY, after, held)) return
        timers.current.push(
          window.setTimeout(() => {
            audioRef.current.noteOn(note, VELOCITY)
            timers.current.push(window.setTimeout(() => audioRef.current.noteOff(note), held))
          }, after),
        )
      })
      timers.current.push(
        window.setTimeout(
          () => useLearningStore.getState().setPrompting(false),
          BEFORE_MS + notes.length * beat,
        ),
      )
    },
    [quiet],
  )

  // Each question as it comes up, and again from the first in a new run. Steps
  // that share one prompt are one question, a tune played back a note a step:
  // it is asked as the first of them comes up, not again at each.
  const asked = React.useRef<{ prompt: readonly number[]; runs: number } | null>(null)
  React.useEffect(() => {
    if (!prompt) {
      asked.current = null
      return
    }
    if (asked.current?.prompt === prompt && asked.current.runs === runs) return
    asked.current = { prompt, runs }
    ask(prompt)
  }, [prompt, runs, ask])
  // Gone, it stops, and forgets what it asked: back, it asks again.
  React.useEffect(
    () => () => {
      asked.current = null
      quiet()
    },
    [quiet],
  )

  if (!prompt) return null
  return (
    <>
      {/* What to do now, large in the middle of a stage with no music on it:
          listen while the question plays, then the step's own few words. */}
      <p className="step-prompt__say" role="status">
        {prompting ? 'Listen' : step.ask}
      </p>
      <div className="step-prompt">
        <Button
          variant="inverse"
          size="sm"
          startIcon={<RotateCcw />}
          disabled={prompting}
          onClick={() => ask(prompt)}
        >
          Hear it again
        </Button>
      </div>
    </>
  )
}

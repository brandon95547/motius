import * as React from 'react'
import { accuracy, practiceSummary } from '@motius/shared'
import { useGoalsStore } from '@/state/goals-store'
import { useHistoryStore } from '@/state/history-store'
import { LEARNING_TOPIC_LABELS, useLearningStore } from '@/state/learning-store'
import { lessonUp } from './use-lesson-settings'
import { useSongStore } from '@/state/song-store'

/**
 * Loads the player's runs and goals, and keeps every run the moment it is finished
 * (`history-store`): an exercise's or a lesson's when its session completes, a
 * song's when Practice reaches its end. Mounted once, by the shell, so a run
 * is kept whatever is on screen.
 *
 * A song's Learn has no score to keep: it waits for every step, so every run
 * of it ends the same.
 */
export function useRunHistory() {
  React.useEffect(() => {
    void useHistoryStore.getState().load()
    void useGoalsStore.getState().load()
    const add = useHistoryStore.getState().add

    const stopRuns = useLearningStore.subscribe((state, before) => {
      if (state.session.status !== 'complete' || before.session.status === 'complete') return
      const { exercise, session, mode, topic, targetBpm } = state
      if (!exercise || mode === 'listen') return
      const score = {
        mode,
        bpm: targetBpm,
        steps: exercise.steps.length,
        accuracy: accuracy(session),
        mistakes: session.mistakes,
        missed: session.missedSteps.length,
        at: Date.now(),
      }
      if (topic === 'lesson') {
        const up = lessonUp()
        if (!up) return
        add({
          ...score,
          kind: 'lesson',
          key: up.key,
          title: up.lesson.lesson.label,
          place: up.category.label,
          opens: `#/${up.key}`,
        })
        return
      }
      add({
        ...score,
        kind: 'exercise',
        key: exercise.id,
        title: exercise.title,
        detail: exercise.subtitle,
        place: LEARNING_TOPIC_LABELS[topic],
        opens: `#/${topic}`,
      })
    })

    const stopSongs = useSongStore.subscribe((state, before) => {
      if (!state.practiced || before.practiced) return
      const song = [...state.library, ...state.builtIn].find((each) => each.id === state.currentId)
      if (!song) return
      const run = practiceSummary(state.practice.results, state.stepCount)
      add({
        at: Date.now(),
        kind: 'song',
        key: song.id,
        title: song.title,
        place: 'Songs',
        opens: '#/songs',
        mode: 'practice',
        bpm: Math.round(song.bpm * state.tempoScale),
        steps: run.total,
        accuracy: run.accuracy,
        mistakes: 0,
        missed: run.missed,
        timing: { onTime: run.onTime, early: run.early, late: run.late },
      })
    })

    return () => {
      stopRuns()
      stopSongs()
      // Signed out: the next one signed in sees only their own.
      useHistoryStore.setState({ runs: [] })
      useGoalsStore.getState().clear()
    }
  }, [])
}

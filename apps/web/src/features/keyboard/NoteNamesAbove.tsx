import { pitchName } from '@motius/shared'
import type { KeyboardLayout } from '@/lib/keyboard-layout'
import { useLearningStore } from '@/state/learning-store'

/**
 * The black keys' names, in a strip just above the keyboard, when the key
 * labels are set to notes, each over its own key. The white keys carry their
 * names on the keys (`PianoKey`); a black key is too narrow to write on. A
 * note the exercise spells its own way (`E♭`, not `D♯`) is named as the
 * exercise spells it; any other black key by its sharp.
 */
export function NoteNamesAbove({ layout }: { layout: KeyboardLayout }) {
  const spelled = useLearningStore((state) => state.exercise?.pitchNames)
  return (
    <div className="key-names" aria-hidden>
      {layout.blackKeys.map((key) => (
        <span
          key={key.note}
          className="key-names__name"
          style={{ left: `${key.leftPercent + key.widthPercent / 2}%` }}
        >
          {(spelled?.[key.note % 12] ?? pitchName(key.note)).replace('#', '♯').replace(/b$/, '♭')}
        </span>
      ))}
    </div>
  )
}

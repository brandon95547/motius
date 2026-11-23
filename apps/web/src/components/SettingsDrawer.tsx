import { ChevronLeft, ChevronRight, Piano, Volume2, VolumeX } from 'lucide-react'
import {
  DEFAULT_FINGERING_SYSTEM,
  FINGERING_SYSTEM_IDS,
  FINGERING_SYSTEMS,
  fingeringSystem,
  isFingeringSystemId,
  noteName,
  type Instrument,
} from '@motius/shared'
import { Drawer } from '@/ui/Drawer'
import { Button, IconButton } from '@/ui/Button'
import { Field, SegmentedControl, Select, Slider, Switch } from '@/ui/Controls'
import { Section } from '@/ui/Surface'
import { Divider } from '@/ui/Display'
import { useAudio } from '@/audio/AudioProvider'
import { EngineChip } from '@/audio/EngineChip'
import { InstrumentSelect } from '@/features/instruments/InstrumentSelect'
import { KEYBOARD_SPANS, canShift } from '@/lib/keyboard-layout'
import { useLearningStore, type KeyLabels } from '@/state/learning-store'
import { AUTO_SPAN, useViewStore } from '@/state/view-store'
import { useCurrentSong, useSongStore, type FingeringDensity } from '@/state/song-store'
import { panelActions, usePanelStore } from '@/state/panel-store'
import { useHandsReminder } from '@/state/hands-reminder'
import { useCrossingTips } from '@/state/crossing-tips'
import { useMidi } from '@/midi/MidiProvider'
import { PanelTempo } from '@/components/PlayControls'

/**
 * How the instrument sounds and how it is shown — everything that changes the
 * view of the practice rather than the practice itself.
 *
 * This is what used to be the toolbar under the keyboard, plus the piano and
 * the volume from the app bar. None of it is touched mid-run, so none of it
 * needs to be on screen while playing; one click away is close enough, and the
 * screen goes to the staff and the keys.
 *
 * Settings that hold on every screen are here on every screen — the sound,
 * the keyboard, the fingering system. What belongs to one kind of music shows
 * with it: a song's staff, an exercise's auto tempo.
 *
 * The tempo and the metronome live on the bar. Where the bar folds one away on
 * a narrow screen, it lands here, and only there (`panel-only-*`, beside the
 * bar's `bar-*`): one place for each at every width. Record folds into the
 * bar's menu instead.
 */
export function SettingsDrawer({
  instruments,
  selectedId,
  onSelectInstrument,
  catalogueFailed,
}: {
  instruments: readonly Instrument[]
  selectedId: string | null
  onSelectInstrument: (instrument: Instrument) => void
  catalogueFailed: boolean
}) {
  const open = usePanelStore((state) => state.panel === 'settings')
  const close = usePanelStore((state) => state.close)
  const songs = useLearningStore((state) => state.topic === 'songs')
  const song = useCurrentSong()

  return (
    <Drawer
      open={open}
      onClose={close}
      title="Settings"
      description="How the piano sounds and how the keys and staff are shown."
    >
      <div className="flex flex-col gap-6">
        <SoundSection
          instruments={instruments}
          selectedId={selectedId}
          onSelectInstrument={onSelectInstrument}
          catalogueFailed={catalogueFailed}
        />
        <Divider />
        <KeyboardSection />
        <Divider />
        {songs && song && (
          <>
            <StaffSection />
            <Divider />
          </>
        )}
        {/* A song with no fingering in its file is fingered by the same
            system, so it is chosen here wherever you are. */}
        <FingeringSection />
        <Divider />
        {!songs ? (
          <>
            <PracticeSection />
            <Divider />
          </>
        ) : (
          song && (
            // Only its tempo and click, and only where the bar has folded them.
            <div className="panel-only-mid flex flex-col gap-6">
              <Section title="Song">
                <PanelTempo />
              </Section>
              <Divider />
            </div>
          )
        )}
        <Section title="Keyboard & MIDI" description={<MidiLine />}>
          <Button
            variant="outlined"
            size="sm"
            startIcon={<Piano />}
            className="self-start"
            onClick={() => panelActions.open('devices')}
          >
            Keyboard & MIDI setup
          </Button>
        </Section>
      </div>
    </Drawer>
  )
}

function SoundSection({
  instruments,
  selectedId,
  onSelectInstrument,
  catalogueFailed,
}: {
  instruments: readonly Instrument[]
  selectedId: string | null
  onSelectInstrument: (instrument: Instrument) => void
  catalogueFailed: boolean
}) {
  const audio = useAudio()
  const muted = audio.volume === 0
  return (
    <Section title="Sound" actions={<EngineChip />}>
      <Field label="Piano">
        <InstrumentSelect
          instruments={instruments}
          selectedId={selectedId}
          onSelect={onSelectInstrument}
          failed={catalogueFailed}
        />
      </Field>
      <div className="flex items-end gap-2">
        <div className="min-w-0 flex-1">
          <Slider
            label="Volume"
            min={0}
            max={100}
            value={Math.round(audio.volume * 100)}
            formatValue={(value) => `${value}%`}
            onChange={(value) => audio.setVolume(value / 100)}
          />
        </div>
        <IconButton
          label={muted ? 'Unmute' : 'Mute'}
          icon={muted ? <VolumeX /> : <Volume2 />}
          size="sm"
          variant="outlined"
          onClick={() => audio.setVolume(muted ? 0.8 : 0)}
        />
      </div>
    </Section>
  )
}

function KeyboardSection() {
  const spanId = useViewStore((state) => state.spanId)
  const setSpanId = useViewStore((state) => state.setSpanId)
  const autoSpanLabel = useViewStore((state) => state.autoSpanLabel)
  const follow = useViewStore((state) => state.follow)
  const setFollow = useViewStore((state) => state.setFollow)
  const handsReminder = useHandsReminder((state) => state.show)
  const setHandsReminder = useHandsReminder((state) => state.setShow)
  const crossingTips = useCrossingTips((state) => state.show)
  const setCrossingTips = useCrossingTips((state) => state.setShow)
  const window = useViewStore((state) => state.window)
  const shiftOctave = useViewStore((state) => state.shiftOctave)
  const keyLabels = useLearningStore((state) => state.keyLabels)
  const setKeyLabels = useLearningStore((state) => state.setKeyLabels)
  const showStructure = useLearningStore((state) => state.showStructure)
  const setShowStructure = useLearningStore((state) => state.setShowStructure)
  const hasStructure = useLearningStore((state) => Boolean(state.exercise?.tetrachordGroups))

  return (
    <Section title="Keyboard">
      <Field label="Visible range" htmlFor="span-select">
        <div className="flex items-center gap-2 coarse:gap-3">
          <Select
            id="span-select"
            size="sm"
            className="min-w-[9rem]"
            value={spanId}
            onChange={(event) => setSpanId(event.target.value)}
            options={[
              { value: AUTO_SPAN, label: `Auto — ${autoSpanLabel}` },
              ...KEYBOARD_SPANS.map((option) => ({ value: option.id, label: option.label })),
            ]}
          />
          <IconButton
            label="Octave down"
            icon={<ChevronLeft />}
            size="sm"
            variant="outlined"
            disabled={!canShift(window, -1)}
            onClick={() => shiftOctave(-1)}
          />
          <span
            className="min-w-[5.5rem] text-center text-label-sm text-[var(--ds-fg-muted)]"
            data-tabular
            aria-live="polite"
          >
            {noteName(window.low)} – {noteName(window.high)}
          </span>
          <IconButton
            label="Octave up"
            icon={<ChevronRight />}
            size="sm"
            variant="outlined"
            disabled={!canShift(window, 1)}
            onClick={() => shiftOctave(1)}
          />
        </div>
      </Field>
      <Switch
        label="Follow"
        description="Move the view to whatever you play, and to the note you are asked for."
        checked={follow}
        onChange={setFollow}
      />
      <Field label="Key labels">
        <SegmentedControl<KeyLabels>
          label="Key labels"
          value={keyLabels}
          onChange={setKeyLabels}
          options={[
            { value: 'off', label: 'Off' },
            { value: 'notes', label: 'Notes' },
            { value: 'degrees', label: 'Degrees' },
            { value: 'fingers', label: 'Fingers' },
          ]}
        />
      </Field>
      <Switch
        label="Hands reminder"
        description="Show which hand is which color before the notes fall."
        checked={handsReminder}
        onChange={setHandsReminder}
      />
      <Switch
        label="Crossing tips"
        description="Show how to cross the thumb under, or a finger over, when a lesson first asks."
        checked={crossingTips}
        onChange={setCrossingTips}
      />
      <Switch
        label="Structure"
        description={
          hasStructure
            ? 'Separate the two four-note groups this scale is built from.'
            : 'Only for a scale built from two matching halves.'
        }
        checked={showStructure && hasStructure}
        onChange={(checked) => hasStructure && setShowStructure(checked)}
      />
    </Section>
  )
}

/**
 * How a song's score is laid out and fingered. What is above the keys — the
 * staff or falling notes — is chosen on the bar, beside this panel's button.
 */
function StaffSection() {
  const staffView = useSongStore((state) => state.staffView)
  const setStaffView = useSongStore((state) => state.setStaffView)
  const fingering = useSongStore((state) => state.fingering)
  const setFingering = useSongStore((state) => state.setFingering)

  return (
    <Section title="Staff">
      {/* Only where there is a score to lay out and fingering to print. A scale
          is one line of notes with its fingering on the keys. */}
      <>
        <Field label="Score layout">
          <SegmentedControl
            label="Score layout"
            value={staffView}
            onChange={setStaffView}
            options={[
              { value: 'sheet', label: 'Sheet' },
              { value: 'flow', label: 'Flow' },
            ]}
          />
        </Field>
        <Field label="Fingering on the staff">
          <SegmentedControl<FingeringDensity>
            label="Fingering on the staff"
            value={fingering}
            onChange={setFingering}
            options={[
              { value: 'all', label: 'All' },
              { value: 'hints', label: 'Key' },
              { value: 'off', label: 'Off' },
            ]}
          />
        </Field>
      </>
    </Section>
  )
}

/**
 * Whose fingering the recommended numbers are.
 *
 * A select with one entry, on purpose. It says where the numbers come from,
 * which is worth knowing even before there is a choice — and the next system
 * is then an option in this list rather than a new control.
 */
function FingeringSection() {
  const system = useLearningStore((state) => state.fingeringSystem)
  const setSystem = useLearningStore((state) => state.setFingeringSystem)
  return (
    <Section title="Fingering">
      <Field
        label="Fingering system"
        htmlFor="fingering-system"
        hint={fingeringSystem(system).description}
      >
        <Select
          id="fingering-system"
          size="sm"
          value={system}
          onChange={(event) => {
            if (isFingeringSystemId(event.target.value)) setSystem(event.target.value)
          }}
          options={FINGERING_SYSTEM_IDS.map((id) => {
            const { name } = FINGERING_SYSTEMS[id]
            return {
              value: id,
              label: id === DEFAULT_FINGERING_SYSTEM ? `${name} (Default)` : name,
            }
          })}
        />
      </Field>
    </Section>
  )
}

function PracticeSection() {
  const autoTempo = useLearningStore((state) => state.autoTempo)
  const setAutoTempo = useLearningStore((state) => state.setAutoTempo)
  return (
    <Section title="Practice">
      <PanelTempo />
      <Switch
        label="Auto tempo"
        description="Raises the target after a clean run at this speed, and eases off after a scrappy one."
        checked={autoTempo}
        onChange={setAutoTempo}
      />
    </Section>
  )
}

/** Whether a MIDI keyboard is connected — the bar's readout, for when the bar has folded it away. */
function MidiLine() {
  const midi = useMidi()
  const connected = midi.connectedPorts.length
  if (connected === 0) return <>No MIDI keyboard connected. The on-screen keys always work.</>
  if (connected === 1) return <>{midi.connectedPorts[0]?.name ?? 'A keyboard'} is connected.</>
  return <>{connected} keyboards are connected.</>
}

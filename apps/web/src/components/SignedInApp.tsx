import { AudioProvider } from '@/audio/AudioProvider'
import { MidiProvider } from '@/midi/MidiProvider'
import { AppShell } from './AppShell'

/** Everything a signed-in player has: the sound, the keyboards plugged in, and the app. */
export function SignedInApp() {
  return (
    <AudioProvider>
      <MidiProvider>
        <AppShell />
      </MidiProvider>
    </AudioProvider>
  )
}

import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SCALE_GROUPS, SCALE_TYPES } from '@sonara/shared'
import { ScaleOptions } from '@/features/learning/ScaleControls'
import { ScaleTheoryDialog } from '@/features/learning/ScaleTheoryDialog'
import { useLearningStore } from '@/state/learning-store'
import { Combobox } from '@/ui/Controls'

globalThis.matchMedia ??= ((query: string) => ({
  matches: false,
  media: query,
  addEventListener() {},
  removeEventListener() {},
  addListener() {},
  removeListener() {},
  dispatchEvent: () => false,
  onchange: null,
})) as unknown as typeof globalThis.matchMedia

afterEach(cleanup)

const store = () => useLearningStore.getState()

/**
 * The field a long list is chosen from by typing.
 *
 * A hundred and twenty scales do not fit a select: the one wanted is forty
 * rows down, under a name that may not be the one the player knows it by.
 */
describe('the combobox', () => {
  const options = [
    { value: 'major', label: 'Major', group: 'Major and minor', also: ['Ionian'] },
    { value: 'minor', label: 'Natural Minor', group: 'Major and minor', also: ['Aeolian'] },
    { value: 'lydian', label: 'Lydian', group: 'Modes' },
    { value: 'acoustic', label: 'Lydian Dominant', group: 'Modes', also: ['Acoustic', 'Overtone'] },
    { value: 'hirajoshi', label: 'Hirajōshi', group: 'Japanese' },
  ]
  const mount = (value = 'major') => {
    const onChange = vi.fn()
    render(<Combobox aria-label="Scale" options={options} value={value} onChange={onChange} />)
    return { field: screen.getByRole('combobox', { name: 'Scale' }) as HTMLInputElement, onChange }
  }
  const listed = () => screen.getAllByRole('option').map((option) => option.textContent)

  it('shows the choice, and opened without typing lists everything under its headings', () => {
    const { field } = mount('lydian')
    expect(field.value).toBe('Lydian')
    expect(screen.queryByRole('listbox')).toBeNull()

    fireEvent.focus(field)
    expect(listed()).toEqual(['Major', 'Natural Minor', 'Lydian', 'Lydian Dominant', 'Hirajōshi'])
    const list = screen.getByRole('listbox')
    expect(
      [...list.querySelectorAll('[role="presentation"]')].map((heading) => heading.textContent),
    ).toEqual(['Major and minor', 'Modes', 'Japanese'])
    // Opened where the player is, not at the top.
    const chosen = within(list).getByRole('option', { selected: true })
    expect(chosen.textContent).toBe('Lydian')
    expect(field.getAttribute('aria-activedescendant')).toBe(chosen.id)
  })

  it('narrows to what is typed, a name that begins with it first, without minding case or accents', () => {
    const { field } = mount()
    fireEvent.focus(field)
    fireEvent.change(field, { target: { value: 'LYD' } })
    expect(listed()).toEqual(['LydianModes', 'Lydian DominantModes'])
    fireEvent.change(field, { target: { value: 'hirajo' } })
    expect(listed()).toEqual(['HirajōshiJapanese'])
    fireEvent.change(field, { target: { value: 'zzz' } })
    expect(screen.queryAllByRole('option')).toEqual([])
    expect(screen.getByRole('listbox').textContent).toBe('No matches')
  })

  it('finds an option by another of its names, and says which one', () => {
    const { field, onChange } = mount()
    fireEvent.focus(field)
    fireEvent.change(field, { target: { value: 'overt' } })
    expect(listed()).toEqual(['Lydian DominantAlso called Overtone'])
    fireEvent.keyDown(field, { key: 'Enter' })
    expect(onChange).toHaveBeenCalledWith('acoustic')
    expect(screen.queryByRole('listbox')).toBeNull()
  })

  it('moves through the list with the arrows and chooses with Enter', () => {
    const { field, onChange } = mount('major')
    fireEvent.focus(field)
    fireEvent.keyDown(field, { key: 'ArrowDown' })
    fireEvent.keyDown(field, { key: 'ArrowDown' })
    fireEvent.keyDown(field, { key: 'ArrowUp' })
    fireEvent.keyDown(field, { key: 'Enter' })
    expect(onChange).toHaveBeenCalledWith('minor')
  })

  it('chooses the option that is pressed', () => {
    const { field, onChange } = mount()
    fireEvent.focus(field)
    fireEvent.click(screen.getByRole('option', { name: 'Hirajōshi' }))
    expect(onChange).toHaveBeenCalledWith('hirajoshi')
  })

  it('shuts on Escape with the choice put back, and keeps the Escape from what it is inside', () => {
    const behind = vi.fn()
    document.addEventListener('keydown', behind)
    const { field, onChange } = mount('lydian')
    fireEvent.focus(field)
    fireEvent.change(field, { target: { value: 'hira' } })
    fireEvent.keyDown(field, { key: 'Escape' })
    document.removeEventListener('keydown', behind)

    expect(screen.queryByRole('listbox')).toBeNull()
    expect(field.value).toBe('Lydian')
    expect(onChange).not.toHaveBeenCalled()
    // The panel it is in closes on Escape too, and must not close for this one.
    expect(behind).not.toHaveBeenCalled()
  })

  it('puts the choice back when it is left without choosing', () => {
    const { field, onChange } = mount('lydian')
    fireEvent.focus(field)
    fireEvent.change(field, { target: { value: 'maj' } })
    fireEvent.blur(field)
    expect(field.value).toBe('Lydian')
    expect(onChange).not.toHaveBeenCalled()
  })
})

describe('choosing a scale', () => {
  const open = () => {
    act(() => {
      store().setTopic('scales')
      store().updateSpec({ rootPitchClass: 0, scaleTypeId: 'major', tonic: undefined })
    })
    render(<ScaleOptions />)
    return screen.getByRole('combobox', { name: 'Scale' }) as HTMLInputElement
  }

  it('lists every scale once, under the groups in their order', () => {
    const field = open()
    fireEvent.focus(field)
    // The key beside it is a select with options of its own.
    const list = screen.getByRole('listbox')
    expect(within(list).getAllByRole('option')).toHaveLength(SCALE_TYPES.length)
    const headings = [...list.querySelectorAll('[role="presentation"]')].map(
      (heading) => heading.textContent,
    )
    expect(headings).toEqual(SCALE_GROUPS.map((group) => group.label))
  })

  it('finds a scale by the name a book gives it, and sets it', () => {
    const field = open()
    fireEvent.focus(field)
    // Hewitt's "Acoustic" is the scale every other book calls Lydian Dominant.
    fireEvent.change(field, { target: { value: 'acoustic' } })
    expect(
      within(screen.getByRole('listbox'))
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['Lydian DominantAlso called Acoustic'])
    fireEvent.keyDown(field, { key: 'Enter' })
    expect(store().spec.scaleTypeId).toBe('lydian-dominant')
    expect(field.value).toBe('Lydian Dominant')
  })

  it('says in the theory panel what a scale is and what else it is called', () => {
    act(() => {
      store().setTopic('scales')
      store().updateSpec({ rootPitchClass: 0, scaleTypeId: 'lydian-dominant', tonic: undefined })
    })
    render(<ScaleTheoryDialog open onClose={() => {}} />)
    const about = screen.getByRole('heading', { name: 'About this scale' }).parentElement!
    expect(about.textContent).toContain('Fourth mode of the melodic minor.')
    expect(about.textContent).toContain(
      'Also called Acoustic, Overtone, Lydian ♭7, and Vachaspati.',
    )
  })
})

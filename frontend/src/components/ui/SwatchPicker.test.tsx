// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SwatchPicker } from './SwatchPicker'

/**
 * Regression (Phase 4): the <legend> was wrapped in a <div>, so the radio group had no accessible
 * name ("Paint Shade" etc. were never announced). The same markup exists in Moonlight (sync log).
 */
afterEach(() => cleanup())

const options = [
  { id: 'a', label: 'Ivory Mist', hex: '#F0EBE4' },
  { id: 'b', label: 'Charcoal', hex: '#6F6A64' },
]

describe('SwatchPicker', () => {
  it('names the radio group with its label, and each swatch with its colour name', () => {
    render(
      <SwatchPicker label="Paint Shade" options={options} value="a" onChange={() => {}} aside="Ivory Mist" />,
    )
    const group = screen.getByRole('group', { name: 'Paint Shade' })
    const radios = within(group).getAllByRole('radio')
    expect(radios.map((r) => r.getAttribute('aria-label'))).toEqual(['Ivory Mist', 'Charcoal'])
    expect((radios[0] as HTMLInputElement).checked).toBe(true)
    // The legend is the fieldset's first element child (required for it to name the group).
    expect(group.firstElementChild?.tagName).toBe('LEGEND')
  })

  // Regression (Phase 4 audit): an absolutely positioned aside overlapped the swatches in narrow grid
  // columns. It must be laid out inside the legend (takes space) and stay out of the group's name.
  it('lays the selected-name aside out inside the legend, without changing the group name', () => {
    render(
      <SwatchPicker label="Paint Shade" options={options} value="a" onChange={() => {}} aside="Ivory Mist" />,
    )
    const group = screen.getByRole('group', { name: 'Paint Shade' }) // aside not part of the name
    const legend = group.querySelector('legend')
    const aside = within(group).getByText('Ivory Mist', { selector: 'span' })
    expect(legend?.contains(aside)).toBe(true)
    expect(aside.getAttribute('aria-hidden')).toBe('true')
    expect(aside.className).not.toMatch(/\babsolute\b/)
  })

  it('reports the chosen id and disables every swatch when disabled', () => {
    const onChange = vi.fn<(id: string) => void>()
    const { rerender } = render(
      <SwatchPicker label="Mount Colour" options={options} value="a" onChange={onChange} />,
    )
    fireEvent.click(screen.getByRole('radio', { name: 'Charcoal' }))
    expect(onChange).toHaveBeenCalledWith('b')
    rerender(<SwatchPicker label="Mount Colour" options={options} value="a" onChange={onChange} disabled />)
    // Disabled through the fieldset (inherited): `:disabled` matches even though `.disabled` is false.
    for (const r of screen.getAllByRole('radio')) expect(r.matches(':disabled')).toBe(true)
  })
})

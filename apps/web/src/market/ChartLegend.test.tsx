import { fireEvent, render, screen } from '@testing-library/react'
import ChartLegend from './ChartLegend'

const allOn = { spx: true, ndx: true, dji: true, vix: true }

describe('ChartLegend', () => {
  it('shows up and down entries in the status colours (AC 7, 14, 15)', () => {
    render(<ChartLegend visible={allOn} onToggle={() => {}} />)
    expect(screen.getByRole('group', { name: 'Chart legend' })).toBeInTheDocument()
    expect(screen.getByText('▲ Increasing line')).toHaveClass('badge-success')
    expect(screen.getByText('▼ Decreasing line')).toHaveClass('badge-danger')
  })

  it('reports toggles by index id (AC 8, 9)', () => {
    const onToggle = vi.fn()
    render(<ChartLegend visible={{ ...allOn, ndx: false }} onToggle={onToggle} />)
    expect(screen.getByRole('button', { name: 'Nasdaq' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: 'VIX (right axis)' })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(screen.getByRole('button', { name: 'Nasdaq' }))
    expect(onToggle).toHaveBeenCalledWith('ndx')
  })
})

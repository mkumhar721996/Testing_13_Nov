import { fireEvent, render, screen, within } from '@testing-library/react'
import TopBar from './TopBar'

describe('TopBar', () => {
  it('lists the main sections in order, without an Account entry', () => {
    render(<TopBar />)
    const nav = screen.getByRole('navigation', { name: 'Main' })
    expect(within(nav).getAllByRole('link').map((a) => a.textContent)).toEqual(['Dashboard', 'Projects', 'Reports', 'Settings'])
    expect(screen.queryByText('Account')).not.toBeInTheDocument()
  })

  it('collapses the navigation behind a menu button', () => {
    render(<TopBar />)
    const menu = screen.getByRole('button', { name: 'Menu' })
    expect(menu).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(menu)
    expect(menu).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('navigation', { name: 'Main' })).toHaveClass('is-open')
    fireEvent.click(menu)
    expect(menu).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByRole('navigation', { name: 'Main' })).not.toHaveClass('is-open')
  })

  it('marks Dashboard as the current section and keeps the other links inert', () => {
    render(<TopBar />)
    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Projects' })).not.toHaveAttribute('aria-current')
    const click = fireEvent.click(screen.getByRole('link', { name: 'Projects' }))
    expect(click).toBe(false) // default prevented: no navigation yet
  })
})

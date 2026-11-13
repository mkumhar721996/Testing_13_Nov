import { useState } from 'react'
import './top-bar.css'

const SECTIONS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'projects', label: 'Projects' },
  { id: 'reports', label: 'Reports' },
  { id: 'settings', label: 'Settings' },
  { id: 'account', label: 'Account', className: 'topnav-account' },
]

export default function TopBar() {
  const [open, setOpen] = useState(false)

  return (
    <header className="topbar" data-wf-id="top-bar">
      <div className="container topbar-inner">
        <strong className="topbar-title">Expenses</strong>
        <button
          type="button"
          className="btn btn-secondary topbar-menu"
          aria-expanded={open}
          aria-controls="main-nav"
          onClick={() => setOpen((o) => !o)}
        >
          Menu
        </button>
        <nav id="main-nav" className={`topnav${open ? ' is-open' : ''}`} aria-label="Main">
          {SECTIONS.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              className={`topnav-link${s.className ? ` ${s.className}` : ''}`}
              onClick={(e) => e.preventDefault()}
              aria-current={s.id === 'dashboard' ? 'page' : undefined}
            >
              {s.label}
            </a>
          ))}
        </nav>
      </div>
    </header>
  )
}

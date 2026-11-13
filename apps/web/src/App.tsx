import { useState } from 'react'
import AddExpenseForm from './expenses/AddExpenseForm'
import ExpenseDetail from './expenses/ExpenseDetail'
import ExpenseList, { emptyQuery } from './expenses/ExpenseList'

type View = { view: 'list' } | { view: 'detail'; id: string } | { view: 'add' }

export default function App() {
  const [current, setCurrent] = useState<View>({ view: 'list' })
  // The list's filters and page live here so they survive a trip to the detail view.
  const [query, setQuery] = useState(emptyQuery)
  const toList = () => setCurrent({ view: 'list' })

  return (
    <main>
      {current.view === 'list' && (
        <ExpenseList
          initialQuery={query}
          onQueryChange={setQuery}
          onOpen={(id) => setCurrent({ view: 'detail', id })}
          onAdd={() => setCurrent({ view: 'add' })}
        />
      )}
      {current.view === 'detail' && <ExpenseDetail id={current.id} onBack={toList} />}
      {current.view === 'add' && (
        <>
          <div className="container">
            <button type="button" className="btn btn-ghost" onClick={toList}>
              Back to expenses
            </button>
          </div>
          <AddExpenseForm />
        </>
      )}
    </main>
  )
}

import AddExpenseForm from './expenses/AddExpenseForm'
import OrganizationPage from './organization/OrganizationPage'

// No router is installed: the Organization screen is the one path parsed by hand.
const organizationPath = /^\/organizations\/([^/]+)\/?$/

export default function App() {
  const organizationId = organizationPath.exec(window.location.pathname)?.[1]
  return <main>{organizationId ? <OrganizationPage organizationId={organizationId} /> : <AddExpenseForm />}</main>
}

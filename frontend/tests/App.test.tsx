import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, it, expect } from 'vitest'
import App from '../src/App'

function renderWithProviders() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  )
}

describe('App', () => {
  it('renders the app title', () => {
    renderWithProviders()
    expect(screen.getByText('Laplace')).toBeInTheDocument()
  })

  it('renders the data input screen by default', () => {
    renderWithProviders()
    expect(screen.getByText('Upload Your Data')).toBeInTheDocument()
  })

  it('shows the Boardroom/Lab toggle', () => {
    renderWithProviders()
    expect(screen.getByText('Boardroom')).toBeInTheDocument()
    expect(screen.getByText('Lab')).toBeInTheDocument()
  })
})

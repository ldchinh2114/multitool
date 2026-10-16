import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ErrorBoundary } from '@/components/ErrorBoundary'

const ThrowError = ({ message }: { message: string }) => {
  throw new Error(message)
}

describe('ErrorBoundary', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('renders children when no error', () => {
    render(
      <ErrorBoundary>
        <div>Child content</div>
      </ErrorBoundary>
    )
    expect(screen.getByText('Child content')).toBeDefined()
  })

  it('renders default fallback on error', () => {
    render(
      <ErrorBoundary>
        <ThrowError message="Test error" />
      </ErrorBoundary>
    )
    expect(screen.getByText('Something went wrong')).toBeDefined()
    expect(screen.getByText('Reload Page')).toBeDefined()
  })

  it('renders custom fallback on error', () => {
    render(
      <ErrorBoundary fallback={<div>Custom error UI</div>}>
        <ThrowError message="Test error" />
      </ErrorBoundary>
    )
    expect(screen.getByText('Custom error UI')).toBeDefined()
  })

  it('shows the error message in the details section', () => {
    render(
      <ErrorBoundary>
        <ThrowError message="Boom" />
      </ErrorBoundary>
    )
    expect(screen.getByText('Error details')).toBeDefined()
    expect(screen.getByText('Boom')).toBeDefined()
  })
})

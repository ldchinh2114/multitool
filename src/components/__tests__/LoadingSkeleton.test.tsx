import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { LoadingSkeleton, CardSkeleton } from '@/components/LoadingSkeleton'

describe('LoadingSkeleton', () => {
  it('renders a single skeleton by default', () => {
    const { container } = render(<LoadingSkeleton />)
    const skeletons = container.querySelectorAll('.animate-pulse')
    expect(skeletons.length).toBe(1)
  })

  it('renders multiple skeletons based on count', () => {
    const { container } = render(<LoadingSkeleton count={3} />)
    const skeletons = container.querySelectorAll('.animate-pulse')
    expect(skeletons.length).toBe(3)
  })

  it('applies variant classes', () => {
    const { container } = render(<LoadingSkeleton variant="card" />)
    const skeleton = container.querySelector('.animate-pulse')
    expect(skeleton?.className).toContain('h-32')
  })

  it('applies circular variant', () => {
    const { container } = render(<LoadingSkeleton variant="circular" />)
    const skeleton = container.querySelector('.animate-pulse')
    expect(skeleton?.className).toContain('rounded-full')
  })

  it('applies custom className', () => {
    const { container } = render(<LoadingSkeleton className="my-custom-class" />)
    const wrapper = container.firstChild as HTMLElement
    expect(wrapper.className).toContain('my-custom-class')
  })
})

describe('CardSkeleton', () => {
  it('renders circular and text skeletons', () => {
    const { container } = render(<CardSkeleton />)
    const skeletons = container.querySelectorAll('.animate-pulse')
    expect(skeletons.length).toBe(3)
  })
})

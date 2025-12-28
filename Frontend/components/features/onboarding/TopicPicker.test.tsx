import { render, screen, fireEvent } from '@testing-library/react'
import { TopicPicker } from './TopicPicker'

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
  }),
}))

// Mock auth store
jest.mock('@/lib/authStore', () => ({
  useAuthStore: () => ({
    user: { email: 'test@example.com' },
    setUser: jest.fn(),
  }),
}))

describe('TopicPicker Component', () => {
  it('renders correctly with regional settings', () => {
    render(<TopicPicker initialTopics={[]} />)
    
    // Check if topics are rendered
    expect(screen.getByText('Technology')).toBeInTheDocument()
    expect(screen.getByText('Regional Settings')).toBeInTheDocument()
  })

  it('allows toggling a topic', () => {
    render(<TopicPicker initialTopics={[]} />)
    
    const techButton = screen.getByText('Technology')
    fireEvent.click(techButton)
    
    expect(techButton).toHaveClass('bg-primary')
  })
})

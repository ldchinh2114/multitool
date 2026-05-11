import { describe, it, expect } from 'vitest'
import { initialResumeData } from '@/lib/resume-types'

describe('initialResumeData', () => {
  it('has a profile with all required fields', () => {
    expect(initialResumeData.profile).toBeDefined()
    expect(typeof initialResumeData.profile.name).toBe('string')
    expect(typeof initialResumeData.profile.title).toBe('string')
    expect(typeof initialResumeData.profile.email).toBe('string')
    expect(typeof initialResumeData.profile.phone).toBe('string')
    expect(typeof initialResumeData.profile.location).toBe('string')
    expect(typeof initialResumeData.profile.website).toBe('string')
    expect(typeof initialResumeData.profile.linkedin).toBe('string')
    expect(typeof initialResumeData.profile.facebook).toBe('string')
    expect(typeof initialResumeData.profile.summary).toBe('string')
  })

  it('has initial work experience', () => {
    expect(initialResumeData.work).toHaveLength(1)
    expect(initialResumeData.work[0].company).toBe('Type company name')
    expect(initialResumeData.work[0].position).toBe('Type your position')
    expect(initialResumeData.work[0].id).toBe('1')
  })

  it('has initial project', () => {
    expect(initialResumeData.projects).toHaveLength(1)
    expect(initialResumeData.projects[0].name).toBe('Type project name')
  })

  it('has initial education', () => {
    expect(initialResumeData.education).toHaveLength(1)
    expect(initialResumeData.education[0].school).toBe('Type school/university name')
    expect(initialResumeData.education[0].gpa).toBe('')
    expect(initialResumeData.education[0].academicRank).toBe('')
  })

  it('has empty certifications and languages', () => {
    expect(initialResumeData.certifications).toEqual([])
    expect(initialResumeData.languages).toEqual([])
  })

  it('has default skills string', () => {
    expect(initialResumeData.skills).toContain('Type your skill')
  })
})

import { describe, expect, it } from 'vitest'
import { recruiterFromSearch } from '../src/urlFlags.js'

describe('?recruiter', () => {
  it('is undefined when absent, so the remembered choice applies', () => {
    expect(recruiterFromSearch('')).toBeUndefined()
    expect(recruiterFromSearch('?utm_source=x')).toBeUndefined()
  })

  it.each(['?recruiter', '?recruiter=', '?recruiter=1', '?recruiter=true', '?recruiter=yes', '?a=b&recruiter'])(
    '%s turns recruiter mode on',
    (search) => expect(recruiterFromSearch(search)).toBe(true),
  )

  it.each(['?recruiter=0', '?recruiter=false', '?recruiter=FALSE', '?recruiter=off', '?recruiter=no', '?recruiter=%200%20'])(
    '%s keeps the normal view',
    (search) => expect(recruiterFromSearch(search)).toBe(false),
  )
})

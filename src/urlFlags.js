// Reads ?recruiter from the URL: true / false when it is there, undefined when it is not
// (then the remembered choice applies). `?recruiter`, `?recruiter=1` and any other value turn
// recruiter mode on; `0`, `false`, `off` and `no` keep the normal view.
export function recruiterFromSearch(search) {
  const params = new URLSearchParams(search)
  if (!params.has('recruiter')) return undefined
  return !/^(0|false|off|no)$/i.test(params.get('recruiter').trim())
}

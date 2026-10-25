import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from 'react'
import { useOutletContext } from 'react-router'
import {
  createJob,
  deleteAllJobs,
  deleteJob,
  listFreeModels,
  listJobs,
  updateJob,
} from '../api.ts'
import { ModelPicker } from '../components/ModelPicker.tsx'
import {
  JOB_STATES,
  type FreeModel,
  type JobState,
  type LayoutContext,
  type ProducerJob,
  type ProducerPayload,
} from '../types.ts'

const emptyForm: ProducerPayload = { name: '', description: '', model: '' }
const PAGE_SIZE = 20

export function ProducerPage() {
  const { refreshStatus, status } = useOutletContext<LayoutContext>()
  const [tab, setTab] = useState<JobState>('completed')
  const [jobs, setJobs] = useState<ProducerJob[]>([])
  const [models, setModels] = useState<FreeModel[]>([])
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState(emptyForm)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [nextOffset, setNextOffset] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  const requestIdRef = useRef(0)
  const fetchingRef = useRef(false)

  const loadPage = useCallback(
    async (state: JobState, start: number, append: boolean) => {
      if (append && fetchingRef.current) return
      fetchingRef.current = true
      const requestId = ++requestIdRef.current
      setLoading(true)
      setLoadingMore(append)
      if (!append) {
        setError(null)
        setJobs([])
        setNextOffset(0)
        setHasMore(true)
        setEditingId(null)
      }
      try {
        const page = await listJobs({
          state,
          offset: start,
          limit: PAGE_SIZE,
        })
        if (requestId !== requestIdRef.current) return
        setJobs((current) => (append ? [...current, ...page.items] : page.items))
        setNextOffset(start + page.items.length)
        setHasMore(start + page.items.length < page.total)
      } catch (err) {
        if (requestId !== requestIdRef.current) return
        setError(err instanceof Error ? err.message : 'Failed to load jobs')
      } finally {
        if (requestId === requestIdRef.current) {
          fetchingRef.current = false
          setLoading(false)
          setLoadingMore(false)
        }
      }
    },
    [],
  )

  async function reload() {
    fetchingRef.current = false
    await loadPage(tab, 0, false)
    await refreshStatus()
  }

  useEffect(() => {
    let cancelled = false
    void listFreeModels()
      .then((next) => {
        if (cancelled) return
        setModels(next)
        setForm((current) =>
          current.model ? current : { ...current, model: next[0]?.id ?? '' },
        )
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : 'Failed to load free models',
          )
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    fetchingRef.current = false
    void loadPage(tab, 0, false)
  }, [loadPage, tab])

  useEffect(() => {
    const node = sentinelRef.current
    if (!node || loading || !hasMore || jobs.length === 0) return
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return
      void loadPage(tab, nextOffset, true)
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [hasMore, jobs.length, loading, loadPage, nextOffset, tab])

  async function onCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await createJob(form)
      setForm((current) => ({ ...emptyForm, model: current.model }))
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to enqueue job')
    } finally {
      setBusy(false)
    }
  }

  async function onSaveEdit(id: string) {
    setBusy(true)
    setError(null)
    try {
      await updateJob(id, editForm)
      setEditingId(null)
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update job')
    } finally {
      setBusy(false)
    }
  }

  async function onDelete(id: string) {
    setBusy(true)
    setError(null)
    try {
      await deleteJob(id)
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete job')
    } finally {
      setBusy(false)
    }
  }

  async function onClearAll() {
    setBusy(true)
    setError(null)
    try {
      await deleteAllJobs()
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clear jobs')
    } finally {
      setBusy(false)
    }
  }

  const queueEmpty = status ? status.total === 0 : jobs.length === 0

  return (
    <section className="page">
      <header className="page-header">
        <div>
          <h1>Producer</h1>
          <p className="muted">Enqueue jobs and inspect what is on the queue.</p>
        </div>
        <button
          type="button"
          className="danger"
          onClick={() => void onClearAll()}
          disabled={busy || queueEmpty}
        >
          Clear all
        </button>
      </header>

      {error ? <p className="error">{error}</p> : null}

      <form className="card form" onSubmit={(event) => void onCreate(event)}>
        <h2>New job</h2>
        <label>
          Name
          <input
            name="name"
            value={form.name}
            onChange={(event) =>
              setForm((current) => ({ ...current, name: event.target.value }))
            }
            required
          />
        </label>
        <ModelPicker
          label="Model"
          models={models}
          value={form.model}
          onChange={(model) =>
            setForm((current) => ({ ...current, model }))
          }
        />
        <label>
          Description
          <textarea
            name="description"
            value={form.description}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                description: event.target.value,
              }))
            }
            required
            rows={3}
          />
        </label>
        <button type="submit" disabled={busy || !form.model}>
          Enqueue
        </button>
      </form>

      <div className="job-tabs" role="tablist" aria-label="Job state">
        {JOB_STATES.map((state) => (
          <button
            key={state}
            type="button"
            role="tab"
            aria-selected={tab === state}
            onClick={() => setTab(state)}
          >
            {state}
            <span className="job-tab-count">{status?.[state] ?? 0}</span>
          </button>
        ))}
      </div>

      <div className="job-list" role="tabpanel">
        {jobs.length === 0 && !loading ? (
          <p className="muted">No {tab} jobs.</p>
        ) : null}
        {jobs.length === 0 && loading ? (
          <p className="muted">Loading jobs…</p>
        ) : null}
        {jobs.map((job) => (
          <article className="card job" key={job.id}>
            <div className="job-meta">
              <span className={`state state-${job.state}`}>{job.state}</span>
              <span className="muted">#{job.id}</span>
              <span className="muted">
                {new Date(job.timestamp).toLocaleString()}
              </span>
            </div>
            {editingId === job.id ? (
              <div className="form">
                <label>
                  Name
                  <input
                    value={editForm.name}
                    onChange={(event) =>
                      setEditForm((current) => ({
                        ...current,
                        name: event.target.value,
                      }))
                    }
                  />
                </label>
                <ModelPicker
                  label="Model"
                  models={
                    editForm.model &&
                    !models.some((model) => model.id === editForm.model)
                      ? [
                          {
                            id: editForm.model,
                            name: editForm.model,
                            description: '',
                            contextLength: null,
                            maxOutputTokens: null,
                            inputModalities: [],
                            intelligenceIndex: null,
                            codingIndex: null,
                            agenticIndex: null,
                          },
                          ...models,
                        ]
                      : models
                  }
                  value={editForm.model}
                  onChange={(model) =>
                    setEditForm((current) => ({ ...current, model }))
                  }
                />
                <label>
                  Description
                  <textarea
                    value={editForm.description}
                    onChange={(event) =>
                      setEditForm((current) => ({
                        ...current,
                        description: event.target.value,
                      }))
                    }
                    rows={3}
                  />
                </label>
                <div className="actions">
                  <button
                    type="button"
                    onClick={() => void onSaveEdit(job.id)}
                    disabled={busy}
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => setEditingId(null)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <h2>{job.data.name}</h2>
                <p className="muted">
                  {job.data.model
                    ? (models.find((model) => model.id === job.data.model)
                        ?.name ?? job.data.model)
                    : 'No model selected'}
                </p>
                <p>{job.data.description}</p>
                {job.failedReason ? (
                  <p className="error">{job.failedReason}</p>
                ) : null}
                <div className="actions">
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => {
                      setEditingId(job.id)
                      setEditForm({
                        name: job.data.name,
                        description: job.data.description,
                        model: job.data.model ?? '',
                      })
                    }}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="danger"
                    onClick={() => void onDelete(job.id)}
                    disabled={busy}
                  >
                    Delete
                  </button>
                </div>
              </>
            )}
          </article>
        ))}
        <div ref={sentinelRef} aria-hidden="true" />
        {loadingMore ? <p className="muted">Loading more…</p> : null}
      </div>
    </section>
  )
}

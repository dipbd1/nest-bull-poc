import { useEffect, useState, type FormEvent } from 'react'
import { useOutletContext } from 'react-router'
import {
  createJob,
  deleteAllJobs,
  deleteJob,
  listJobs,
  updateJob,
} from '../api.ts'
import type { LayoutContext, ProducerJob } from '../types.ts'

const emptyForm = { name: '', description: '' }

export function ProducerPage() {
  const { refreshStatus } = useOutletContext<LayoutContext>()
  const [jobs, setJobs] = useState<ProducerJob[]>([])
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState(emptyForm)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function reload() {
    const next = await listJobs()
    setJobs(next)
    await refreshStatus()
  }

  useEffect(() => {
    let cancelled = false
    void listJobs()
      .then((next) => {
        if (!cancelled) setJobs(next)
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load jobs')
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  async function onCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await createJob(form)
      setForm(emptyForm)
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
          disabled={busy || jobs.length === 0}
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
        <button type="submit" disabled={busy}>
          Enqueue
        </button>
      </form>

      <div className="job-list">
        {jobs.length === 0 ? (
          <p className="muted">No jobs on the queue yet.</p>
        ) : (
          jobs.map((job) => (
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
                  <p>{job.data.description}</p>
                  <div className="actions">
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => {
                        setEditingId(job.id)
                        setEditForm({
                          name: job.data.name,
                          description: job.data.description,
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
          ))
        )}
      </div>
    </section>
  )
}

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import {
  MAX_COMMENT_LENGTH,
  MAX_COMMENTS,
  MAX_TAG_LENGTH,
  MAX_TAGS,
  MAX_TITLE_LENGTH,
  MIN_TAGS,
  checkNewBatch,
  commentEntries,
} from '../domain/batches.ts'
import { chosenModelId, readsAndWritesText } from '../domain/models.ts'
import { useBatchModels, useCreateBatch } from '../features/index.ts'
import {
  Button,
  Card,
  ChipInput,
  Heading,
  Stack,
  Text,
  TextField,
  TextLink,
} from '../ui/index.ts'
import { ModelField } from './ModelField.tsx'
import styles from './NewBatchPage.module.css'

type CommentBox = {
  id: number
  text: string
}

function isTextField(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
}

export function NewBatchPage() {
  const navigate = useNavigate()
  const catalog = useBatchModels()
  const creator = useCreateBatch()

  const [title, setTitle] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [boxes, setBoxes] = useState<CommentBox[]>([{ id: 1, text: '' }])
  const [pickedModel, setPickedModel] = useState('')
  const nextId = useRef(2)
  const countRef = useRef(boxes.length)
  const pendingFocus = useRef<number | null>(null)

  const model = chosenModelId(catalog.models, pickedModel, catalog.defaultModel)
  const selected = catalog.models.find((item) => item.id === model)
  const modelBlocked =
    !catalog.ready || !selected || !readsAndWritesText(selected)

  const comments = boxes.map((box) => box.text)
  const input = { title, tags, comments, model }
  const check = checkNewBatch(input)
  const overCap = check.commentCount > MAX_COMMENTS
  const noModels = catalog.loaded && catalog.models.length === 0
  const started =
    title.length > 0 || tags.length > 0 || boxes.some((box) => box.text.trim() !== '')

  const appendBox = useCallback((text: string) => {
    if (countRef.current >= MAX_COMMENTS) return
    const id = nextId.current
    nextId.current += 1
    countRef.current += 1
    pendingFocus.current = id
    setBoxes((current) => [...current, { id, text }])
  }, [])

  function removeBox(id: number) {
    setBoxes((current) => {
      if (current.length === 1) return [{ ...current[0], text: '' }]
      return current.filter((box) => box.id !== id)
    })
  }

  useEffect(() => {
    countRef.current = boxes.length
    const id = pendingFocus.current
    if (id === null) return
    pendingFocus.current = null
    document.getElementById(`comment-${id}`)?.focus()
  }, [boxes])

  useEffect(() => {
    function onPaste(event: ClipboardEvent) {
      if (isTextField(event.target)) return
      const text = event.clipboardData?.getData('text')?.trim() ?? ''
      if (!text) return
      event.preventDefault()
      appendBox(text)
    }

    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [appendBox])

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (check.problem) return
    const id = await creator.create({
      ...input,
      comments: commentEntries(comments),
    })
    if (id) navigate(`/batches/${id}`)
  }

  return (
    <Stack>
      <Stack gap="xs">
        <TextLink to="/">&larr; Batches</TextLink>
        <Heading level={1}>New batch</Heading>
        <Text tone="muted">
          Coding runs on the server. You can leave this page once the batch is
          created.
        </Text>
      </Stack>

      <Card>
        <form onSubmit={(event) => void onSubmit(event)}>
          <Stack gap="md">
            <TextField
              label="Title"
              name="title"
              maxLength={MAX_TITLE_LENGTH}
              placeholder="Q3 customer survey"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              required
            />

            <ChipInput
              label={`Tags (${MIN_TAGS} to ${MAX_TAGS})`}
              values={tags}
              onChange={setTags}
              maxChips={MAX_TAGS}
              maxLength={MAX_TAG_LENGTH}
              placeholder="Type a tag, press Enter"
            />

            <fieldset className={styles.comments}>
              <legend className={styles.legend}>Inputs</legend>
              {boxes.map((box, index) => {
                const tooLong = box.text.trim().length > MAX_COMMENT_LENGTH
                const number = index + 1
                return (
                  <div key={box.id} className={styles.comment}>
                    <div className={styles.field}>
                      <span className={styles.index} aria-hidden="true">
                        {number}
                      </span>
                      <textarea
                        id={`comment-${box.id}`}
                        className={styles.control}
                        name={`comment-${box.id}`}
                        rows={3}
                        aria-label={`Input ${number}`}
                        placeholder={
                          index === 0
                            ? 'The delivery arrived two days late.'
                            : undefined
                        }
                        value={box.text}
                        onChange={(event) =>
                          setBoxes((current) =>
                            current.map((item) =>
                              item.id === box.id
                                ? { ...item, text: event.target.value }
                                : item,
                            ),
                          )
                        }
                      />
                    </div>
                    <Button variant="secondary" onClick={() => removeBox(box.id)}>
                      Remove
                    </Button>
                    {tooLong ? (
                      <Text className={styles.note} tone="error">
                        Longer than {MAX_COMMENT_LENGTH} characters.
                      </Text>
                    ) : null}
                  </div>
                )
              })}
              <Button
                variant="secondary"
                disabled={boxes.length >= MAX_COMMENTS}
                onClick={() => appendBox('')}
              >
                Add comment
              </Button>
              <Text tone="hint">
                Each box is one comment. Ctrl+V pastes the clipboard into a new
                comment.
              </Text>
            </fieldset>
            <Text tone={overCap ? 'error' : 'hint'} aria-live="polite">
              {check.commentCount} of {MAX_COMMENTS} comments
              {overCap ? ` — remove ${check.commentCount - MAX_COMMENTS}` : ''}
            </Text>

            <ModelField
              models={catalog.models}
              value={model}
              loaded={catalog.loaded}
              onChange={setPickedModel}
            />
            {noModels ? (
              <Text tone="error">
                No model is available. Ask an admin to connect one.
              </Text>
            ) : null}
            {catalog.loaded && !catalog.ready && !catalog.error ? (
              <Text tone="error">
                OpenRouter is not connected. Ask an admin to add the key.
              </Text>
            ) : null}
            {catalog.error ? <Text tone="error">{catalog.error}</Text> : null}

            {creator.error ? <Text tone="error">{creator.error}</Text> : null}
            {check.problem && started ? (
              <Text tone="hint">{check.problem}</Text>
            ) : null}

            <Stack direction="row" gap="sm" wrap>
              <Button
                type="submit"
                disabled={creator.busy || check.problem !== null || modelBlocked}
              >
                {creator.busy ? 'Creating…' : 'Create batch'}
              </Button>
              <Button variant="secondary" onClick={() => navigate('/')}>
                Cancel
              </Button>
            </Stack>
          </Stack>
        </form>
      </Card>
    </Stack>
  )
}

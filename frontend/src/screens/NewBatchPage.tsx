import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import {
  MAX_COMMENTS,
  MAX_TAG_LENGTH,
  MAX_TAGS,
  MAX_TITLE_LENGTH,
  MIN_TAGS,
  checkNewBatch,
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
  TextArea,
  TextField,
  TextLink,
} from '../ui/index.ts'
import { ModelField } from './ModelField.tsx'

export function NewBatchPage() {
  const navigate = useNavigate()
  const catalog = useBatchModels()
  const creator = useCreateBatch()

  const [title, setTitle] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [comments, setComments] = useState('')
  const [pickedModel, setPickedModel] = useState('')

  const model = chosenModelId(catalog.models, pickedModel, catalog.defaultModel)
  const selected = catalog.models.find((item) => item.id === model)
  const modelBlocked =
    !catalog.ready || !selected || !readsAndWritesText(selected)

  const input = { title, tags, comments, model }
  const check = checkNewBatch(input)
  const overCap = check.commentCount > MAX_COMMENTS
  const noModels = catalog.loaded && catalog.models.length === 0

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (check.problem) return
    const id = await creator.create(input)
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

            <TextArea
              label="Comments, one per line"
              name="comments"
              rows={10}
              placeholder={'The delivery arrived two days late.\nPlease add a dark mode.'}
              value={comments}
              onChange={(event) => setComments(event.target.value)}
              required
            />
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
            {check.problem && (title || tags.length > 0 || comments) ? (
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

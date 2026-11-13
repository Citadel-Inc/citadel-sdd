import { afterAll } from 'bun:test'
import { removeTemplates } from './helpers/temp-repo.ts'

afterAll(removeTemplates)

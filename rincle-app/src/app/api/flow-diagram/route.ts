import { readFile, writeFile } from 'fs/promises'
import { join } from 'path'

const FILE_PATH = join(process.cwd(), '..', 'documents', '1_requirements', '02_screen', 'screen_transition.json')

export async function GET() {
  try {
    const json = await readFile(FILE_PATH, 'utf-8')
    return new Response(json, { headers: { 'Content-Type': 'application/json' } })
  } catch {
    return Response.json(null, { status: 404 })
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json()
    await writeFile(FILE_PATH, JSON.stringify(data, null, 2), 'utf-8')
    return Response.json({ ok: true })
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 })
  }
}

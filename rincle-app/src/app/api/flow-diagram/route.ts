import { readFile, writeFile } from 'fs/promises'
import { join } from 'path'

const FILE_PATH = join(process.cwd(), '..', 'documents', '1_requirements', 'screen_transition.drawio')

export async function GET() {
  try {
    const xml = await readFile(FILE_PATH, 'utf-8')
    return new Response(xml, { headers: { 'Content-Type': 'application/xml' } })
  } catch {
    return Response.json({ error: 'File not found' }, { status: 404 })
  }
}

export async function POST(request: Request) {
  try {
    const xml = await request.text()
    await writeFile(FILE_PATH, xml, 'utf-8')
    return Response.json({ ok: true })
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 })
  }
}

import { createClient } from '@supabase/supabase-js'
import { writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = join(__dirname, '..', '..', 'documents', '1_requirements', '03_email')

const supabase = createClient(
  'https://jriuirgduuvjaijjaqzq.supabase.co',
  'sb_publishable_91CZcaYw9rSyCcN3DeXc5g_JeEG0I5U'
)

function escapeCsv(val) {
  const s = String(val ?? '')
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

async function main() {
  // emails
  const { data: emails, error: e1 } = await supabase
    .from('emails')
    .select('*')
    .order('sort_order')

  if (e1) { console.error('emails fetch error:', e1.message); process.exit(1) }

  const emailHeaders = ['No', '進捗', 'メール', '送付タイミング', '誰に送るか', '件名', '文書']
  const emailKeys = ['no', 'status', 'name', 'timing', 'recipient', 'subject', 'body']
  const emailCsv = [
    emailHeaders.join(','),
    ...emails.map(r => emailKeys.map(k => escapeCsv(r[k])).join(','))
  ].join('\n')

  writeFileSync(join(OUT_DIR, 'emails.csv'), emailCsv, 'utf-8')
  console.log(`✅ emails.csv: ${emails.length} 行`)

  // email_config
  const { data: config, error: e2 } = await supabase
    .from('email_config')
    .select('*')
    .eq('id', 1)
    .single()

  if (e2) { console.error('email_config fetch error:', e2.message); process.exit(1) }

  const configHeaders = ['Fromメアド', '送信者名', 'フッター']
  const configCsv = [
    configHeaders.join(','),
    [escapeCsv(config.from_address), escapeCsv(config.sender_name), escapeCsv(config.footer)].join(',')
  ].join('\n')

  writeFileSync(join(OUT_DIR, 'emails_config.csv'), configCsv, 'utf-8')
  console.log(`✅ emails_config.csv`)
}

main()

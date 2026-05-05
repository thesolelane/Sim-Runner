const PDFDocument = require('pdfkit')
const fs = require('fs')
const path = require('path')

const OUTPUT = path.join(__dirname, '../docs/traydbook-marketplace-comparison.pdf')

const BRAND       = '#E85D04'
const DARK        = '#141416'
const SURFACE     = '#22252A'
const BORDER      = '#E5E7EB'
const ROW_ALT     = '#FFF7F0'
const ROW_NORM    = '#FFFFFF'
const TRAYD_COL_BG = '#FEF3EC'

const CHECK = '✓'
const CROSS = '—'

function cellText(val) {
  if (val === true)    return CHECK
  if (val === false)   return CROSS
  if (val === 'part')  return '~'
  if (val === 'fee')   return '$'
  if (val === 'paid')  return '$'
  if (val === 'comm')  return '%'
  return String(val)
}
function cellColor(val) {
  if (val === true)   return '#16A34A'
  if (val === false)  return '#9CA3AF'
  return '#CA8A04'
}
function cellBg(val) {
  if (val === true)   return '#F0FDF4'
  if (val === false)  return '#F9FAFB'
  return '#FEFCE8'
}

// ── Competitor data ─────────────────────────────────────────────
// Columns: TraydBook | Thumbtack | Angi | HomeAdvisor | Houzz | Bark.com
const PLATFORMS = ['TraydBook', 'Thumbtack', 'Angi', 'HomeAdvisor', 'Houzz', 'Bark.com']

const sections = [
  {
    title: 'COST TO CONTRACTORS',
    rows: [
      ['Free to Join',                        true,  true,  true,  true,  true,  true ],
      ['Pay-Per-Lead Fees',                   false, 'fee', 'fee', 'fee', false, 'fee'],
      ['Commission on Completed Jobs',        false, false, 'comm',false, false, false],
      ['Monthly Subscription Required',       false, 'paid','paid','paid','paid', false],
      ['Free to Post Work / Portfolio',       true,  false, false, false, 'part',false],
      ['Free to Submit Bids / Quotes ★',      true,  false, false, false, false, false],
      ['No Upfront Lead Costs ★',             true,  false, false, false, false, false],
    ],
  },
  {
    title: 'LEAD GENERATION & BIDDING',
    rows: [
      ['Receive Job Leads',                   true,  true,  true,  true,  true,  true ],
      ['Request for Quote (RFQ) Board ★',     true,  false, false, false, false, false],
      ['Submit Competitive Bids ★',           true,  false, false, false, false, false],
      ['Structured Project Inquiry Form ★',   true,  false, false, false, false, false],
      ['Urgent Job Flagging ★',               true,  false, false, false, false, false],
      ['Budget Range Shown on Listings',      true,  true,  'part',true,  true,  false],
      ['Direct Client Messaging',             true,  true,  true,  true,  'part',true ],
    ],
  },
  {
    title: 'CONTRACTOR PROFILES',
    rows: [
      ['Public Profile Page',                 true,  true,  true,  true,  true,  true ],
      ['Portfolio / Project Photos',          true,  true,  true,  true,  true,  false],
      ['Star Ratings & Reviews',              true,  true,  true,  true,  true,  true ],
      ['Verified Badge / Credentials',        true,  'part','part','part','part', false],
      ['License & Insurance Display',         true,  'part',true,  true,  false, false],
      ['Availability Status ★',               true,  false, false, false, false, false],
      ['Years of Experience Field',           true,  true,  true,  true,  true,  false],
    ],
  },
  {
    title: 'SOCIAL & COMMUNITY FEATURES',
    rows: [
      ['Social Feed / News Feed ★',           true,  false, false, false, false, false],
      ['Post Work Updates / Photos ★',        true,  false, false, false, false, false],
      ['Like, Comment & Share ★',             true,  false, false, false, false, false],
      ['Follow / Connect with Peers ★',       true,  false, false, false, false, false],
      ['Hashtags & Trending Content ★',       true,  false, false, false, false, false],
      ['Contractor Community / Network ★',    true,  false, false, false, false, false],
      ['Peer-to-Peer Referrals',              true,  false, false, false, 'part',false],
    ],
  },
  {
    title: 'JOB BOARD',
    rows: [
      ['Browse Open Jobs',                    true,  true,  true,  true,  true,  true ],
      ['Trade-Specific Job Categories',       true,  true,  true,  true,  'part',true ],
      ['Filter by Location',                  true,  true,  true,  true,  true,  true ],
      ['Filter by Budget Range',              true,  true,  true,  true,  true,  false],
      ['Post Jobs (as Client)',               true,  true,  true,  true,  true,  true ],
      ['Emergency / Urgent Jobs ★',           true,  false, 'part',false, false, false],
    ],
  },
  {
    title: 'REPUTATION & TRUST',
    rows: [
      ['Verified Badge System',               true,  'part','part','part',false, false],
      ['Background Check Integration',        false, true,  true,  true,  false, false],
      ['Review Verification',                 true,  true,  true,  true,  true,  'part'],
      ['Rating System (1–5 Stars)',           true,  true,  true,  true,  true,  true ],
      ['Endorsements / Skills',               true,  false, false, false, false, false],
      ['Project History on Profile',          true,  true,  true,  true,  true,  false],
    ],
  },
  {
    title: 'MESSAGING & NOTIFICATIONS',
    rows: [
      ['Direct Messaging',                    true,  true,  true,  true,  'part',true ],
      ['In-App Notifications',                true,  true,  true,  true,  true,  true ],
      ['Email Notifications',                 true,  true,  true,  true,  true,  true ],
      ['SMS / Text Alerts',                   'part',true,  true,  true,  false, true ],
      ['Structured First-Contact Form ★',     true,  false, false, false, false, false],
    ],
  },
  {
    title: 'PLATFORM & MOBILE',
    rows: [
      ['Mobile-Optimised Web App',            true,  true,  true,  true,  true,  true ],
      ['Native iOS App',                      false, true,  true,  true,  true,  true ],
      ['Native Android App',                  false, true,  true,  true,  true,  true ],
      ['Bottom Tab Navigation (Mobile)',      true,  true,  true,  true,  true,  true ],
      ['Works Without Downloading an App',    true,  'part','part','part','part','part'],
      ['Admin / Analytics Dashboard',         'part',true,  true,  true,  true,  false],
    ],
  },
]

// ── Draw helpers ───────────────────────────────────────────────
const PW = 612
const PH = 792
const ML = 30
const MR = 30
const CW = PW - ML - MR

const F_W  = 130
const P_W  = (CW - F_W) / PLATFORMS.length   // ~73 per platform at 6 cols
const ROW_H = 13
const COL_GAP = 12
const COL_W   = (CW - COL_GAP) / 2

function sectionHeight(section) {
  return 15 + 12 + section.rows.length * ROW_H + 10
}

function drawSectionTable(doc, section, ox, oy, colW) {
  const fW = Math.round(colW * 0.38)
  const pW = Math.round((colW - fW) / 6)
  const tableW = fW + pW * 6

  // Header bar
  doc.rect(ox, oy, tableW, 14).fill(SURFACE)
  doc.fillColor(BRAND).font('Helvetica-Bold').fontSize(6.5)
     .text(section.title, ox + 4, oy + 4, { width: tableW - 8, lineBreak: false })
  oy += 14

  // Platform header row
  const headers = ['Feature', 'TraydBook', 'Thumbtack', 'Angi', 'HomeAdv.', 'Houzz', 'Bark']
  const colXArr = [ox]
  for (let i = 0; i < 6; i++) colXArr.push(ox + fW + pW * i)

  doc.rect(ox, oy, tableW, 12).fill('#374151')
  headers.forEach((h, i) => {
    if (i === 0) {
      doc.fillColor('white').font('Helvetica-Bold').fontSize(6)
         .text(h, ox + 3, oy + 3, { width: fW - 6, lineBreak: false })
    } else {
      const isTrayd = i === 1
      if (isTrayd) doc.rect(colXArr[i], oy, pW, 12).fill(BRAND)
      doc.fillColor('white').font('Helvetica-Bold').fontSize(5.8)
         .text(h, colXArr[i], oy + 3, { width: pW, align: 'center', lineBreak: false })
    }
  })
  oy += 12

  section.rows.forEach((row, ri) => {
    const [label, ...vals] = row
    const bg = ri % 2 === 0 ? ROW_NORM : ROW_ALT
    doc.rect(ox, oy, tableW, ROW_H).fill(bg)
    doc.rect(colXArr[1], oy, pW, ROW_H).fill(TRAYD_COL_BG)

    const isUnique = label.includes('★')
    const cleanLabel = label.replace(' ★', '')
    doc.fillColor(isUnique ? BRAND : '#111827')
       .font(isUnique ? 'Helvetica-Bold' : 'Helvetica').fontSize(6.5)
       .text(cleanLabel, ox + 3, oy + 3, { width: fW - 6, lineBreak: false })

    vals.forEach((val, ci) => {
      const txt = cellText(val)
      const color = cellColor(val)
      const bg2 = cellBg(val)
      const cx = colXArr[ci + 1]
      const dotSize = 9
      const dotX = cx + (pW - dotSize) / 2
      const dotY = oy + (ROW_H - dotSize) / 2
      doc.roundedRect(dotX, dotY, dotSize, dotSize, 2).fill(bg2)
      doc.fillColor(color).font('Helvetica-Bold').fontSize(7)
         .text(txt, cx, oy + 3, { width: pW, align: 'center', lineBreak: false })
    })

    doc.rect(ox, oy + ROW_H - 0.5, tableW, 0.5).fill(BORDER)
    oy += ROW_H
  })

  return oy
}

// ── Build doc ─────────────────────────────────────────────────
const doc = new PDFDocument({
  size: 'LETTER',
  margins: { top: 0, left: 0, right: 0, bottom: 0 },
  info: {
    Title: 'TraydBook — Marketplace Platform Comparison',
    Author: 'TraydBook',
    Subject: 'Feature comparison vs Thumbtack, Angi, HomeAdvisor, Houzz, Bark.com',
  },
})

const stream = fs.createWriteStream(OUTPUT)
doc.pipe(stream)

// ── Header ─────────────────────────────────────────────────────
doc.rect(0, 0, PW, 68).fill(DARK)

doc.rect(ML, 14, 40, 40, 6).fill(BRAND)
doc.fillColor('white').font('Helvetica-Bold').fontSize(18).text('TB', ML + 9, 23)

doc.fillColor('#F0ECE6').font('Helvetica-Bold').fontSize(22)
   .text('Trayd', ML + 48, 18, { continued: true })
   .fillColor(BRAND).text('Book')
doc.fillColor('#9D9990').font('Helvetica').fontSize(8.5)
   .text('The Professional Network for the Construction Trades', ML + 48, 44)

doc.fillColor('#F0ECE6').font('Helvetica-Bold').fontSize(13)
   .text('MARKETPLACE COMPARISON', 0, 20, { align: 'right', width: PW - MR })
doc.fillColor('#9D9990').font('Helvetica').fontSize(8.5)
   .text('TraydBook vs Thumbtack · Angi · HomeAdvisor · Houzz · Bark.com', 0, 38, { align: 'right', width: PW - MR })

doc.rect(0, 68, PW, 16).fill(BRAND)
doc.fillColor('white').font('Helvetica-Bold').fontSize(7.5)
   .text('★ = TRAYDBOOK EXCLUSIVE   |   ✓ AVAILABLE   |   — NOT AVAILABLE   |   ~ PARTIAL   |   $ FEE / PAID   |   % COMMISSION',
     0, 72, { align: 'center', width: PW })

let y = 92

// Intro
doc.fillColor('#374151').font('Helvetica').fontSize(8.5)
   .text(
    'Unlike lead-generation marketplaces that charge contractors per lead, monthly fees, or commissions, ' +
    'TraydBook is always free for contractors — no lead fees, no bidding costs, no commission on jobs won. ' +
    'TraydBook adds a full social network and community layer that none of the platforms below offer.',
    ML, y, { width: CW, lineGap: 2 }
   )
y += 36

// ── Two-column section layout ──────────────────────────────────
let si = 0
while (si < sections.length) {
  const sec1 = sections[si]
  const sec2 = sections[si + 1]

  const h1 = sectionHeight(sec1)
  const h2 = sec2 ? sectionHeight(sec2) : 0
  const blockH = Math.max(h1, h2)

  if (y + blockH > PH - 54) {
    doc.addPage()
    y = 24
  }

  const ox1 = ML
  const ox2 = ML + COL_W + COL_GAP

  drawSectionTable(doc, sec1, ox1, y, COL_W)
  if (sec2) drawSectionTable(doc, sec2, ox2, y, COL_W)

  y += blockH + 12
  si += 2
}

// ── Key differentiator callout box ────────────────────────────
if (y + 54 > PH - 54) { doc.addPage(); y = 24 }

doc.rect(ML, y, CW, 48).fill('#FFF7F0')
doc.rect(ML, y, 3, 48).fill(BRAND)
doc.fillColor(BRAND).font('Helvetica-Bold').fontSize(8)
   .text('WHY TRAYDBOOK WINS FOR CONTRACTORS', ML + 10, y + 8)
doc.fillColor('#374151').font('Helvetica').fontSize(7.5)
   .text(
    '1.  Zero lead fees, zero commission — contractors keep 100% of every job they win.\n' +
    '2.  Bid Board (RFQ system) — get found by clients posting real projects, without paying per inquiry.\n' +
    '3.  Social network layer — build a following, showcase work, and get discovered organically.',
    ML + 10, y + 20, { width: CW - 20, lineGap: 3 }
   )
y += 62

// ── Footer ────────────────────────────────────────────────────
const footerY = PH - 44
doc.rect(0, footerY, PW, 44).fill(DARK)
doc.fillColor('#9D9990').font('Helvetica').fontSize(7.5)
   .text('TraydBook  ·  traydbook.com  ·  hello@traydbook.com', ML, footerY + 10, { width: CW / 2 })
doc.fillColor('#F0ECE6').font('Helvetica-Bold').fontSize(7.5)
   .text('Built for the trades. Free for contractors, always.', 0, footerY + 10, { align: 'right', width: PW - MR })
doc.fillColor('#6B7280').font('Helvetica').fontSize(6.5)
   .text(`Confidential  ·  ${new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`, ML, footerY + 26)

doc.end()

stream.on('finish', () => {
  const size = (fs.statSync(OUTPUT).size / 1024).toFixed(1)
  console.log(`PDF generated: ${OUTPUT} (${size} KB)`)
})
stream.on('error', err => { console.error(err); process.exit(1) })

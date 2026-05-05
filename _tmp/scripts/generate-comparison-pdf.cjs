const PDFDocument = require('pdfkit')
const fs = require('fs')
const path = require('path')

const OUTPUT = path.join(__dirname, '../docs/traydbook-feature-comparison.pdf')

// ── Brand colours ──────────────────────────────────────────────
const BRAND    = '#E85D04'
const DARK     = '#141416'
const SURFACE  = '#22252A'
const MUTED    = '#6B7280'
const BORDER   = '#E5E7EB'
const ROW_ALT  = '#FFF7F0'
const ROW_NORM = '#FFFFFF'
const TRAYD_COL_BG = '#FEF3EC'

const CHECK  = '✓'
const CROSS  = '—'
const PART   = '~'

// ── Data ───────────────────────────────────────────────────────
const PLATFORMS = ['TraydBook', 'Facebook', 'LinkedIn', 'Twitter/X', 'Instagram']

const sections = [
  {
    title: 'SOCIAL FEED & CONTENT',
    rows: [
      ['Post Feed / Timeline',              true,  true,  true,  true,  true ],
      ['Trade-Specific Post Types ★',       true,  false, false, false, false],
      ['Photo Posts',                        true,  true,  true,  true,  true ],
      ['Like, Comment & Share',              true,  true,  true,  true,  true ],
      ['Hashtags & Trending',                true,  true,  true,  true,  true ],
      ['Boosted / Featured Posts',           true,  true,  true,  true,  true ],
      ['Urgent Flagging on Posts ★',         true,  false, false, false, false],
      ['Stories / Reels / Live Video',       false, true,  false, false, true ],
    ],
  },
  {
    title: 'PROFILES & CREDENTIALS',
    rows: [
      ['User Profile Page',                  true,  true,  true,  true,  true ],
      ['Verified Badge',                     true,  true,  true,  'paid','paid'],
      ['Trade / License Display ★',          true,  false, false, false, false],
      ['Availability Status ★',             true,  false, 'part',false, false],
      ['Star Ratings & Reviews ★',           true,  false, false, false, false],
      ['Portfolio / Work Showcase',          true,  false, true,  false, true ],
      ['Account Type Tiers',                 true,  false, true,  true,  false],
    ],
  },
  {
    title: 'NETWORKING & DISCOVERY',
    rows: [
      ['Connect / Follow System',            true,  true,  true,  true,  true ],
      ['People Suggestions',                 true,  true,  true,  true,  true ],
      ['Contractor Directory (Explore) ★',   true,  false, false, false, false],
      ['Filter by Trade & Location',         true,  'part',true,  false, false],
      ['Groups / Communities',               false, true,  true,  false, false],
      ['Business / Company Pages',           false, true,  true,  false, true ],
      ['Always Free for Contractors ★',      true,  false, false, false, false],
    ],
  },
  {
    title: 'JOBS & BID BOARD',
    rows: [
      ['Job Board',                          true,  'part',true,  false, false],
      ['Post a Job Listing',                 true,  'part',true,  false, false],
      ['Request for Quote (RFQ Board) ★',    true,  false, false, false, false],
      ['Submit a Bid / Proposal ★',          true,  false, false, false, false],
      ['Trade-Specific Job Categories ★',    true,  false, false, false, false],
      ['Budget / Pay Range on Listings',     true,  false, true,  false, false],
      ['Urgent Job Flagging ★',              true,  false, false, false, false],
      ['Structured Project Inquiry ★',       true,  false, false, false, false],
    ],
  },
  {
    title: 'MESSAGING',
    rows: [
      ['Direct Messaging',                   true,  true,  true,  true,  true ],
      ['Group Messaging',                    false, true,  true,  true,  true ],
      ['Structured First-Contact Form ★',    true,  false, false, false, false],
      ['Real-Time Notifications',            true,  true,  true,  true,  true ],
      ['SMS Text Alerts ★',                  'part',false, false, false, false],
    ],
  },
  {
    title: 'PRICING & ACCESS',
    rows: [
      ['Free for Contractors — Always ★',    true,  false, false, false, false],
      ['Credit / Token System',              true,  false, false, true,  false],
      ['Pay-Per-Message to Pro',             true,  false, 'part',false, false],
      ['Subscription Option',                true,  true,  true,  true,  true ],
      ['No Job Listing Fees (Contractors)',  true,  false, false, false, false],
    ],
  },
  {
    title: 'MOBILE EXPERIENCE',
    rows: [
      ['Mobile-Optimised Web App',           true,  true,  true,  true,  true ],
      ['Bottom Tab Navigation',              true,  true,  true,  true,  true ],
      ['Native iOS & Android App',           false, true,  true,  true,  true ],
      ['Works Without Downloading an App',   true,  'part','part','part','part'],
    ],
  },
]

// ── Helpers ────────────────────────────────────────────────────
function hex(h) { // convert #RRGGBB to [r,g,b] 0-1
  const n = parseInt(h.replace('#', ''), 16)
  return [(n >> 16) / 255, ((n >> 8) & 0xff) / 255, (n & 0xff) / 255]
}
function fillHex(doc, h) { const [r,g,b] = hex(h); doc.fillColor([r*255|0, g*255|0, b*255|0]) }

function cellText(val) {
  if (val === true)   return CHECK
  if (val === false)  return CROSS
  if (val === 'part') return '~'
  if (val === 'paid') return '$'
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

// ── Build PDF ─────────────────────────────────────────────────
const doc = new PDFDocument({
  size: 'LETTER',
  margins: { top: 0, left: 0, right: 0, bottom: 0 },
  info: {
    Title: 'TraydBook — Platform Feature Comparison',
    Author: 'TraydBook',
    Subject: 'Feature comparison vs Facebook, LinkedIn, Twitter/X, Instagram',
  },
})

const stream = fs.createWriteStream(OUTPUT)
doc.pipe(stream)

const PW = 612  // letter width points
const PH = 792  // letter height points
const ML = 36   // margin left
const MR = 36   // margin right
const CW = PW - ML - MR  // content width

// ── PAGE 1: HEADER + intro + first 4 sections ─────────────────
let page = 1

// ──────────── HEADER ────────────────────────────────────────────
doc.rect(0, 0, PW, 68).fill(DARK)

// Logo icon
doc.roundedRect(ML, 14, 40, 40, 6).fill(BRAND)
// Tiny book icon lines (simplified)
doc.fillColor('white').fontSize(18).font('Helvetica-Bold').text('TB', ML + 9, 23)

// Logo text
doc.fillColor('#F0ECE6').font('Helvetica-Bold').fontSize(22)
   .text('Trayd', ML + 48, 18, { continued: true })
   .fillColor(BRAND).text('Book')

doc.fillColor('#9D9990').font('Helvetica').fontSize(8.5)
   .text('The Professional Network for the Construction Trades', ML + 48, 44)

// Right side title
doc.fillColor('#F0ECE6').font('Helvetica-Bold').fontSize(13)
   .text('PLATFORM FEATURE COMPARISON', 0, 20, { align: 'right', width: PW - MR })
doc.fillColor('#9D9990').font('Helvetica').fontSize(8.5)
   .text('TraydBook vs Facebook · LinkedIn · Twitter/X · Instagram', 0, 38, { align: 'right', width: PW - MR })

// Orange strip
doc.rect(0, 68, PW, 16).fill(BRAND)
doc.fillColor('white').font('Helvetica-Bold').fontSize(7.5)
   .text('★ = TRAYDBOOK EXCLUSIVE FEATURE   |   ✓ AVAILABLE   |   — NOT AVAILABLE   |   ~ PARTIAL / COMING SOON   |   $ PAID TIER ONLY',
     0, 72, { align: 'center', width: PW })

let y = 92

// ── Intro blurb
doc.fillColor('#374151').font('Helvetica').fontSize(8.5)
   .text(
    'TraydBook is purpose-built for contractors and tradespeople. Where general social platforms offer broad reach, ' +
    'TraydBook delivers the specific tools trades need: a live bid board, verified credentials, trade-specific job ' +
    'listings, and a reputation system built on real project work. Contractors always use TraydBook free.',
    ML, y, { width: CW, lineGap: 2 }
   )
y += 38

// ── TWO-COLUMN TABLE LAYOUT ────────────────────────────────────
const COL_GAP  = 14
const COL_W    = (CW - COL_GAP) / 2  // width of each column block

// Column widths within each table (5 platforms + feature label)
// Feature label | TB | FB | LI | TW | IG
const F_W  = 118  // feature name
const P_W  = 22   // each platform cell
const ROW_H = 13

function drawSectionTable(doc, section, ox, oy) {
  const tableW = F_W + P_W * 5

  // Section header bar
  doc.rect(ox, oy, tableW, 15).fill(SURFACE)
  doc.fillColor(BRAND).font('Helvetica-Bold').fontSize(7)
     .text(section.title, ox + 4, oy + 4, { width: tableW - 8 })
  oy += 15

  // Platform header row
  const headers = ['Feature', 'TB', 'FB', 'LI', 'TW', 'IG']
  const colX = [ox, ox + F_W, ox + F_W + P_W, ox + F_W + P_W*2, ox + F_W + P_W*3, ox + F_W + P_W*4]

  doc.rect(ox, oy, tableW, 12).fill('#374151')
  headers.forEach((h, i) => {
    doc.fillColor('white').font('Helvetica-Bold').fontSize(6.5)
    if (i === 0) {
      doc.text(h, colX[i] + 3, oy + 3, { width: F_W - 6 })
    } else {
      const isTrayd = i === 1
      if (isTrayd) {
        doc.rect(colX[i], oy, P_W, 12).fill(BRAND)
        doc.fillColor('white')
      }
      doc.text(h, colX[i], oy + 3, { width: P_W, align: 'center' })
    }
  })
  oy += 12

  // Rows
  section.rows.forEach((row, ri) => {
    const [label, ...vals] = row
    const bg = ri % 2 === 0 ? ROW_NORM : ROW_ALT
    doc.rect(ox, oy, tableW, ROW_H).fill(bg)

    // Trayd column background
    doc.rect(colX[1], oy, P_W, ROW_H).fill(TRAYD_COL_BG)

    // Feature name
    const isUnique = label.includes('★')
    const cleanLabel = label.replace(' ★', '')
    doc.fillColor(isUnique ? BRAND : '#111827').font(isUnique ? 'Helvetica-Bold' : 'Helvetica').fontSize(6.8)
       .text(cleanLabel, colX[0] + 3, oy + 3, { width: F_W - 6, lineBreak: false })

    // Cell values
    vals.forEach((val, ci) => {
      const txt = cellText(val)
      const color = cellColor(val)
      const cellBgColor = cellBg(val)
      const cx = colX[ci + 1]

      // Small coloured dot background
      const dotSize = 10
      const dotX = cx + (P_W - dotSize) / 2
      const dotY = oy + (ROW_H - dotSize) / 2
      doc.roundedRect(dotX, dotY, dotSize, dotSize, 2).fill(cellBgColor)
      doc.fillColor(color).font('Helvetica-Bold').fontSize(7.5)
         .text(txt, cx, oy + 3, { width: P_W, align: 'center', lineBreak: false })
    })

    // Bottom border
    doc.rect(ox, oy + ROW_H - 0.5, tableW, 0.5).fill(BORDER)

    oy += ROW_H
  })

  return oy  // return bottom y of table
}

// ── Render sections two-per-row ────────────────────────────────
function needsNewPage(doc, y, requiredHeight) {
  return y + requiredHeight > PH - 60
}

function sectionHeight(section) {
  return 15 + 12 + section.rows.length * ROW_H + 10
}

// Place sections side by side
let si = 0
while (si < sections.length) {
  const sec1 = sections[si]
  const sec2 = sections[si + 1]

  const h1 = sectionHeight(sec1)
  const h2 = sec2 ? sectionHeight(sec2) : 0
  const blockH = Math.max(h1, h2)

  if (needsNewPage(doc, y, blockH)) {
    doc.addPage()
    page++
    y = 24
  }

  const ox1 = ML
  const ox2 = ML + COL_W + COL_GAP

  const bot1 = drawSectionTable(doc, sec1, ox1, y)
  if (sec2) drawSectionTable(doc, sec2, ox2, y)

  y = Math.max(bot1, sec2 ? y + h2 : 0) + 14
  si += 2
}

// ── FOOTER on last page ────────────────────────────────────────
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
stream.on('error', err => {
  console.error('Error writing PDF:', err)
  process.exit(1)
})

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { amountInWords, formatDate, billNo } from '@/lib/format'
import { AEW_LOGO_BASE64 } from '@/assets/aew-logo-base64'

type Row = Record<string, any>

const clean = (v: any) => String(v ?? '').replace(/[^\x20-\x7E]/g, '')
const num = (v: any) => Number(v ?? 0)
const money = (n: number) => num(n).toFixed(2)

const TYPE_LABELS: Record<string, string> = {
  tax_invoice: 'TAX INVOICE',
  proforma: 'PROFORMA INVOICE',
  quotation: 'QUOTATION',
  challan: 'DELIVERY CHALLAN',
  delivery_challan: 'DELIVERY CHALLAN',
  purchase_order: 'PURCHASE ORDER',
}

export async function buildInvoicePdf(
  invoice: Row,
  items: Row[],
  company: Row | null,
): Promise<Uint8Array> {
  // Delivery challans are goods-movement documents, not payment requests.
  if (String(invoice['invoice_type']) === 'delivery_challan' || String(invoice['invoice_type']) === 'challan') {
    const { buildChallanPdf } = await import('./challan-pdf-build.server')
    return await buildChallanPdf(invoice, items, company)
  }

  const pdf = await PDFDocument.create()
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const italic = await pdf.embedFont(StandardFonts.HelveticaOblique)

  const page = pdf.addPage([595.28, 841.89])
  const M = 28
  const W = 595.28 - M * 2
  const L = M
  const R = M + W
  const black = rgb(0, 0, 0)
  const grey = rgb(0.94, 0.94, 0.94)
  const blue = rgb(0.357, 0.608, 0.835)
  const white = rgb(1, 1, 1)
  const red = rgb(0.86, 0.15, 0.15)

  const c = company ?? {}
  let y = 841.89 - M

  const draw = (
    s: string,
    x: number,
    yy: number,
    size = 9.5,
    o: {
      bold?: boolean
      italic?: boolean
      color?: any
      align?: 'left' | 'right' | 'center'
      width?: number
      maxWidth?: number
      minSize?: number
    } = {},
  ) => {
    const f = o.bold ? bold : o.italic ? italic : font
    let str = clean(s)
    if (!str) return
    let fittedSize = size
    const maxWidth = o.maxWidth
    const minSize = o.minSize ?? 6.5
    if (maxWidth && maxWidth > 0) {
      while (fittedSize > minSize && f.widthOfTextAtSize(str, fittedSize) > maxWidth) {
        fittedSize -= 0.5
      }
      if (f.widthOfTextAtSize(str, fittedSize) > maxWidth) {
        const suffix = '...'
        while (str.length && f.widthOfTextAtSize(`${str}${suffix}`, fittedSize) > maxWidth) {
          str = str.slice(0, -1)
        }
        str = str ? `${str}${suffix}` : ''
      }
    }
    if (!str) return
    const textWidth = f.widthOfTextAtSize(str, fittedSize)
    let x0 = x
    if (o.align === 'right') x0 = x - textWidth
    if (o.align === 'center') x0 = x + ((o.width ?? 0) - textWidth) / 2
    page.drawText(str, { x: x0, y: yy, size: fittedSize, font: f, color: o.color ?? black })
  }

  const wrap = (s: string, maxW: number, size = 9.5, f = font) => {
    const out: string[] = []
    let cur = ''
    for (const word of clean(s).split(/\s+/)) {
      const t = cur ? `${cur} ${word}` : word
      if (f.widthOfTextAtSize(t, size) > maxW) {
        if (cur) out.push(cur)
        if (f.widthOfTextAtSize(word, size) <= maxW) {
          cur = word
        } else {
          let part = ''
          for (const char of word) {
            if (part && f.widthOfTextAtSize(`${part}${char}`, size) > maxW) {
              out.push(part)
              part = char
            } else {
              part += char
            }
          }
          cur = part
        }
      } else cur = t
    }
    if (cur) out.push(cur)
    return out.length ? out : ['']
  }

  // cell: draws border box + text
  const cell = (
    x: number,
    yTop: number,
    w: number,
    h: number,
    txt: string,
    o: { bold?: boolean; align?: 'left' | 'right' | 'center'; fill?: any; size?: number; color?: any } = {},
  ) => {
    page.drawRectangle({
      x,
      y: yTop - h,
      width: w,
      height: h,
      borderColor: black,
      borderWidth: 0.6,
      color: o.fill,
    })
    const size = o.size ?? 9.5
    const ty = yTop - h + (h - size) / 2 + 1
    const maxWidth = Math.max(0, w - 6)
    if (o.align === 'right') draw(txt, x + w - 3, ty, size, { bold: o.bold, align: 'right', color: o.color, maxWidth })
    else if (o.align === 'center') draw(txt, x, ty, size, { bold: o.bold, align: 'center', width: w, color: o.color, maxWidth })
    else draw(txt, x + 3, ty, size, { bold: o.bold, color: o.color, maxWidth })
  }

  // ---------- HEADER ----------
  draw(c['name'] ?? 'ABJAD ENGINEERING WORKS', L, y - 14, 15, {
    bold: true,
    maxWidth: W - 140,
    minSize: 9,
  })
  y -= 18
  const addr =
    [c['address'], c['city'], c['state'] ? `(${c['state']})` : '', c['pincode']].filter(Boolean).join(', ') ||
    'UNIT NO. 008, G-WING, UDYOG BHAVAN -2, PLOT NO. K-3, MIDC ANAND NAGER AMBERNATH (E) PIN 421 506'
  const headLines = wrap(`OFFICE & WORKS: ${addr}`, W - 130, 9)
  for (const l of headLines) {
    draw(l, L, y - 10, 9)
    y -= 10
  }
  const phone = [c['mobile'], c['alt_mobile']].filter(Boolean).join(' / ')
  if (phone) {
    draw(`Mobile: ${phone}`, L, y - 10, 9, { maxWidth: W - 130 })
    y -= 10
  }
  if (c['email']) {
    draw(`Email: ${c['email']}`, L, y - 10, 9, {
      italic: true,
      color: rgb(0.1, 0.2, 0.7),
      maxWidth: W - 130,
    })
    y -= 10
  }
  if (c['website']) {
    draw(`Website: ${c['website']}`, L, y - 10, 9, {
      italic: true,
      color: rgb(0.1, 0.2, 0.7),
      maxWidth: W - 130,
    })
    y -= 10
  }

  // ---------- LOGO ----------
  const logoH = 58
  try {
    const b64 = AEW_LOGO_BASE64
    if (b64) {
      const bytes = Uint8Array.from(atob(b64), (ch) => ch.charCodeAt(0))
      const img = await pdf.embedJpg(bytes)
      const w = (img.width / img.height) * logoH
      page.drawImage(img, { x: R - w, y: 841.89 - M - logoH, width: w, height: logoH })
    }
  } catch {
    // logo optional
  }
  // Never let the content start above the logo's bottom edge.
  y = Math.min(y, 841.89 - M - logoH - 4)

  // ---------- TITLE BANNER ----------
  y -= 4
  page.drawRectangle({ x: L, y: y - 22, width: W, height: 22, color: blue })
  const typeLabel = TYPE_LABELS[String(invoice['invoice_type'])] ?? 'TAX INVOICE'
  draw(typeLabel, L, y - 16, 15, { bold: true, align: 'center', width: W, color: white })
  y -= 26

  // ---------- CUSTOMER + BILL META ----------
  const cw = [0.15, 0.38, 0.14, 0.13, 0.07, 0.13].map((f) => f * W)
  const cx: number[] = []
  cw.reduce((acc, w, i) => {
    cx[i] = acc
    return acc + w
  }, L)
  const rowH = 16
  cell(cx[0]!, y, cw[0]!, rowH, 'CUSTOMER NAME', { bold: true })
  cell(cx[1]!, y, cw[1]!, rowH, invoice['customer_name_snapshot'] ?? '-')
  cell(cx[2]!, y, cw[2]!, rowH, 'Bill No.', { bold: true })
  cell(cx[3]!, y, cw[3]!, rowH, billNo(invoice['invoice_number']))
  cell(cx[4]!, y, cw[4]!, rowH, 'Date', { bold: true })
  cell(cx[5]!, y, cw[5]!, rowH, formatDate(invoice['invoice_date']), { size: 8.5 })
  y -= rowH

  const isTaxInvoice = String(invoice['invoice_type']) === 'tax_invoice'
  const addrH = rowH * (isTaxInvoice ? 4 : 3)
  cell(cx[0]!, y, cw[0]!, addrH, '', { bold: true })
  draw('Address', cx[0]! + 3, y - 12, 9.5, { bold: true })
  const addrLines = wrap(invoice['customer_address_snapshot'] ?? '-', cw[1]! - 6, 9.5).slice(0, 3)
  page.drawRectangle({ x: cx[1]!, y: y - addrH, width: cw[1]!, height: addrH, borderColor: black, borderWidth: 0.6 })
  addrLines.forEach((l, i) => draw(l, cx[1]! + 3, y - 13 - i * 12, 9.5))
  const rightX = cx[2]!
  const rightW = cw[2]! + cw[3]! + cw[4]! + cw[5]!
  if (isTaxInvoice) {
    const metaRowH = addrH / 4
    const metaLabelW = rightW * 0.32

    const metadataRows: Array<[string, string]> = [
      ['PO No.', invoice['po_number'] ?? ''],
      ['PO DATE', invoice['po_date'] ? formatDate(invoice['po_date']) : ''],
      ['Ref. Challan No.', invoice['reference_challan_number'] ?? ''],
      [
        'Ref. Challan Date',
        invoice['reference_challan_date']
          ? formatDate(invoice['reference_challan_date'])
          : '',
      ],
    ]

    metadataRows.forEach(([label, value], index) => {
      const rowY = y - index * metaRowH
      cell(rightX, rowY, metaLabelW, metaRowH, label, { bold: true })
      cell(
        rightX + metaLabelW,
        rowY,
        rightW - metaLabelW,
        metaRowH,
        value,
      )
    })
  } else {
    cell(rightX, y, rightW, addrH, '')
  }
  y -= addrH

  // ---------- BUYER + COMPANY DETAILS ----------
  const half = W / 2
  const lw = 0.3 * half
  const vw = half - lw
  cell(L, y, half, rowH, 'BUYER DETAILS', { bold: true, align: 'center', fill: grey })
  cell(L + half, y, half, rowH, 'COMPANY DETAILS', { bold: true, align: 'center', fill: grey })
  y -= rowH
  cell(L, y, lw, rowH, 'GSTIN NO.', { bold: true })
  cell(L + lw, y, vw, rowH, invoice['customer_gst_snapshot'] ?? '')
  cell(L + half, y, lw, rowH, 'GSTIN NO.', { bold: true })
  cell(L + half + lw, y, vw, rowH, c['gst_number'] ?? '')
  y -= rowH
  cell(L, y, lw, rowH, 'W/O No.', { bold: true })
  cell(L + lw, y, vw, rowH, invoice['work_order_number'] ?? '')
  cell(L + half, y, lw, rowH, 'PAN NO.', { bold: true })
  cell(L + half + lw, y, vw, rowH, c['pan_number'] ?? '')
  y -= rowH

  // ---------- LINE ITEMS ----------
  const iw = [0.06, 0.1, 0.42, 0.09, 0.08, 0.12, 0.13].map((f) => f * W)
  const ix: number[] = []
  iw.reduce((acc, w, i) => {
    ix[i] = acc
    return acc + w
  }, L)
  const heads = ['Sr. No.', 'HSN /SAC', 'Item Description', 'Qty. (Nos)', 'UOM', 'Unit Rate(Rs)', 'Total Amt.(Rs)']
  heads.forEach((h, i) => cell(ix[i]!, y, iw[i]!, rowH + 4, h, { bold: true, align: 'center', fill: grey, size: 8 }))
  y -= rowH + 4

  // totals from accepted quantities
  const lineTotals: number[] = []
  let netValue = 0
  let itemDiscounts = 0
  let taxTotal = 0
  items.forEach((it) => {
    const accepted = num(it['quantity']) - num(it['rejected_quantity'])
    const gross = accepted * num(it['unit_rate'])
    const disc = (gross * num(it['discount_pct'])) / 100
    const net = gross - disc
    const tax = (net * num(it['tax_pct'])) / 100
    lineTotals.push(net + tax)
    netValue += net
    itemDiscounts += disc
    taxTotal += tax
  })

  items.forEach((it, i) => {
    const rejected = num(it['rejected_quantity'])
    const billedQty = num(it['quantity']) - rejected
    let desc = String(it['description'] ?? '')
    if (rejected > 0) desc += ` (Delivered ${num(it['quantity'])}, rejected ${rejected})`
    const lines = wrap(desc, iw[2]! - 6, 9.5)
    const h = Math.max(rowH, lines.length * 11 + 5)
    cell(ix[0]!, y, iw[0]!, h, String(it['sr_no'] ?? i + 1), { align: 'center' })
    cell(ix[1]!, y, iw[1]!, h, it['hsn_code'] ?? '', { align: 'center' })
    page.drawRectangle({ x: ix[2]!, y: y - h, width: iw[2]!, height: h, borderColor: black, borderWidth: 0.6 })
    lines.forEach((l, li) => draw(l, ix[2]! + 3, y - 12 - li * 11, 9.5))
    cell(ix[3]!, y, iw[3]!, h, billedQty.toFixed(0).padStart(2, '0'), { align: 'right' })
    cell(ix[4]!, y, iw[4]!, h, it['uom'] ?? 'NOS', { align: 'center' })
    cell(ix[5]!, y, iw[5]!, h, money(it['unit_rate']), { align: 'right' })
    cell(ix[6]!, y, iw[6]!, h, money(lineTotals[i] ?? num(it['total_amount'])), { align: 'right' })
    y -= h
  })
  for (let f = items.length; f < 8; f++) {
    iw.forEach((w, i) => cell(ix[i]!, y, w, rowH, ''))
    y -= rowH
  }

  // ---------- BANK + TOTALS ----------
  const charges = num(invoice['freight']) + num(invoice['packing_charges']) + num(invoice['other_charges'])
  const subtotal = netValue + charges
  const preRound = subtotal + taxTotal
  const grandTotal = Math.round(preRound)
  const isIgst = Boolean(invoice['is_igst'])
  const sgst = isIgst ? 0 : taxTotal / 2
  const cgst = isIgst ? 0 : taxTotal / 2
  const igst = isIgst ? taxTotal : 0
  const taxPct = items[0]?.['tax_pct'] ? Number(items[0]['tax_pct']) : 0

  const bankW = W * 0.55
  const tLabelW = (W - bankW) * 0.6
  const tRateW = (W - bankW) * 0.15
  const tValW = W - bankW - tLabelW - tRateW

  const totalRows: Array<[string, string, string, boolean?]> = [
    ['Net Value (Rs.)', '', money(netValue), true],
    ['Discount', '', money(itemDiscounts)],
    ['Freight', '', money(invoice['freight'])],
    ['P & F Charges', '', money(invoice['packing_charges'])],
    ['Sub Total', '', money(subtotal)],
    ['SGST', isIgst ? '----' : taxPct ? `${taxPct / 2}%` : '', money(sgst)],
    ['CGST', isIgst ? '----' : taxPct ? `${taxPct / 2}%` : '', money(cgst)],
    ['IGST', isIgst ? (taxPct ? `${taxPct}%` : '') : '----', money(igst)],
    ['Sub Total', '', money(subtotal + taxTotal)],
    ['Round Off', '', money(grandTotal - preRound)],
    ['Grand Total (Rs)', '', money(grandTotal), true],
  ]
  const blockH = totalRows.length * rowH
  const bankTop = y
  page.drawRectangle({ x: L, y: y - blockH, width: bankW, height: blockH, borderColor: black, borderWidth: 0.6 })
  const bank: Array<[string, any]> = [
    ['BANK NAME', c['bank_name']],
    ['A/C NO.', c['bank_account']],
    ['BRANCH IFSC', c['bank_ifsc']],
    ['BRANCH NAME', c['bank_branch']],
  ]
  bank.forEach(([k, v], i) => {
    draw(k, L + 5, bankTop - 15 - i * 14, 9.5, { bold: true, maxWidth: 80 })
    draw(String(v ?? ''), L + 90, bankTop - 15 - i * 14, 9.5, { maxWidth: bankW - 95 })
  })

  const tx = L + bankW
  totalRows.forEach(([label, rate, val, strong]) => {
    cell(tx, y, tLabelW, rowH, label, { bold: !!strong, fill: strong && label.startsWith('Grand') ? grey : undefined })
    cell(tx + tLabelW, y, tRateW, rowH, rate, { align: 'center' })
    cell(tx + tLabelW + tRateW, y, tValW, rowH, val, { align: 'right', bold: !!strong })
    y -= rowH
  })

  // ---------- IN WORDS ----------
  cell(L, y, W, rowH, `In Words. ${amountInWords(grandTotal)}`, { size: 8.5 })
  y -= rowH

  // ---------- FOOTER ----------
  const footL = W * 0.6
  const footH = rowH * 3
  cell(L, y, footL, rowH, 'Delivery : By Road', { bold: false })
  cell(L, y - rowH, footL, rowH, 'Payment : 100% against Performa Invoice')
  cell(
    L,
    y - rowH * 2,
    footL,
    rowH,
    `Contact Person  ${c['contact_person'] ?? '-'} ${[c['mobile'], c['alt_mobile']].filter(Boolean).join(' / ')}`,
    { size: 8.5 },
  )
  page.drawRectangle({ x: L + footL, y: y - footH, width: W - footL, height: footH, borderColor: black, borderWidth: 0.6 })
  draw(`For ${c['name'] ?? 'ABJAD ENGINEERING WORKS'}`, L + footL + 5, y - 13, 9.5, {
    bold: true,
    color: red,
    maxWidth: W - footL - 10,
  })
  draw('Authorised Signatory', L + footL + 5, y - footH + 6, 9.5, { bold: true })
  y -= footH + 10

  // ---------- DECLARATION ----------
  draw('DECLARATION.', L, y, 8, { bold: true })
  y -= 9
  const decl =
    c['declaration'] ??
    'WE DECLARE THAT THIS INVOICE SHOWS THE ACTUAL PRICE OF THE GOODS DESCRIBED THAT ALL PARTICULARS ARE TRUE AND CORRECT'
  wrap(decl, W, 8).forEach((l) => {
    draw(l, L, y, 8)
    y -= 9
  })

  return await pdf.save()
}

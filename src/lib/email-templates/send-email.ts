
import * as React from 'react'
import { render } from '@react-email/render'
import { TEMPLATES } from './registry'

const SITE_NAME = 'Project Setup Assistant'
const FROM_DOMAIN = 'abjadengineeringworks.in'
const RESEND_API_URL = 'https://api.resend.com/emails'

export type SendTemplateEmailResult =
  | { sent: true }
  | { sent: false; reason: 'recipient_suppressed' }

export interface SendTemplateEmailOptions {
  templateData?: Record<string, any>
  idempotencyKey?: string
  replyTo?: string
}

interface ResendErrorResponse {
  message?: string
  name?: string
  statusCode?: number
}

export async function sendTemplateEmail(
  templateName: string,
  to: string,
  options: SendTemplateEmailOptions = {}
): Promise<SendTemplateEmailResult> {
  const apiKey = process.env['RESEND_API_KEY']

  if (!apiKey) {
    throw new Error('RESEND_API_KEY is not configured')
  }

  const template = TEMPLATES[templateName]

  if (!template) {
    throw new Error(
      `Template '${templateName}' not found. Available: ${Object.keys(TEMPLATES).join(', ')}`
    )
  }

  const recipient = template.to || to

  if (!recipient) {
    throw new Error(
      'Recipient is required (the template defines no fixed recipient)'
    )
  }

  const templateData = options.templateData ?? {}
  const element = React.createElement(template.component, templateData)

  const html = await render(element)
  const text = await render(element, { plainText: true })

  const subject =
    typeof template.subject === 'function'
      ? template.subject(templateData)
      : template.subject

  const idempotencyKey =
    options.idempotencyKey || crypto.randomUUID()

  const payload = {
    from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
    to: [recipient],
    subject,
    html,
    text,
    ...(options.replyTo ? { reply_to: options.replyTo } : {}),
    tags: [
      {
        name: 'template',
        value: templateName.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 256),
      },
    ],
  }

  const response = await fetch(RESEND_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    let errorData: ResendErrorResponse = {}

    try {
      errorData = await response.json()
    } catch {
      // Keep the fallback error message.
    }

    const errorMessage =
      errorData.message || `Resend API returned HTTP ${response.status}`

    const errorCode = errorData.name || ''

    if (
      errorCode === 'recipient_suppressed' ||
      /recipient.*suppress|suppress.*recipient|suppression list/i.test(
        errorMessage
      )
    ) {
      return { sent: false, reason: 'recipient_suppressed' }
    }

    throw new Error(`Failed to send email through Resend: ${errorMessage}`)
  }

  return { sent: true }
}

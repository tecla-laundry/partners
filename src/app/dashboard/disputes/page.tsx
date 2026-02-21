'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ImageIcon, Loader2, MessageSquare } from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'

async function fetchLaundryId(
  supabase: ReturnType<typeof import('@/lib/supabase').createClient>
) {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('laundries')
    .select('id')
    .eq('owner_user_id', user.id)
    .single()

  if (error) throw error
  return data.id
}

type OrderRow = {
  id: string
  status: string
  total_price: number
  created_at: string
  pickup_address?: string
  dropoff_address?: string
}

type DeliveryIssueRow = {
  id: string
  order_id: string
  reason: string
  description: string
  photo_urls: string[] | null
  details: Record<string, unknown> | null
  severity: string
  status: string
  resolution_notes: string | null
  created_at: string
  reported_by_role: string
  profiles?: { full_name: string | null; email: string | null } | { full_name: string | null; email: string | null }[]
}

type DisputeResponseRow = {
  id: string
  order_id: string
  respondent_role: string
  message: string
  accepted_resolution: boolean
  created_at: string
  profiles?: { full_name: string | null; email: string | null } | { full_name: string | null; email: string | null }[]
}

async function fetchDisputedOrders(
  supabase: ReturnType<typeof import('@/lib/supabase').createClient>,
  laundryId: string
): Promise<OrderRow[]> {
  const { data, error } = await supabase
    .from('orders')
    .select('id, status, total_price, created_at, pickup_address, dropoff_address')
    .eq('laundry_id', laundryId)
    .eq('status', 'disputed')
    .order('created_at', { ascending: false })

  if (error) throw error
  return data || []
}

async function fetchIssuesForOrder(
  supabase: ReturnType<typeof import('@/lib/supabase').createClient>,
  orderId: string
): Promise<DeliveryIssueRow[]> {
  const { data, error } = await supabase
    .from('delivery_issues')
    .select(
      `
      id,
      order_id,
      reason,
      description,
      photo_urls,
      details,
      severity,
      status,
      resolution_notes,
      created_at,
      reported_by_role,
      profiles!delivery_issues_reported_by_fkey ( full_name, email )
    `
    )
    .eq('order_id', orderId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data || []) as DeliveryIssueRow[]
}

async function fetchResponsesForOrder(
  supabase: ReturnType<typeof import('@/lib/supabase').createClient>,
  orderId: string
): Promise<DisputeResponseRow[]> {
  const { data, error } = await supabase
    .from('dispute_responses')
    .select(
      `
      id,
      order_id,
      respondent_role,
      message,
      accepted_resolution,
      created_at,
      profiles!dispute_responses_respondent_user_id_fkey ( full_name, email )
    `
    )
    .eq('order_id', orderId)
    .order('created_at', { ascending: true })

  if (error) throw error
  return (data || []) as DisputeResponseRow[]
}

function normalizeProfile(
  v:
    | { full_name: string | null; email: string | null }
    | { full_name: string | null; email: string | null }[]
    | undefined
): { full_name: string | null; email: string | null } | null {
  if (!v) return null
  return Array.isArray(v) ? (v[0] ?? null) : v
}

function severityVariant(sev: string): 'destructive' | 'default' | 'secondary' {
  if (sev === 'critical') return 'destructive'
  if (sev === 'high') return 'default'
  return 'secondary'
}

export default function DisputesPage() {
  const supabase = createClient()
  const queryClient = useQueryClient()
  const [evidenceOrderId, setEvidenceOrderId] = useState<string | null>(null)
  const [respondOrderId, setRespondOrderId] = useState<string | null>(null)
  const [responseMessage, setResponseMessage] = useState('')
  const [acceptResolution, setAcceptResolution] = useState(false)
  const [saving, setSaving] = useState(false)

  const { data: laundryId, isLoading: loadingId } = useQuery({
    queryKey: ['laundry-id'],
    queryFn: () => fetchLaundryId(supabase),
  })

  const { data: orders, isLoading: loadingOrders } = useQuery({
    queryKey: ['disputes', laundryId],
    queryFn: () => fetchDisputedOrders(supabase, laundryId!),
    enabled: !!laundryId,
  })

  const { data: issues = [], isLoading: loadingIssues } = useQuery({
    queryKey: ['dispute-issues', evidenceOrderId],
    queryFn: () => fetchIssuesForOrder(supabase, evidenceOrderId!),
    enabled: !!evidenceOrderId,
  })

  const { data: responses = [], isLoading: loadingResponses } = useQuery({
    queryKey: ['dispute-responses', respondOrderId],
    queryFn: () => fetchResponsesForOrder(supabase, respondOrderId!),
    enabled: !!respondOrderId,
  })

  const submitResponse = async () => {
    if (!respondOrderId || !responseMessage.trim()) {
      toast.error('Please enter a message')
      return
    }
    setSaving(true)
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { error } = await supabase.from('dispute_responses').insert({
        order_id: respondOrderId,
        respondent_user_id: user.id,
        respondent_role: 'laundry_owner',
        message: responseMessage.trim(),
        accepted_resolution: acceptResolution,
      })

      if (error) throw error
      toast.success(acceptResolution ? 'Response and acceptance recorded' : 'Response sent')
      setRespondOrderId(null)
      setResponseMessage('')
      setAcceptResolution(false)
      await queryClient.invalidateQueries({ queryKey: ['disputes', laundryId] })
      await queryClient.invalidateQueries({ queryKey: ['dispute-responses', respondOrderId] })
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to submit response')
    } finally {
      setSaving(false)
    }
  }

  const isLoading = loadingId || loadingOrders

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Disputes</h1>
        <p className="text-sm text-muted-foreground">
          Orders with disputes or reported issues. View evidence and respond or accept resolution.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Disputed orders</CardTitle>
          <CardDescription>
            List of orders with disputes involving your laundry. You can view evidence and add your response.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : !orders?.length ? (
            <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
              No disputed orders. Disputes will appear here when an issue is reported on one of your orders.
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="w-[220px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-mono text-sm">
                        {order.id.slice(0, 8)}…
                      </TableCell>
                      <TableCell>R{Number(order.total_price || 0).toFixed(2)}</TableCell>
                      <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                        {format(new Date(order.created_at), 'MMM d, yyyy HH:mm')}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setEvidenceOrderId(order.id)}
                            className="gap-1"
                          >
                            <ImageIcon className="h-3.5 w-3.5" />
                            View evidence
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setRespondOrderId(order.id)
                              setResponseMessage('')
                              setAcceptResolution(false)
                            }}
                            className="gap-1"
                          >
                            <MessageSquare className="h-3.5 w-3.5" />
                            Respond
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Evidence dialog */}
      <Dialog open={!!evidenceOrderId} onOpenChange={(open) => !open && setEvidenceOrderId(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Dispute evidence</DialogTitle>
            <DialogDescription>
              Photos and notes reported for this order. Admin will use this to resolve the dispute.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {loadingIssues ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : issues.length === 0 ? (
              <p className="text-sm text-muted-foreground">No issue details on file.</p>
            ) : (
              issues.map((issue) => {
                const reporter = normalizeProfile(issue.profiles)
                const reporterLabel = reporter?.full_name || reporter?.email || issue.reported_by_role
                return (
                  <div
                    key={issue.id}
                    className="rounded-lg border p-4 space-y-3"
                  >
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <Badge variant={severityVariant(issue.severity)}>
                        {issue.severity}
                      </Badge>
                      <Badge variant="secondary">{issue.status}</Badge>
                      <span className="text-xs text-muted-foreground">
                        {issue.reason.replace(/_/g, ' ')} • {reporterLabel} •{' '}
                        {format(new Date(issue.created_at), 'MMM d, yyyy')}
                      </span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{issue.description}</p>
                    {issue.photo_urls?.length ? (
                      <div>
                        <p className="text-xs text-muted-foreground mb-2">Photos</p>
                        <div className="flex flex-wrap gap-2">
                          {issue.photo_urls.map((url) => (
                            <a
                              key={url}
                              href={url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 rounded border px-2 py-1 text-xs text-primary underline"
                            >
                              <ImageIcon className="h-3 w-3" />
                              View photo
                            </a>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    {issue.details && Object.keys(issue.details).length > 0 ? (
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Details</p>
                        <pre className="max-h-32 overflow-auto rounded bg-muted p-2 text-xs">
                          {JSON.stringify(issue.details, null, 2)}
                        </pre>
                      </div>
                    ) : null}
                    {issue.resolution_notes ? (
                      <div className="rounded bg-muted/50 p-2 text-sm">
                        <span className="text-muted-foreground">Resolution: </span>
                        {issue.resolution_notes}
                      </div>
                    ) : null}
                  </div>
                )
              })
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Respond / Accept resolution dialog */}
      <Dialog open={!!respondOrderId} onOpenChange={(open) => !open && setRespondOrderId(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Respond to dispute</DialogTitle>
            <DialogDescription>
              Add your response for the admin. You can also mark that you accept the resolution once admin has proposed one.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {respondOrderId && (
              <>
                {loadingResponses ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : responses.length > 0 ? (
                  <div className="rounded-md border p-3 space-y-2 max-h-32 overflow-y-auto">
                    <p className="text-xs font-medium text-muted-foreground">Previous responses</p>
                    {responses.map((r) => {
                      const author = normalizeProfile(r.profiles)
                      const label =
                        r.respondent_role === 'laundry_owner'
                          ? 'You'
                          : author?.full_name || author?.email || r.respondent_role
                      return (
                        <div key={r.id} className="text-sm">
                          <span className="font-medium">{label}</span>
                          {r.accepted_resolution && (
                            <Badge variant="secondary" className="ml-2 text-xs">
                              Accepted resolution
                            </Badge>
                          )}
                          <p className="text-muted-foreground mt-0.5">{r.message}</p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(r.created_at), 'MMM d, yyyy HH:mm')}
                          </p>
                        </div>
                      )
                    })}
                  </div>
                ) : null}

                <div className="space-y-2">
                  <Label htmlFor="dispute-message">Your message</Label>
                  <Textarea
                    id="dispute-message"
                    placeholder="Describe your side or accept the proposed resolution..."
                    value={responseMessage}
                    onChange={(e) => setResponseMessage(e.target.value)}
                    rows={4}
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="accept-resolution"
                    checked={acceptResolution}
                    onCheckedChange={(v) => setAcceptResolution(v === true)}
                  />
                  <Label
                    htmlFor="accept-resolution"
                    className="text-sm font-normal cursor-pointer"
                  >
                    I accept the proposed resolution
                  </Label>
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setRespondOrderId(null)
                      setResponseMessage('')
                      setAcceptResolution(false)
                    }}
                    disabled={saving}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={submitResponse}
                    disabled={saving || !responseMessage.trim()}
                  >
                    {saving ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Sending…
                      </>
                    ) : (
                      'Send response'
                    )}
                  </Button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

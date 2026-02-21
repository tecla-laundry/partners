'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Star, MessageSquare, Loader2 } from 'lucide-react'
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

type ReviewRow = {
  id: string
  order_id: string
  laundry_id: string
  customer_id: string
  rating: number
  comment: string | null
  created_at: string
  partner_response: string | null
  responded_at: string | null
  responded_by: string | null
  profiles?: { full_name: string | null; email: string | null } | { full_name: string | null; email: string | null }[]
}

async function fetchReviews(
  supabase: ReturnType<typeof import('@/lib/supabase').createClient>,
  laundryId: string
): Promise<ReviewRow[]> {
  const { data, error } = await supabase
    .from('laundry_reviews')
    .select(
      `
      id,
      order_id,
      laundry_id,
      customer_id,
      rating,
      comment,
      created_at,
      partner_response,
      responded_at,
      responded_by,
      profiles!laundry_reviews_customer_id_fkey ( full_name, email )
    `
    )
    .eq('laundry_id', laundryId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data || []) as ReviewRow[]
}

function normalizeProfile(
  v: { full_name: string | null; email: string | null } | { full_name: string | null; email: string | null }[] | undefined
): { full_name: string | null; email: string | null } | null {
  if (!v) return null
  return Array.isArray(v) ? (v[0] ?? null) : v
}

export default function ReviewsPage() {
  const supabase = createClient()
  const queryClient = useQueryClient()
  const [respondReview, setRespondReview] = useState<ReviewRow | null>(null)
  const [responseText, setResponseText] = useState('')
  const [saving, setSaving] = useState(false)

  const { data: laundryId, isLoading: loadingId } = useQuery({
    queryKey: ['laundry-id'],
    queryFn: () => fetchLaundryId(supabase),
  })

  const { data: reviews, isLoading: loadingReviews } = useQuery({
    queryKey: ['reviews', laundryId],
    queryFn: () => fetchReviews(supabase, laundryId!),
    enabled: !!laundryId,
  })

  const submitResponse = async () => {
    if (!respondReview || !responseText.trim()) return
    setSaving(true)
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { error } = await supabase
        .from('laundry_reviews')
        .update({
          partner_response: responseText.trim(),
          responded_at: new Date().toISOString(),
          responded_by: user.id,
        })
        .eq('id', respondReview.id)

      if (error) throw error
      toast.success('Response published')
      setRespondReview(null)
      setResponseText('')
      await queryClient.invalidateQueries({ queryKey: ['reviews', laundryId] })
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to save response')
    } finally {
      setSaving(false)
    }
  }

  const openRespond = (row: ReviewRow) => {
    setRespondReview(row)
    setResponseText(row.partner_response || '')
  }

  const isLoading = loadingId || loadingReviews

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Ratings & Reviews</h1>
        <p className="text-sm text-muted-foreground">
          See what customers are saying about your laundry and respond to reviews.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Customer reviews</CardTitle>
          <CardDescription>
            All reviews for your laundry. You can reply once per review.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : !reviews?.length ? (
            <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
              No reviews yet. Reviews will appear here after customers complete orders and leave feedback.
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Rating</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Comment</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Your response</TableHead>
                    <TableHead className="w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reviews.map((row) => {
                    const customer = normalizeProfile(row.profiles)
                    const label = customer?.full_name || customer?.email || 'Customer'
                    return (
                      <TableRow key={row.id}>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {[1, 2, 3, 4, 5].map((s) => (
                              <Star
                                key={s}
                                className={`h-4 w-4 ${
                                  s <= row.rating
                                    ? 'fill-amber-400 text-amber-400'
                                    : 'text-muted'
                                }`}
                              />
                            ))}
                            <span className="ml-1 text-sm font-medium">{row.rating}</span>
                          </div>
                        </TableCell>
                        <TableCell className="max-w-[160px] truncate" title={label}>
                          {label}
                        </TableCell>
                        <TableCell className="max-w-[280px]">
                          <span className="line-clamp-2 text-sm">
                            {row.comment || '—'}
                          </span>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                          {format(new Date(row.created_at), 'MMM d, yyyy')}
                        </TableCell>
                        <TableCell className="max-w-[240px]">
                          {row.partner_response ? (
                            <span className="line-clamp-2 text-sm">
                              {row.partner_response}
                            </span>
                          ) : (
                            <Badge variant="secondary">No response</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openRespond(row)}
                            className="gap-1"
                          >
                            <MessageSquare className="h-3.5 w-3.5" />
                            {row.partner_response ? 'Edit response' : 'Respond'}
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!respondReview} onOpenChange={(open) => !open && setRespondReview(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Respond to review</DialogTitle>
            <DialogDescription>
              Your response will be visible to the customer. You can edit it later.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {respondReview && (
              <div className="rounded-md bg-muted/50 p-3 text-sm">
                <div className="flex items-center gap-2 mb-1">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star
                      key={s}
                      className={`h-4 w-4 ${
                        s <= respondReview.rating
                          ? 'fill-amber-400 text-amber-400'
                          : 'text-muted'
                      }`}
                    />
                  ))}
                </div>
                <p className="text-muted-foreground">{respondReview.comment || 'No comment'}</p>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="response">Your response</Label>
              <Textarea
                id="response"
                placeholder="Thank you for your feedback..."
                value={responseText}
                onChange={(e) => setResponseText(e.target.value)}
                rows={4}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setRespondReview(null)
                  setResponseText('')
                }}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button onClick={submitResponse} disabled={saving || !responseText.trim()}>
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Saving…
                  </>
                ) : (
                  'Publish response'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

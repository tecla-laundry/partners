'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CheckCircle2, Clock } from 'lucide-react'

export default function OnboardingSuccessPage() {
  const router = useRouter()

  return (
    <div className="container mx-auto flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <CheckCircle2 className="h-8 w-8 text-green-600" />
          </div>
          <CardTitle className="text-2xl">Application Submitted!</CardTitle>
          <CardDescription>
            Your laundry partner application has been successfully submitted
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border bg-muted/50 p-4">
            <div className="flex items-start gap-3">
              <Clock className="mt-0.5 h-5 w-5 text-muted-foreground" />
              <div>
                <p className="font-medium">What's Next?</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Our team will review your application and get back to you within 1-2 business
                  days. You'll receive an email notification once your application has been reviewed.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">While you wait:</p>
            <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
              <li>Check your email for confirmation</li>
              <li>Ensure all your business documents are ready</li>
              <li>You can sign in to check your application status</li>
            </ul>
          </div>

          <div className="flex flex-col gap-2 pt-4">
            <Link href="/sign-in" className="w-full">
              <Button className="w-full">Sign In</Button>
            </Link>
            <Link href="/" className="w-full">
              <Button variant="outline" className="w-full">
                Return to Home
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

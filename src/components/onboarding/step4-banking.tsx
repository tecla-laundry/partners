'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2 } from 'lucide-react'

const bankingSchema = z.object({
  bank_name: z.string().min(2, 'Bank name is required'),
  account_number: z.string().min(5, 'Account number is required'),
  account_holder: z.string().min(2, 'Account holder name is required'),
  branch_code: z.string().optional(),
  account_type: z.enum(['checking', 'savings'], {
    required_error: 'Please select an account type',
  }),
})

type BankingFormValues = z.infer<typeof bankingSchema>

interface OnboardingStep4Props {
  initialData: Record<string, any>
  onNext: (data: Record<string, any>) => void
  onBack: () => void
  onSubmit: (data: Record<string, any>) => void
  isLastStep?: boolean
  loading?: boolean
}

export function OnboardingStep4({
  initialData,
  onNext,
  onBack,
  onSubmit,
  isLastStep = true,
  loading = false,
}: OnboardingStep4Props) {
  const form = useForm<BankingFormValues>({
    resolver: zodResolver(bankingSchema),
    defaultValues: {
      bank_name: initialData.bank_details?.bank_name || '',
      account_number: initialData.bank_details?.account_number || '',
      account_holder: initialData.bank_details?.account_holder || '',
      branch_code: initialData.bank_details?.branch_code || '',
      account_type: initialData.bank_details?.account_type || 'checking',
    },
  })

  const handleSubmit = (values: BankingFormValues) => {
    const bankDetails = {
      bank_name: values.bank_name,
      account_number: values.account_number,
      account_holder: values.account_holder,
      branch_code: values.branch_code,
      account_type: values.account_type,
    }
    onSubmit({ bank_details: bankDetails })
  }

  return (
    <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="bank_name">Bank Name *</Label>
        <Input
          id="bank_name"
          placeholder="Standard Bank"
          {...form.register('bank_name')}
          disabled={loading}
        />
        {form.formState.errors.bank_name && (
          <p className="text-sm text-destructive">{form.formState.errors.bank_name.message}</p>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="account_number">Account Number *</Label>
          <Input
            id="account_number"
            placeholder="1234567890"
            {...form.register('account_number')}
            disabled={loading}
          />
          {form.formState.errors.account_number && (
            <p className="text-sm text-destructive">
              {form.formState.errors.account_number.message}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="branch_code">Branch Code</Label>
          <Input
            id="branch_code"
            placeholder="000000"
            {...form.register('branch_code')}
            disabled={loading}
          />
          {form.formState.errors.branch_code && (
            <p className="text-sm text-destructive">
              {form.formState.errors.branch_code.message}
            </p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="account_holder">Account Holder Name *</Label>
        <Input
          id="account_holder"
          placeholder="John Doe"
          {...form.register('account_holder')}
          disabled={loading}
        />
        {form.formState.errors.account_holder && (
          <p className="text-sm text-destructive">
            {form.formState.errors.account_holder.message}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="account_type">Account Type *</Label>
        <select
          id="account_type"
          {...form.register('account_type')}
          disabled={loading}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <option value="checking">Checking Account</option>
          <option value="savings">Savings Account</option>
        </select>
        {form.formState.errors.account_type && (
          <p className="text-sm text-destructive">
            {form.formState.errors.account_type.message}
          </p>
        )}
      </div>

      <div className="rounded-lg border bg-muted/50 p-4">
        <p className="text-sm text-muted-foreground">
          Your banking details are encrypted and stored securely. They will only be used for
          processing payouts to your account.
        </p>
      </div>

      <div className="flex justify-end gap-4">
        <Button type="button" variant="outline" onClick={onBack} disabled={loading}>
          Back
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Submitting Application...
            </>
          ) : (
            'Submit Application'
          )}
        </Button>
      </div>
    </form>
  )
}

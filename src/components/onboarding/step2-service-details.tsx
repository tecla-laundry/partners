'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Loader2 } from 'lucide-react'

const serviceDetailsSchema = z.object({
  services_offered: z.array(z.string()).min(1, 'Select at least one service'),
  price_per_kg: z.number().positive('Price must be greater than 0'),
  capacity_per_day: z.number().int().positive('Capacity must be a positive integer'),
  operating_hours: z.record(
    z.string(),
    z.object({
      open: z.string().min(1, 'Opening time is required'),
      close: z.string().min(1, 'Closing time is required'),
    })
  ),
})

type ServiceDetailsFormValues = z.infer<typeof serviceDetailsSchema>

interface OnboardingStep2Props {
  initialData: Record<string, any>
  onNext: (data: Record<string, any>) => void
  onBack: () => void
  onSubmit?: (data: Record<string, any>) => void
  isLastStep?: boolean
  loading?: boolean
}

const DAYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const

const SERVICE_OPTIONS = [
  { id: 'wash_and_fold', label: 'Wash & Fold' },
  { id: 'dry_clean', label: 'Dry Clean' },
  { id: 'iron_only', label: 'Iron Only' },
  { id: 'express', label: 'Express Service' },
]

export function OnboardingStep2({
  initialData,
  onNext,
  onBack,
  isLastStep = false,
  loading = false,
}: OnboardingStep2Props) {
  const form = useForm<ServiceDetailsFormValues>({
    resolver: zodResolver(serviceDetailsSchema),
    defaultValues: {
      services_offered: initialData.services_offered || [],
      price_per_kg: initialData.price_per_kg || 0,
      capacity_per_day: initialData.capacity_per_day || 0,
      operating_hours: initialData.operating_hours || {
        monday: { open: '08:00', close: '18:00' },
        tuesday: { open: '08:00', close: '18:00' },
        wednesday: { open: '08:00', close: '18:00' },
        thursday: { open: '08:00', close: '18:00' },
        friday: { open: '08:00', close: '18:00' },
        saturday: { open: '08:00', close: '18:00' },
        sunday: { open: '09:00', close: '17:00' },
      },
    },
  })

  const services = form.watch('services_offered')

  const toggleService = (serviceId: string) => {
    const current = form.getValues('services_offered')
    if (current.includes(serviceId)) {
      form.setValue(
        'services_offered',
        current.filter((s) => s !== serviceId)
      )
    } else {
      form.setValue('services_offered', [...current, serviceId])
    }
  }

  const onSubmit = (values: ServiceDetailsFormValues) => {
    onNext(values)
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      <div className="space-y-4">
        <Label>Services Offered *</Label>
        <div className="grid gap-3 md:grid-cols-2">
          {SERVICE_OPTIONS.map((service) => (
            <div key={service.id} className="flex items-center space-x-2">
              <Checkbox
                id={service.id}
                checked={services.includes(service.id)}
                onCheckedChange={() => toggleService(service.id)}
                disabled={loading}
              />
              <Label
                htmlFor={service.id}
                className="cursor-pointer text-sm font-normal leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                {service.label}
              </Label>
            </div>
          ))}
        </div>
        {form.formState.errors.services_offered && (
          <p className="text-sm text-destructive">
            {form.formState.errors.services_offered.message}
          </p>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="price_per_kg">Price per kg (R) *</Label>
          <Input
            id="price_per_kg"
            type="number"
            step="0.01"
            min="0"
            placeholder="25.00"
            {...form.register('price_per_kg', { valueAsNumber: true })}
            disabled={loading}
          />
          {form.formState.errors.price_per_kg && (
            <p className="text-sm text-destructive">
              {form.formState.errors.price_per_kg.message}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="capacity_per_day">Daily Capacity (kg) *</Label>
          <Input
            id="capacity_per_day"
            type="number"
            min="1"
            placeholder="100"
            {...form.register('capacity_per_day', { valueAsNumber: true })}
            disabled={loading}
          />
          {form.formState.errors.capacity_per_day && (
            <p className="text-sm text-destructive">
              {form.formState.errors.capacity_per_day.message}
            </p>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <Label>Operating Hours *</Label>
        <div className="space-y-3">
          {DAYS.map((day) => {
            const dayName = day.charAt(0).toUpperCase() + day.slice(1)
            return (
              <div key={day} className="grid grid-cols-3 gap-2 items-center">
                <Label className="text-sm font-medium">{dayName}</Label>
                <Input
                  type="time"
                  {...form.register(`operating_hours.${day}.open`)}
                  disabled={loading}
                />
                <Input
                  type="time"
                  {...form.register(`operating_hours.${day}.close`)}
                  disabled={loading}
                />
              </div>
            )
          })}
        </div>
        {form.formState.errors.operating_hours && (
          <p className="text-sm text-destructive">
            Please ensure all operating hours are set correctly
          </p>
        )}
      </div>

      <div className="flex justify-end gap-4">
        <Button type="button" variant="outline" onClick={onBack} disabled={loading}>
          Back
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processing...
            </>
          ) : (
            'Next: Photos'
          )}
        </Button>
      </div>
    </form>
  )
}

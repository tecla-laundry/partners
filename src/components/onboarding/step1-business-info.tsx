'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { MapPin, Loader2 } from 'lucide-react'

const businessInfoSchema = z.object({
  business_name: z.string().min(2, 'Business name must be at least 2 characters'),
  owner_name: z.string().min(2, 'Owner name must be at least 2 characters'),
  email: z.string().email('Please enter a valid email address'),
  phone: z.string().min(10, 'Please enter a valid phone number'),
  physical_address: z.string().min(5, 'Please enter a complete address'),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
})

type BusinessInfoFormValues = z.infer<typeof businessInfoSchema>

interface OnboardingStep1Props {
  initialData: Record<string, any>
  onNext: (data: Record<string, any>) => void
  onBack: () => void
  onSubmit?: (data: Record<string, any>) => void
  isLastStep?: boolean
  loading?: boolean
}

export function OnboardingStep1({
  initialData,
  onNext,
  onBack,
  isLastStep = false,
  loading = false,
}: OnboardingStep1Props) {
  const [geocoding, setGeocoding] = useState(false)
  const supabase = createClient()

  const form = useForm<BusinessInfoFormValues>({
    resolver: zodResolver(businessInfoSchema),
    defaultValues: {
      business_name: initialData.business_name || '',
      owner_name: initialData.owner_name || '',
      email: initialData.email || '',
      phone: initialData.phone || '',
      physical_address: initialData.physical_address || '',
      latitude: initialData.latitude || 0,
      longitude: initialData.longitude || 0,
    },
  })

  // Get user email from auth
  useEffect(() => {
    const loadUserEmail = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (user?.email && !form.getValues('email')) {
        form.setValue('email', user.email)
      }
    }
    loadUserEmail()
  }, [supabase, form])

  const geocodeAddress = async (address: string) => {
    if (!address || address.length < 5) return

    setGeocoding(true)
    try {
      // Using a geocoding service (you can use Google Maps Geocoding API, OpenStreetMap Nominatim, etc.)
      // For now, we'll use a simple approach - you should replace this with your preferred geocoding service
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`
      )
      const data = await response.json()

      if (data && data.length > 0) {
        const lat = parseFloat(data[0].lat)
        const lon = parseFloat(data[0].lon)
        form.setValue('latitude', lat)
        form.setValue('longitude', lon)
        toast.success('Address geocoded successfully')
      } else {
        toast.error('Could not find coordinates for this address')
      }
    } catch (error) {
      console.error('Geocoding error:', error)
      toast.error('Failed to geocode address. Please enter coordinates manually.')
    } finally {
      setGeocoding(false)
    }
  }

  const onSubmit = async (values: BusinessInfoFormValues) => {
    // If coordinates are missing, try to geocode
    if ((!values.latitude || !values.longitude) && values.physical_address) {
      await geocodeAddress(values.physical_address)
      // Wait a moment for geocoding to complete
      await new Promise((resolve) => setTimeout(resolve, 1000))
      const updatedValues = form.getValues()
      if (!updatedValues.latitude || !updatedValues.longitude) {
        toast.error('Please ensure coordinates are set before continuing')
        return
      }
      onNext(updatedValues)
    } else {
      onNext(values)
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="business_name">Business Name *</Label>
          <Input
            id="business_name"
            placeholder="ABC Laundry Services"
            {...form.register('business_name')}
            disabled={loading}
          />
          {form.formState.errors.business_name && (
            <p className="text-sm text-destructive">
              {form.formState.errors.business_name.message}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="owner_name">Owner Name *</Label>
          <Input
            id="owner_name"
            placeholder="John Doe"
            {...form.register('owner_name')}
            disabled={loading}
          />
          {form.formState.errors.owner_name && (
            <p className="text-sm text-destructive">
              {form.formState.errors.owner_name.message}
            </p>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="email">Email *</Label>
          <Input
            id="email"
            type="email"
            placeholder="business@example.com"
            {...form.register('email')}
            disabled={loading}
          />
          {form.formState.errors.email && (
            <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone">Phone Number *</Label>
          <Input
            id="phone"
            type="tel"
            placeholder="+27 12 345 6789"
            {...form.register('phone')}
            disabled={loading}
          />
          {form.formState.errors.phone && (
            <p className="text-sm text-destructive">{form.formState.errors.phone.message}</p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="physical_address">Physical Address *</Label>
        <div className="flex gap-2">
          <Input
            id="physical_address"
            placeholder="123 Main Street, Johannesburg, South Africa"
            {...form.register('physical_address')}
            disabled={loading}
            className="flex-1"
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => geocodeAddress(form.getValues('physical_address'))}
            disabled={geocoding || loading}
          >
            {geocoding ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <MapPin className="h-4 w-4" />
            )}
          </Button>
        </div>
        {form.formState.errors.physical_address && (
          <p className="text-sm text-destructive">
            {form.formState.errors.physical_address.message}
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          Click the map icon to automatically get coordinates from your address
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="latitude">Latitude</Label>
          <Input
            id="latitude"
            type="number"
            step="any"
            placeholder="-26.2041"
            {...form.register('latitude', { valueAsNumber: true })}
            disabled={loading}
          />
          {form.formState.errors.latitude && (
            <p className="text-sm text-destructive">
              {form.formState.errors.latitude.message}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="longitude">Longitude</Label>
          <Input
            id="longitude"
            type="number"
            step="any"
            placeholder="28.0473"
            {...form.register('longitude', { valueAsNumber: true })}
            disabled={loading}
          />
          {form.formState.errors.longitude && (
            <p className="text-sm text-destructive">
              {form.formState.errors.longitude.message}
            </p>
          )}
        </div>
      </div>

      <div className="flex justify-end gap-4">
        <Button type="button" variant="outline" onClick={onBack} disabled={loading}>
          Back
        </Button>
        <Button type="submit" disabled={loading || geocoding}>
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processing...
            </>
          ) : (
            'Next: Service Details'
          )}
        </Button>
      </div>
    </form>
  )
}

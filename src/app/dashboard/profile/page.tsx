'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase'
import { callEdgeFunction } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  Building2,
  MapPin,
  DollarSign,
  Clock,
  Image as ImageIcon,
  CreditCard,
  AlertTriangle,
  CheckCircle2,
  Loader2,
} from 'lucide-react'

const businessInfoSchema = z.object({
  business_name: z.string().min(2, 'Business name must be at least 2 characters'),
  owner_name: z.string().min(2, 'Owner name must be at least 2 characters'),
  email: z.string().email('Please enter a valid email address'),
  phone: z.string().min(10, 'Please enter a valid phone number'),
  physical_address: z.string().min(5, 'Please enter a complete address'),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
})

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

const bankingSchema = z.object({
  bank_name: z.string().min(2, 'Bank name is required'),
  account_number: z.string().min(5, 'Account number is required'),
  account_holder: z.string().min(2, 'Account holder name is required'),
  branch_code: z.string().optional(),
  account_type: z.enum(['checking', 'savings']),
})

type BusinessInfoFormValues = z.infer<typeof businessInfoSchema>
type ServiceDetailsFormValues = z.infer<typeof serviceDetailsSchema>
type BankingFormValues = z.infer<typeof bankingSchema>

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const
const SERVICE_OPTIONS = [
  { id: 'wash_and_fold', label: 'Wash & Fold' },
  { id: 'dry_clean', label: 'Dry Clean' },
  { id: 'iron_only', label: 'Iron Only' },
  { id: 'express', label: 'Express Service' },
]

async function fetchLaundryProfile(
  supabase: ReturnType<typeof import('@/lib/supabase').createClient>
) {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('laundries')
    .select('*')
    .eq('owner_user_id', user.id)
    .single()

  if (error) throw error
  return data
}

export default function ProfilePage() {
  const supabase = createClient()
  const queryClient = useQueryClient()
  const [needsReapproval, setNeedsReapproval] = useState(false)
  const [originalData, setOriginalData] = useState<any>(null)

  const { data: laundry, isLoading } = useQuery({
    queryKey: ['laundry-profile'],
    queryFn: () => fetchLaundryProfile(supabase),
  })

  useEffect(() => {
    if (laundry) {
      setOriginalData(laundry)
    }
  }, [laundry])

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      return await callEdgeFunction('submit_laundry_application', {
        laundry_data: data,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['laundry-profile'] })
      toast.success('Profile updated successfully')
      if (needsReapproval) {
        toast.info('Your changes require re-approval. Your application is pending review.')
      }
      setNeedsReapproval(false)
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update profile')
    },
  })

  const checkCriticalChanges = (newData: any) => {
    if (!originalData) return false
    // Check if address or services changed
    const addressChanged =
      newData.physical_address !== originalData.physical_address ||
      newData.latitude !== originalData.latitude ||
      newData.longitude !== originalData.longitude

    const servicesChanged =
      JSON.stringify(newData.services_offered?.sort()) !==
      JSON.stringify(originalData.services_offered?.sort())

    return addressChanged || servicesChanged
  }

  const businessForm = useForm<BusinessInfoFormValues>({
    resolver: zodResolver(businessInfoSchema),
    defaultValues: {
      business_name: '',
      owner_name: '',
      email: '',
      phone: '',
      physical_address: '',
      latitude: 0,
      longitude: 0,
    },
  })

  const serviceForm = useForm<ServiceDetailsFormValues>({
    resolver: zodResolver(serviceDetailsSchema),
    defaultValues: {
      services_offered: [],
      price_per_kg: 0,
      capacity_per_day: 0,
      operating_hours: {},
    },
  })

  const bankingForm = useForm<BankingFormValues>({
    resolver: zodResolver(bankingSchema),
    defaultValues: {
      bank_name: '',
      account_number: '',
      account_holder: '',
      branch_code: '',
      account_type: 'checking',
    },
  })

  useEffect(() => {
    if (laundry) {
      businessForm.reset({
        business_name: laundry.business_name || '',
        owner_name: laundry.owner_name || '',
        email: laundry.email || '',
        phone: laundry.phone || '',
        physical_address: laundry.physical_address || '',
        latitude: Number(laundry.latitude) || 0,
        longitude: Number(laundry.longitude) || 0,
      })

      serviceForm.reset({
        services_offered: laundry.services_offered || [],
        price_per_kg: Number(laundry.price_per_kg) || 0,
        capacity_per_day: laundry.capacity_per_day || 0,
        operating_hours: laundry.operating_hours || {},
      })

      if (laundry.bank_details) {
        bankingForm.reset({
          bank_name: laundry.bank_details.bank_name || '',
          account_number: laundry.bank_details.account_number || '',
          account_holder: laundry.bank_details.account_holder || '',
          branch_code: laundry.bank_details.branch_code || '',
          account_type: laundry.bank_details.account_type || 'checking',
        })
      }
    }
  }, [laundry, businessForm, serviceForm, bankingForm])

  const handleBusinessSubmit = async (values: BusinessInfoFormValues) => {
    const willNeedReapproval = checkCriticalChanges({
      ...laundry,
      physical_address: values.physical_address,
      latitude: values.latitude,
      longitude: values.longitude,
    })

    if (willNeedReapproval) {
      setNeedsReapproval(true)
    }

    await updateMutation.mutateAsync({
      ...laundry,
      ...values,
      services_offered: laundry?.services_offered,
      price_per_kg: laundry?.price_per_kg,
      capacity_per_day: laundry?.capacity_per_day,
      operating_hours: laundry?.operating_hours,
      bank_details: laundry?.bank_details,
      photos: laundry?.photos,
    })
  }

  const handleServiceSubmit = async (values: ServiceDetailsFormValues) => {
    const willNeedReapproval = checkCriticalChanges({
      ...laundry,
      services_offered: values.services_offered,
    })

    if (willNeedReapproval) {
      setNeedsReapproval(true)
    }

    await updateMutation.mutateAsync({
      ...laundry,
      ...values,
      business_name: laundry?.business_name,
      owner_name: laundry?.owner_name,
      email: laundry?.email,
      phone: laundry?.phone,
      physical_address: laundry?.physical_address,
      latitude: laundry?.latitude,
      longitude: laundry?.longitude,
      bank_details: laundry?.bank_details,
      photos: laundry?.photos,
    })
  }

  const handleBankingSubmit = async (values: BankingFormValues) => {
    await updateMutation.mutateAsync({
      ...laundry,
      bank_details: values,
    })
  }

  const getStatusBadge = () => {
    if (!laundry) return null
    const status = laundry.status
    if (status === 'active') {
      return <Badge className="bg-green-100 text-green-800">Active</Badge>
    }
    if (status === 'pending_approval') {
      return <Badge className="bg-yellow-100 text-yellow-800">Pending Approval</Badge>
    }
    if (status === 'rejected') {
      return <Badge className="bg-red-100 text-red-800">Rejected</Badge>
    }
    if (status === 'more_info_needed') {
      return <Badge className="bg-blue-100 text-blue-800">More Info Needed</Badge>
    }
    return null
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (!laundry) {
    return (
      <div className="space-y-4">
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>No Profile Found</AlertTitle>
          <AlertDescription>
            Please complete your onboarding application first.
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Profile header with cover — Unsplash: happy laundry owner / clean store */}
      <div className="relative h-32 md:h-40 rounded-2xl overflow-hidden bg-muted">
        <Image
          src="https://images.unsplash.com/photo-1563453392212-326f5e854473?w=1200&q=80"
          alt=""
          fill
          className="object-cover"
          sizes="(max-width: 768px) 100vw, 1200px"
        />
        <div className="absolute inset-0 bg-navy-900/20" />
        <div className="absolute bottom-4 left-4">
          <h1 className="text-xl font-bold text-white drop-shadow-md">{laundry.business_name}</h1>
          <p className="text-sm text-white/90">Profile & Settings</p>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Business details</h2>
          <p className="text-sm text-muted-foreground">
            Manage your laundry details, services, pricing, and payout information.
          </p>
        </div>
        {getStatusBadge()}
      </div>

      {laundry.status === 'rejected' && laundry.rejection_reason && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Application Rejected</AlertTitle>
          <AlertDescription>{laundry.rejection_reason}</AlertDescription>
        </Alert>
      )}

      {needsReapproval && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Re-approval Required</AlertTitle>
          <AlertDescription>
            You've made critical changes (address or services) that require admin re-approval. Your
            application will be reviewed again.
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="business" className="space-y-4">
        <TabsList>
          <TabsTrigger value="business">Business Info</TabsTrigger>
          <TabsTrigger value="services">Services & Pricing</TabsTrigger>
          <TabsTrigger value="hours">Operating Hours</TabsTrigger>
          <TabsTrigger value="banking">Banking Details</TabsTrigger>
        </TabsList>

        <TabsContent value="business" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Business Information
              </CardTitle>
              <CardDescription>
                Update your business details. Changing your address requires re-approval.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={businessForm.handleSubmit(handleBusinessSubmit)} className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="business_name">Business Name *</Label>
                    <Input
                      id="business_name"
                      {...businessForm.register('business_name')}
                      disabled={updateMutation.isPending}
                    />
                    {businessForm.formState.errors.business_name && (
                      <p className="text-sm text-destructive">
                        {businessForm.formState.errors.business_name.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="owner_name">Owner Name *</Label>
                    <Input
                      id="owner_name"
                      {...businessForm.register('owner_name')}
                      disabled={updateMutation.isPending}
                    />
                    {businessForm.formState.errors.owner_name && (
                      <p className="text-sm text-destructive">
                        {businessForm.formState.errors.owner_name.message}
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
                      {...businessForm.register('email')}
                      disabled={updateMutation.isPending}
                    />
                    {businessForm.formState.errors.email && (
                      <p className="text-sm text-destructive">
                        {businessForm.formState.errors.email.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone *</Label>
                    <Input
                      id="phone"
                      type="tel"
                      {...businessForm.register('phone')}
                      disabled={updateMutation.isPending}
                    />
                    {businessForm.formState.errors.phone && (
                      <p className="text-sm text-destructive">
                        {businessForm.formState.errors.phone.message}
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="physical_address">Physical Address *</Label>
                  <Input
                    id="physical_address"
                    {...businessForm.register('physical_address')}
                    disabled={updateMutation.isPending}
                  />
                  {businessForm.formState.errors.physical_address && (
                    <p className="text-sm text-destructive">
                      {businessForm.formState.errors.physical_address.message}
                    </p>
                  )}
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="latitude">Latitude</Label>
                    <Input
                      id="latitude"
                      type="number"
                      step="any"
                      {...businessForm.register('latitude', { valueAsNumber: true })}
                      disabled={updateMutation.isPending}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="longitude">Longitude</Label>
                    <Input
                      id="longitude"
                      type="number"
                      step="any"
                      {...businessForm.register('longitude', { valueAsNumber: true })}
                      disabled={updateMutation.isPending}
                    />
                  </div>
                </div>

                <Button type="submit" disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save Changes'
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="services" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Services & Pricing
              </CardTitle>
              <CardDescription>
                Update your services and pricing. Changing services requires re-approval.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={serviceForm.handleSubmit(handleServiceSubmit)} className="space-y-4">
                <div className="space-y-4">
                  <Label>Services Offered *</Label>
                  <div className="grid gap-3 md:grid-cols-2">
                    {SERVICE_OPTIONS.map((service) => (
                      <div key={service.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={service.id}
                          checked={serviceForm.watch('services_offered').includes(service.id)}
                          onCheckedChange={(checked) => {
                            const current = serviceForm.getValues('services_offered')
                            if (checked) {
                              serviceForm.setValue('services_offered', [...current, service.id])
                            } else {
                              serviceForm.setValue(
                                'services_offered',
                                current.filter((s) => s !== service.id)
                              )
                            }
                          }}
                          disabled={updateMutation.isPending}
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
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="price_per_kg">Price per kg (R) *</Label>
                    <Input
                      id="price_per_kg"
                      type="number"
                      step="0.01"
                      {...serviceForm.register('price_per_kg', { valueAsNumber: true })}
                      disabled={updateMutation.isPending}
                    />
                    {serviceForm.formState.errors.price_per_kg && (
                      <p className="text-sm text-destructive">
                        {serviceForm.formState.errors.price_per_kg.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="capacity_per_day">Daily Capacity (kg) *</Label>
                    <Input
                      id="capacity_per_day"
                      type="number"
                      {...serviceForm.register('capacity_per_day', { valueAsNumber: true })}
                      disabled={updateMutation.isPending}
                    />
                    {serviceForm.formState.errors.capacity_per_day && (
                      <p className="text-sm text-destructive">
                        {serviceForm.formState.errors.capacity_per_day.message}
                      </p>
                    )}
                  </div>
                </div>

                <Button type="submit" disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save Changes'
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="hours" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Operating Hours
              </CardTitle>
              <CardDescription>Set your business operating hours for each day</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={serviceForm.handleSubmit(handleServiceSubmit)} className="space-y-4">
                <div className="space-y-3">
                  {DAYS.map((day) => {
                    const dayName = day.charAt(0).toUpperCase() + day.slice(1)
                    return (
                      <div key={day} className="grid grid-cols-3 gap-2 items-center">
                        <Label className="text-sm font-medium">{dayName}</Label>
                        <Input
                          type="time"
                          {...serviceForm.register(`operating_hours.${day}.open`)}
                          disabled={updateMutation.isPending}
                        />
                        <Input
                          type="time"
                          {...serviceForm.register(`operating_hours.${day}.close`)}
                          disabled={updateMutation.isPending}
                        />
                      </div>
                    )
                  })}
                </div>

                <Button type="submit" disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save Changes'
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="banking" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Banking Details
              </CardTitle>
              <CardDescription>
                Update your banking information for payouts. This information is encrypted and
                stored securely.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={bankingForm.handleSubmit(handleBankingSubmit)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="bank_name">Bank Name *</Label>
                  <Input
                    id="bank_name"
                    {...bankingForm.register('bank_name')}
                    disabled={updateMutation.isPending}
                  />
                  {bankingForm.formState.errors.bank_name && (
                    <p className="text-sm text-destructive">
                      {bankingForm.formState.errors.bank_name.message}
                    </p>
                  )}
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="account_number">Account Number *</Label>
                    <Input
                      id="account_number"
                      {...bankingForm.register('account_number')}
                      disabled={updateMutation.isPending}
                    />
                    {bankingForm.formState.errors.account_number && (
                      <p className="text-sm text-destructive">
                        {bankingForm.formState.errors.account_number.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="branch_code">Branch Code</Label>
                    <Input
                      id="branch_code"
                      {...bankingForm.register('branch_code')}
                      disabled={updateMutation.isPending}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="account_holder">Account Holder Name *</Label>
                  <Input
                    id="account_holder"
                    {...bankingForm.register('account_holder')}
                    disabled={updateMutation.isPending}
                  />
                  {bankingForm.formState.errors.account_holder && (
                    <p className="text-sm text-destructive">
                      {bankingForm.formState.errors.account_holder.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="account_type">Account Type *</Label>
                  <select
                    id="account_type"
                    {...bankingForm.register('account_type')}
                    disabled={updateMutation.isPending}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="checking">Checking Account</option>
                    <option value="savings">Savings Account</option>
                  </select>
                </div>

                <Button type="submit" disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save Changes'
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

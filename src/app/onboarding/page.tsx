'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
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
import { Progress } from '@/components/ui/progress'
import { Checkbox } from '@/components/ui/checkbox'
import { Upload, Loader2, ArrowRight, ArrowLeft, MapPin } from 'lucide-react'
import { OnboardingStep1 } from '@/components/onboarding/step1-business-info'
import { OnboardingStep2 } from '@/components/onboarding/step2-service-details'
import { OnboardingStep3 } from '@/components/onboarding/step3-photos'
import { OnboardingStep4 } from '@/components/onboarding/step4-banking'

const STEPS = [
  { id: 1, title: 'Business Info', component: OnboardingStep1 },
  { id: 2, title: 'Service Details', component: OnboardingStep2 },
  { id: 3, title: 'Photos', component: OnboardingStep3 },
  { id: 4, title: 'Banking Details', component: OnboardingStep4 },
]

export default function OnboardingPage() {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState<Record<string, any>>({})
  const supabase = createClient()

  const progress = (currentStep / STEPS.length) * 100

  const handleNext = (stepData: Record<string, any>) => {
    setFormData((prev) => ({ ...prev, ...stepData }))
    if (currentStep < STEPS.length) {
      setCurrentStep(currentStep + 1)
    }
  }

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleSubmit = async (finalStepData: Record<string, any>) => {
    setLoading(true)
    try {
      const completeData = { ...formData, ...finalStepData }

      // Submit to Edge Function
      const result = await callEdgeFunction('submit_laundry_application', {
        laundry_data: {
          business_name: completeData.business_name,
          owner_name: completeData.owner_name,
          email: completeData.email,
          phone: completeData.phone,
          physical_address: completeData.physical_address,
          latitude: completeData.latitude,
          longitude: completeData.longitude,
          services_offered: completeData.services_offered || [],
          price_per_kg: completeData.price_per_kg,
          capacity_per_day: completeData.capacity_per_day,
          operating_hours: completeData.operating_hours,
          bank_details: completeData.bank_details,
          photos: completeData.photos || [],
        },
      })

      if (result.data?.success) {
        toast.success('Application submitted successfully!')
        router.push('/onboarding/success')
      } else {
        throw new Error(result.error?.message || 'Failed to submit application')
      }
    } catch (error: any) {
      console.error('Submission error:', error)
      toast.error(error.message || 'Failed to submit application. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const CurrentStepComponent = STEPS[currentStep - 1].component

  return (
    <div className="container mx-auto min-h-screen px-4 py-8">
      <div className="mx-auto max-w-3xl">
        {/* Progress Bar */}
        <div className="mb-8">
          <div className="mb-2 flex items-center justify-between">
            <h1 className="text-2xl font-bold">Partner Onboarding</h1>
            <span className="text-sm text-muted-foreground">
              Step {currentStep} of {STEPS.length}
            </span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* Step Indicator */}
        <div className="mb-8 flex items-center justify-between">
          {STEPS.map((step, index) => (
            <div key={step.id} className="flex flex-1 items-center">
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-full border-2 ${
                  currentStep > step.id
                    ? 'border-primary bg-primary text-primary-foreground'
                    : currentStep === step.id
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-muted bg-muted text-muted-foreground'
                }`}
              >
                {currentStep > step.id ? (
                  <span className="text-sm font-bold">✓</span>
                ) : (
                  <span className="text-sm font-bold">{step.id}</span>
                )}
              </div>
              {index < STEPS.length - 1 && (
                <div
                  className={`h-1 flex-1 ${
                    currentStep > step.id ? 'bg-primary' : 'bg-muted'
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Step Content */}
        <Card>
          <CardHeader>
            <CardTitle>{STEPS[currentStep - 1].title}</CardTitle>
            <CardDescription>
              {currentStep === 1 && 'Tell us about your business'}
              {currentStep === 2 && 'Configure your services and pricing'}
              {currentStep === 3 && 'Upload photos of your laundry facility'}
              {currentStep === 4 && 'Add your banking details for payouts'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CurrentStepComponent
              initialData={formData}
              onNext={handleNext}
              onBack={handleBack}
              onSubmit={handleSubmit}
              isLastStep={currentStep === STEPS.length}
              loading={loading}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { createClient } from '@/lib/supabase'
import { Upload, X, Loader2, Image as ImageIcon } from 'lucide-react'
import { toast } from 'sonner'

interface OnboardingStep3Props {
  initialData: Record<string, any>
  onNext: (data: Record<string, any>) => void
  onBack: () => void
  onSubmit?: (data: Record<string, any>) => void
  isLastStep?: boolean
  loading?: boolean
}

export function OnboardingStep3({
  initialData,
  onNext,
  onBack,
  isLastStep = false,
  loading = false,
}: OnboardingStep3Props) {
  const [photos, setPhotos] = useState<string[]>(initialData.photos || [])
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0) return

    setUploading(true)
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const uploadPromises = Array.from(files).map(async (file) => {
        // Validate file type
        if (!file.type.startsWith('image/')) {
          throw new Error(`${file.name} is not an image file`)
        }

        // Validate file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
          throw new Error(`${file.name} is too large. Maximum size is 5MB`)
        }

        const fileName = `${user.id}/${Date.now()}_${file.name}`
        const { data, error } = await supabase.storage
          .from('laundry-photos')
          .upload(fileName, file, {
            cacheControl: '3600',
            upsert: false,
          })

        if (error) {
          console.error('upload error', error)
          throw error
        }
        console.log('upload successful', data)
        // Get public URL
        const {
          data: { publicUrl },
        } = supabase.storage.from('laundry-photos').getPublicUrl(data.path)

        return publicUrl
      })

      const uploadedUrls = await Promise.all(uploadPromises)
      setPhotos((prev) => [...prev, ...uploadedUrls])
      toast.success(`${uploadedUrls.length} photo(s) uploaded successfully`)
    } catch (error: any) {
      console.error('Upload error:', error)
      toast.error(error.message || 'Failed to upload photos')
    } finally {
      setUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index))
  }

  const handleNext = () => {
    onNext({ photos })
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label>Upload Photos</Label>
        <p className="text-sm text-muted-foreground">
          Upload photos of your laundry facility. You can upload multiple photos (max 5MB each).
        </p>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/25 p-8">
          <div className="text-center">
            <ImageIcon className="mx-auto h-12 w-12 text-muted-foreground" />
            <div className="mt-4">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileSelect}
                className="hidden"
                id="photo-upload"
                disabled={uploading || loading}
              />
              <Label htmlFor="photo-upload" className="cursor-pointer">
                <Button type="button" variant="outline" disabled={uploading || loading} asChild>
                  <span>
                    {uploading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload className="mr-2 h-4 w-4" />
                        Choose Photos
                      </>
                    )}
                  </span>
                </Button>
              </Label>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              PNG, JPG, GIF up to 5MB each
            </p>
          </div>
        </div>

        {photos.length > 0 && (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
            {photos.map((photo, index) => (
              <div key={index} className="relative group">
                <img
                  src={photo}
                  alt={`Photo ${index + 1}`}
                  className="h-32 w-full rounded-lg object-cover"
                />
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  className="absolute right-2 top-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => removePhoto(index)}
                  disabled={loading}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex justify-end gap-4">
        <Button type="button" variant="outline" onClick={onBack} disabled={loading || uploading}>
          Back
        </Button>
        <Button type="button" onClick={handleNext} disabled={loading || uploading}>
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processing...
            </>
          ) : (
            'Next: Banking Details'
          )}
        </Button>
      </div>
    </div>
  )
}

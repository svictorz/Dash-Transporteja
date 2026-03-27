import { supabase } from './client'

const BUCKET_NAME = 'checkin-photos'
const AVATAR_BUCKET_NAME = 'avatars'

/**
 * Upload a photo to Supabase Storage
 * @param file - File or Blob to upload
 * @param path - Path in the bucket (e.g., 'checkins/123.jpg')
 * @returns URL of the uploaded file
 */
export async function uploadPhoto(file: File | Blob, path: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(path, file, {
      cacheControl: '3600',
      upsert: false
    })

  if (error) {
    throw new Error(`Failed to upload photo: ${error.message}`)
  }

  // Get public URL
  const { data: { publicUrl } } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(data.path)

  return publicUrl
}

/**
 * Delete a photo from Supabase Storage
 * @param path - Path in the bucket
 */
export async function deletePhoto(path: string): Promise<void> {
  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .remove([path])

  if (error) {
    throw new Error(`Failed to delete photo: ${error.message}`)
  }
}

/**
 * Upload avatar to Supabase Storage
 * @param file - File or Blob to upload
 * @param userId - User ID
 * @returns URL of the uploaded file
 */
export async function uploadAvatar(file: File | Blob, userId: string): Promise<string> {
  const path = `${userId}/avatar.jpg`
  
  const { data, error } = await supabase.storage
    .from(AVATAR_BUCKET_NAME)
    .upload(path, file, {
      cacheControl: '3600',
      upsert: true // Sobrescrever se já existir
    })

  if (error) {
    throw new Error(`Failed to upload avatar: ${error.message}`)
  }

  // Get public URL
  const { data: { publicUrl } } = supabase.storage
    .from(AVATAR_BUCKET_NAME)
    .getPublicUrl(data.path)

  return publicUrl
}

/**
 * Delete avatar from Supabase Storage
 * @param userId - User ID
 */
export async function deleteAvatar(userId: string): Promise<void> {
  const path = `${userId}/avatar.jpg`
  
  const { error } = await supabase.storage
    .from(AVATAR_BUCKET_NAME)
    .remove([path])

  if (error) {
    throw new Error(`Failed to delete avatar: ${error.message}`)
  }
}

/**
 * Convert base64 data URL to Blob
 */
export function base64ToBlob(base64: string, mimeType: string = 'image/jpeg'): Blob {
  const base64Data = base64.split(',')[1]
  const byteCharacters = atob(base64Data)
  const byteNumbers = new Array(byteCharacters.length)
  
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i)
  }
  
  const byteArray = new Uint8Array(byteNumbers)
  return new Blob([byteArray], { type: mimeType })
}


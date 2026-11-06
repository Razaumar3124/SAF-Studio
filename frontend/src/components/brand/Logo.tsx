import { brandAssets } from '@/assets/brand'
import { cn } from '@/lib/cn'

interface LogoProps {
  /** `full`: stacked monogram + wordmark (as delivered). `mark`: monogram only (brand bar, tight spaces). */
  variant?: 'full' | 'mark'
  /** Set the size with classes (e.g. `h-10 w-auto`); the other side follows the aspect ratio. */
  className?: string
  /** Pass `''` when visible text next to the logo already names the brand (avoids a double read-out). */
  alt?: string
}

/** SAF logo from the vector asset. */
export function Logo({ variant = 'full', className, alt }: LogoProps) {
  const asset = variant === 'mark' ? brandAssets.logoMark : brandAssets.logo
  return (
    <img
      src={asset.src}
      width={asset.width}
      height={asset.height}
      alt={alt ?? asset.alt}
      decoding="async"
      draggable={false}
      className={cn('h-auto w-48 select-none', className)}
    />
  )
}
